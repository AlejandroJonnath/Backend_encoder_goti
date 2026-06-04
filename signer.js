// Este archivo es el núcleo de la firma electrónica del sistema,
// su trabajo es tomar un PDF en memoria y un certificado P12 del firmante, extraer los datos reales del certificado (nombre, emisor, número de serie),
// dibujar un sello visual con esos datos en la primera página del PDF (para que cualquier persona que abra el documento pueda ver quién lo firmó y cuándo),
// y luego inyectar matemáticamente la firma criptográfica PKCS#7 dentro del mismo archivo PDF (la firma invisible pero verificable por cualquier lector de PDF como Adobe),
// el resultado es un PDF que cumple con los estándares de firma electrónica y que puede ser verificado criptográficamente por terceros

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib"); // pdf-lib es la librería para crear y manipular PDFs en Node.js; PDFDocument nos permite cargar y modificar el PDF, rgb nos da colores en formato RGB (valores del 0 al 1), StandardFonts nos da acceso a fuentes embebidas como Helvetica
const signpdf = require("@signpdf/signpdf").default; // signpdf es el motor principal de firma; su función sign() inyecta la firma criptográfica CMS/PKCS#7 en el espacio reservado (placeholder) del PDF
const { P12Signer } = require("@signpdf/signer-p12"); // P12Signer es el adaptador que sabe cómo leer un certificado P12, extraer la clave privada con la contraseña y usarla para generar la firma digital
const { pdflibAddPlaceholder } = require("@signpdf/placeholder-pdf-lib"); // pdflibAddPlaceholder agrega al PDF un espacio reservado (un hueco vacío de tamaño predefinido) donde signpdf luego insertará los bytes de la firma criptográfica
const forge = require("node-forge"); // node-forge es una librería de criptografía pura en JavaScript; la usamos aquí específicamente para parsear el archivo P12 y extraer los datos legibles del certificado (nombre del firmante, emisor, número de serie) que mostraremos en el sello visual

// Función interna que lee el contenido binario del archivo P12 y extrae los datos legibles del certificado (nombre, emisor y número de serie) para mostrarlos en el sello visual del PDF
function extractCertInfo(p12Buffer, password) {
  try {
    const p12Der = forge.util.decode64(p12Buffer.toString("base64")); // Convertimos el buffer binario del P12 a base64 y luego lo decodificamos al formato DER (Distinguished Encoding Rules) que es el formato binario estándar de los certificados criptográficos
    const p12Asn1 = forge.asn1.fromDer(p12Der); // Parseamos el DER a la estructura ASN.1 (Abstract Syntax Notation One) que es el lenguaje formal en que se definen los certificados digitales
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password); // Usamos la contraseña para desencriptar el P12 y obtener el objeto PKCS#12 completo con todos los certificados y claves privadas que contiene

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag }); // Extraemos las "bolsas" de certificados del P12 (un P12 puede contener múltiples certificados: el del firmante y los de la cadena de confianza)
    const certBagList = certBags[forge.pki.oids.certBag]; // Accedemos a la lista específica de certificados usando el OID (identificador de objeto) estándar para certificados X.509

    if (!certBagList || certBagList.length === 0) throw new Error("Sin certificados"); // Si el P12 no contiene ningún certificado es un archivo corrupto o vacío; lanzamos un error para detener el proceso

    const cert = certBagList[0].cert; // Tomamos el primer certificado de la lista (que es el del firmante principal)

    let commonName = "Firmante"; // Valor por defecto por si el campo CN no existe en el certificado
    let issuerName = "Emisor"; // Valor por defecto por si el campo CN del emisor no existe
    let serialNumber = cert.serialNumber || ""; // El número de serie del certificado es único por cada certificado emitido (equivalente a un DNI del certificado)

    const cnField = cert.subject.getField("CN"); // Buscamos el campo "Common Name" del sujeto (el nombre de la persona o entidad que posee el certificado)
    if (cnField) commonName = cnField.value; // Si existe usamos su valor como nombre del firmante que aparecerá en el sello visual

    const issuerCnField = cert.issuer.getField("CN"); // Buscamos el campo "Common Name" del emisor (la autoridad certificadora que emitió el certificado, por ejemplo el Banco Central del Ecuador)
    if (issuerCnField) issuerName = issuerCnField.value; // Si existe usamos su valor como nombre del emisor en el sello visual

    return { commonName, issuerName, serialNumber }; // Devolvemos los tres datos del certificado que mostraremos en el sello visual
  } catch (err) {
    throw new Error("Contraseña incorrecta o archivo P12 inválido"); // Si algo falla (contraseña incorrecta, archivo corrupto, formato inválido) reemplazamos el error técnico por uno más descriptivo para el usuario final
  }
}

// Función principal que toma el PDF y el P12, agrega el sello visual y la firma criptográfica, y devuelve el PDF firmado como Buffer
async function signElectronicDocument({ pdfBuffer, p12Buffer, password, posX, posY, pageNumber = 1 }) {
  // 1. Extraer datos para el sello visual
  const { commonName, issuerName, serialNumber } = extractCertInfo(p12Buffer, password); // Llamamos a la función anterior para obtener los datos legibles del certificado; si la contraseña es incorrecta aquí se lanzará el error

  // 2. Cargar PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer); // Cargamos el PDF desde su buffer binario para poder manipularlo con pdf-lib
  const pages = pdfDoc.getPages(); // Obtenemos el array de todas las páginas del documento
  const pageIndex = Math.max(0, Math.min(pageNumber - 1, pages.length - 1)); // Calculamos el índice seguro (0-based) asegurándonos de que no se salga de los límites
  const page = pages[pageIndex]; // Tomamos la página seleccionada por el usuario para dibujar el sello visual ahí
  const { width: pageWidth, height: pageHeight } = page.getSize(); // Obtenemos las dimensiones de la página en puntos (unidad de medida de PDF; 1 punto = 1/72 pulgadas) para poder calcular posiciones relativas

  const stampWidth = 180; // Ancho del sello visual en puntos PDF
  const stampHeight = 85; // Alto del sello visual en puntos PDF
  const x = (posX / 100) * (pageWidth - stampWidth); // Calculamos la posición X absoluta del sello multiplicando el porcentaje recibido por el espacio disponible (ancho de página menos ancho del sello); esto asegura que el sello no se salga del borde derecho
  const y = (posY / 100) * (pageHeight - stampHeight); // Calculamos la posición Y absoluta de manera análoga; en PDF el eje Y empieza desde abajo, así que Y=0 es la parte inferior de la página

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica); // Incrustamos la fuente Helvetica normal en el documento para el texto del sello (necesitamos embeber las fuentes para que el PDF sea autónomo y se vea igual en cualquier lector)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // Incrustamos también la variante negrita de Helvetica para los títulos del sello

  const rawDateString = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    .replace(/\u202f/g, " ").replace(/\u00a0/g, " "); // Generamos la fecha y hora actual en zona horaria de Ecuador (GMT-5) con formato localizado; las expresiones regulares reemplazan caracteres de espacio especiales unicode (\u202f = espacio estrecho sin salto, \u00a0 = espacio sin ruptura) por espacios normales para evitar problemas de codificación en el PDF

  // 3. Dibujar estampa sin bordes
  page.drawText("FIRMADO DIGITALMENTE", { x: x + 4, y: y + stampHeight - 16, size: 8.5, font: helveticaBoldFont, color: rgb(0.12, 0.44, 0.73) }); // Título del sello en azul oscuro y negrita; el +4 en X y el cálculo en Y posicionan cada línea dentro del rectángulo del sello con un pequeño margen interno
  page.drawText(`Firmante: ${commonName}`, { x: x + 4, y: y + stampHeight - 28, size: 7.5, font: helveticaFont, color: rgb(0.1, 0.1, 0.1) }); // Nombre del firmante extraído del certificado P12
  page.drawText(`Fecha: ${rawDateString}`, { x: x + 4, y: y + stampHeight - 40, size: 7, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) }); // Fecha y hora de la firma en zona horaria ecuatoriana
  page.drawText(`Emisor: ${issuerName}`, { x: x + 4, y: y + stampHeight - 52, size: 6.5, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) }); // Nombre de la autoridad certificadora que emitió el certificado
  page.drawText(`Serie: ${serialNumber}`, { x: x + 4, y: y + stampHeight - 64, size: 6.5, font: helveticaFont, color: rgb(0.4, 0.4, 0.4) }); // Número de serie único del certificado (permite identificarlo y revocarlo si es necesario)
  page.drawText(`Firma Electrónica (Ecuador)`, { x: x + 4, y: y + stampHeight - 76, size: 6.5, font: helveticaBoldFont, color: rgb(0.0, 0.5, 0.2) }); // Leyenda en verde que identifica el tipo y país de la firma electrónica

  // 4. Agregar Placeholder para la firma criptográfica (esencial para node-signpdf)
  pdflibAddPlaceholder({ // Reservamos un espacio vacío dentro del PDF donde irán los bytes de la firma criptográfica; sin este placeholder signpdf no puede insertar la firma porque no sabría dónde colocarla
    pdfDoc, // El documento PDF que estamos modificando
    reason: "Firma Electrónica", // Razón de la firma que queda registrada en los metadatos del PDF
    location: "Ecuador", // Ubicación del firmante que queda en los metadatos
    contactInfo: commonName, // Información de contacto del firmante (usamos el nombre del CN del certificado)
    name: commonName, // Nombre del firmante en los metadatos del PDF
    signatureLength: 32768, // <-- Aumentamos el tamaño del placeholder para firmas pesadas; los certificados ecuatorianos del Banco Central o Security Data pueden tener firmas con cadenas de certificados largas; si el placeholder es muy pequeño la firma no cabe y el proceso falla
  });

  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save()); // Serializamos el PDF (con el sello visual y el placeholder ya incrustados) a un Buffer de bytes; este es el PDF "listo para firmar" que le pasaremos a signpdf

  // 5. Inyectar firma CMS/PKCS#7 matemáticamente verificable
  const signer = new P12Signer(p12Buffer, { passphrase: password }); // Creamos el firmante usando el P12 y la contraseña; P12Signer se encargará de extraer la clave privada y el certificado para generar la firma
  const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer); // Inyectamos la firma criptográfica en el placeholder que reservamos; el resultado es el PDF completamente firmado con la firma CMS/PKCS#7 matemáticamente verificable incrustada

  return signedPdf; // Devolvemos el Buffer del PDF firmado al controlador (signController.js) que lo enviará directamente al cliente como descarga
}

module.exports = { signElectronicDocument }; // Exportamos la función principal para que signController.js la pueda importar y usar

// si quitas extractCertInfo pasa que signElectronicDocument no podrá leer los datos del certificado P12 y el sello visual aparecerá con datos vacíos o el proceso fallará al intentar llamar a una función inexistente,
// para solucionar esto vuelve a crear la función usando forge para parsear el P12 con su contraseña y extraer el campo CN del sujeto e issuer del certificado

// si quitas pdflibAddPlaceholder pasa que signpdf.sign() fallará con un error porque no encontrará el espacio reservado donde insertar la firma criptográfica; sin el placeholder no hay firma posible,
// para solucionar esto vuelve a agregar la llamada a pdflibAddPlaceholder con el signatureLength de al menos 32768 para firmas ecuatorianas

// si reduces el signatureLength a un valor pequeño (como el 8192 que usan los ejemplos básicos) pasa que con certificados ecuatorianos del Banco Central o Security Data que tienen cadenas de confianza largas, el proceso de firma fallará con un error de "not enough space for signature",
// para solucionar esto mantén el valor en 32768 o aumentalo a 65536 si sigues viendo ese error

// si quitas signpdf.sign() pasa que el PDF tendrá el sello visual dibujado pero no tendrá firma criptográfica real; cualquier lector de PDF que verifique firmas (como Adobe) mostrará que el documento "no tiene firma válida",
// para solucionar esto vuelve a agregar la llamada a signpdf.sign(pdfWithPlaceholder, signer) y devuelve su resultado

// si quitas module.exports pasa que signController.js no podrá importar signElectronicDocument y el servidor se caerá al arrancar con un error "is not a function",
// para solucionar esto vuelve a agregar module.exports = { signElectronicDocument } al final del archivo

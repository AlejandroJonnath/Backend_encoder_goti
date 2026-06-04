// Este archivo es el controlador de la firma electrónica de documentos,
// su trabajo es recibir el PDF y el certificado P12 ya procesados por Multer (en memoria), validarlos, y coordinar el proceso completo de firma que tiene tres pasos:
// primero valida que llegaron todos los datos necesarios (PDF, P12 y contraseña),
// luego llama a la función de firma del módulo signer.js que hace el procesamiento criptográfico real,
// y finalmente responde al cliente con el PDF firmado listo para descargar directamente como binario,
// este controlador trabaja con buffers en memoria (no con archivos en disco) porque el PDF firmado se devuelve directamente sin necesidad de guardarlo temporalmente

const { signElectronicDocument } = require("../../signer"); // Importamos la función principal de signer.js que está en la raíz del proyecto (dos niveles arriba desde src/controllers/); esa función hace todo el procesamiento criptográfico del certificado P12 y del PDF

// Controlador que maneja la petición POST /api/sign; recibe el PDF y el certificado P12 en memoria, firma el documento y devuelve el PDF firmado como descarga
const signDocument = async (req, res) => {
  try {
    const { pdf, p12 } = req.files; // Desestructuramos los archivos desde req.files; Multer los dejó ahí como arrays de objetos con la propiedad "buffer" que contiene el contenido binario del archivo en RAM
    const password = req.body.password; // La contraseña del certificado P12 llega como un campo de texto normal del formulario (no como archivo); la necesitamos para desencriptar la clave privada del certificado
    const posX = parseFloat(req.body.posX) || 70; // Posición horizontal del sello visual en la página, expresada como porcentaje (0 a 100); si no se envía usamos 70 como valor por defecto
    const posY = parseFloat(req.body.posY) || 10; // Posición vertical del sello visual en la página, expresada como porcentaje (0 a 100); si no se envía usamos 10 como valor por defecto (parte inferior de la página)
    const pageNumber = parseInt(req.body.pageNumber) || 1; // Número de página (1-indexed) donde se estampará el sello visual

    if (!pdf || !p12 || !password) {
      return res.status(400).json({ error: "Faltan archivos (pdf, p12) o contraseña." }); // Si falta cualquiera de los tres elementos obligatorios rechazamos la petición con un error 400 (Bad Request) antes de intentar firmar; sin los tres elementos es imposible completar el proceso
    }

    // Firmar criptográficamente el documento
    const signedPdfBuffer = await signElectronicDocument({ // Llamamos a la función de signer.js pasándole todos los datos necesarios; await porque el proceso de firma es asíncrono (involucra operaciones de criptografía y manipulación de PDF que toman tiempo)
      pdfBuffer: pdf[0].buffer, // El contenido binario del PDF original que queremos firmar (un Buffer de Node.js con todos los bytes del archivo)
      p12Buffer: p12[0].buffer, // El contenido binario del certificado P12 del firmante (también un Buffer con los bytes del archivo .p12)
      password, // La contraseña del certificado P12 necesaria para extraer la clave privada que hace la firma criptográfica
      posX, // Coordenada X para posicionar el sello visual en el PDF
      posY, // Coordenada Y para posicionar el sello visual en el PDF
      pageNumber // Número de página donde colocar el sello (1-indexed)
    });

    res.setHeader("Content-Type", "application/pdf"); // Le indicamos al cliente que el cuerpo de la respuesta es un archivo PDF en formato binario
    res.setHeader("Content-Disposition", 'attachment; filename="signed_document.pdf"'); // Le decimos al cliente que descargue este contenido como un archivo con el nombre "signed_document.pdf" en lugar de mostrarlo en el navegador
    res.send(signedPdfBuffer); // Enviamos el PDF firmado como respuesta binaria directa; el cliente lo recibirá y lo guardará en el dispositivo del usuario

  } catch (error) {
    console.error("Error al firmar:", error); // Registramos el error completo en los logs del servidor para facilitar el diagnóstico
    res.status(500).json({ error: error.message || "Error interno al firmar documento." }); // Respondemos al cliente con el mensaje de error para que pueda informarle al usuario (ejemplo: "Contraseña incorrecta o archivo P12 inválido")
  }
};

module.exports = {
  signDocument // Exportamos el controlador para que signRoutes.js lo pueda importar y asignarlo a la ruta POST /api/sign
};

// si quitas signDocument pasa que signRoutes.js importará un objeto vacío y Express lanzará un error al intentar registrar la ruta porque el controlador no será una función,
// para solucionar esto vuelve a crear la función async con el mismo nombre, validando req.files y req.body.password, llamando a signElectronicDocument y respondiendo con res.send del buffer firmado

// si quitas las validaciones de !pdf || !p12 || !password pasa que el servidor intentará firmar sin los datos necesarios y signer.js lanzará un error críptico difícil de interpretar para el usuario,
// para solucionar esto vuelve a agregar el if de validación antes de llamar a signElectronicDocument

// si cambias res.send(signedPdfBuffer) por res.json({...}) pasa que el cliente recibirá texto JSON en lugar de un archivo binario PDF y no podrá abrirlo,
// para solucionar esto asegúrate de que la respuesta use res.setHeader de Content-Type "application/pdf" y res.send con el Buffer directamente

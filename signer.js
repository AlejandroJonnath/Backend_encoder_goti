const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const signpdf = require("@signpdf/signpdf").default;
const { P12Signer } = require("@signpdf/signer-p12");
const { pdflibAddPlaceholder } = require("@signpdf/placeholder-pdf-lib");
const forge = require("node-forge");

// Extraer info real del P12 para la estampa
function extractCertInfo(p12Buffer, password) {
  try {
    const p12Der = forge.util.decode64(p12Buffer.toString("base64"));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBagList = certBags[forge.pki.oids.certBag];
    
    if (!certBagList || certBagList.length === 0) throw new Error("Sin certificados");
    
    const cert = certBagList[0].cert;
    
    let commonName = "Firmante";
    let issuerName = "Emisor";
    let serialNumber = cert.serialNumber || "";
    
    const cnField = cert.subject.getField("CN");
    if (cnField) commonName = cnField.value;
    
    const issuerCnField = cert.issuer.getField("CN");
    if (issuerCnField) issuerName = issuerCnField.value;
    
    return { commonName, issuerName, serialNumber };
  } catch (err) {
    throw new Error("Contraseña incorrecta o archivo P12 inválido");
  }
}

async function signElectronicDocument({ pdfBuffer, p12Buffer, password, posX, posY }) {
  // 1. Extraer datos para el sello visual
  const { commonName, issuerName, serialNumber } = extractCertInfo(p12Buffer, password);
  
  // 2. Cargar PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const page = pages[0]; // Estampar en primera página
  const { width: pageWidth, height: pageHeight } = page.getSize();
  
  const stampWidth = 180;
  const stampHeight = 85;
  const x = (posX / 100) * (pageWidth - stampWidth);
  const y = (posY / 100) * (pageHeight - stampHeight);
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const rawDateString = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
                         .replace(/\u202f/g, " ").replace(/\u00a0/g, " ");

  // 3. Dibujar estampa sin bordes
  page.drawText("FIRMADO DIGITALMENTE", { x: x + 4, y: y + stampHeight - 16, size: 8.5, font: helveticaBoldFont, color: rgb(0.12, 0.44, 0.73) });
  page.drawText(`Firmante: ${commonName}`, { x: x + 4, y: y + stampHeight - 28, size: 7.5, font: helveticaFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Fecha: ${rawDateString}`, { x: x + 4, y: y + stampHeight - 40, size: 7, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Emisor: ${issuerName}`, { x: x + 4, y: y + stampHeight - 52, size: 6.5, font: helveticaFont, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Serie: ${serialNumber}`, { x: x + 4, y: y + stampHeight - 64, size: 6.5, font: helveticaFont, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Firma Electrónica (Ecuador)`, { x: x + 4, y: y + stampHeight - 76, size: 6.5, font: helveticaBoldFont, color: rgb(0.0, 0.5, 0.2) });

  // 4. Agregar Placeholder para la firma criptográfica (esencial para node-signpdf)
  pdflibAddPlaceholder({
    pdfDoc,
    reason: "Firma Electrónica",
    location: "Ecuador",
    contactInfo: commonName,
    name: commonName,
  });
  
  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save());
  
  // 5. Inyectar firma CMS/PKCS#7 matemáticamente verificable
  const signer = new P12Signer(p12Buffer, { passphrase: password });
  const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);
  
  return signedPdf;
}

module.exports = { signElectronicDocument };

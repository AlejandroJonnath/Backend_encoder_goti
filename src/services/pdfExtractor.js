// Servicio compartido para extraer texto legible de un PDF usando pdf-parse
// Lo usan: translateService, audioService, detectService

const fs = require("fs");
const pdfParse = require("pdf-parse");

async function extractTextFromPDF(filePath) {
  // Leemos el archivo como buffer
  const dataBuffer = fs.readFileSync(filePath);

  // Parseamos el PDF
  const data = await pdfParse(dataBuffer);

  return data.text.trim();
}

module.exports = { extractTextFromPDF };

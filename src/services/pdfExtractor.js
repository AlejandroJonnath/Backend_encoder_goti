const fs = require("fs");
const pdfParse = require("pdf-parse");

/**
 * Extrae texto plano y metadatos de un archivo PDF utilizando pdf-parse localmente.
 * @param {string|Buffer} input - Ruta del archivo en disco o Buffer del PDF en memoria.
 * @returns {Promise<{text: string, numpages: number, info: object}>}
 */
async function extractTextFromPDF(input) {
  let dataBuffer;
  if (Buffer.isBuffer(input)) {
    dataBuffer = input;
  } else if (typeof input === "string") {
    dataBuffer = fs.readFileSync(input);
  } else {
    throw new Error("Entrada inválida para extractTextFromPDF. Se requiere ruta o Buffer.");
  }

  const data = await pdfParse(dataBuffer);
  return {
    text: data.text || "",
    numpages: data.numpages || 1,
    info: data.info || {},
  };
}

module.exports = { extractTextFromPDF };

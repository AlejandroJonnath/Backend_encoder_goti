// Servicio compartido para extraer texto legible de un PDF usando pdfjs-dist
// Lo usan: translateService, audioService, detectService

const fs = require("fs");
const path = require("path");

async function extractTextFromPDF(filePath) {
  // pdfjs-dist en Node requiere un canvas fake o usar el build legacy
  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

  // Leemos el archivo como buffer
  const data = new Uint8Array(fs.readFileSync(filePath));

  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Unimos los items de texto de la página, separando por saltos de línea
    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    fullText += pageText + "\n\n";
  }

  return fullText.trim();
}

module.exports = { extractTextFromPDF };

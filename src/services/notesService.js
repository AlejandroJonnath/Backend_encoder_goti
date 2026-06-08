// Servicio de notas: inyecta un cuadro de texto visible en una página específica del PDF
// Usa pdf-lib (ya instalado) sin ninguna API externa

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");

async function addNoteToPDF(inputPath, noteText, pageNumber) {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  const pageIndex = Math.max(0, Math.min(pageNumber - 1, pages.length - 1));
  const page = pages[pageIndex];

  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Dimensiones del cuadro de nota (sticky note amarilla)
  const boxWidth = 200;
  const boxHeight = 80;
  const margin = 20;
  const boxX = width - boxWidth - margin;
  const boxY = margin;

  // Fondo amarillo semitransparente de la nota
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 0.96, 0.6), // Amarillo sticky note
    opacity: 0.9,
    borderColor: rgb(0.8, 0.7, 0),
    borderWidth: 1.5,
  });

  // Encabezado "📝 NOTA"
  page.drawText("NOTA:", {
    x: boxX + 8,
    y: boxY + boxHeight - 18,
    size: 10,
    font,
    color: rgb(0.4, 0.3, 0),
  });

  // Texto de la nota (truncado si es muy largo, max ~120 chars)
  const truncated = noteText.length > 120 ? noteText.substring(0, 117) + "..." : noteText;
  
  // Dividimos en líneas de aprox 30 chars para que quepan en el cuadro
  const words = truncated.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > 30) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + " " + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  lines.slice(0, 3).forEach((line, i) => {
    page.drawText(line, {
      x: boxX + 8,
      y: boxY + boxHeight - 34 - i * 14,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0),
    });
  });

  const modifiedPdfBytes = await pdfDoc.save();
  return Buffer.from(modifiedPdfBytes);
}

module.exports = { addNoteToPDF };

// Controlador de Traducción: extrae texto del PDF, lo traduce con Gemini y genera un nuevo PDF
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { extractTextFromPDF } = require("../services/pdfExtractor");
const { translateText } = require("../services/translateService");

const translatePDF = async (req, res) => {
  let inputPath = null;
  try {
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo PDF." });
    }
    const targetLang = req.body.lang || "es";
    if (!["es", "en", "fr"].includes(targetLang)) {
      return res.status(400).json({ error: "Idioma no soportado. Usa: es, en, fr" });
    }

    inputPath = req.files.pdf[0].path;

    // 1. Extraer texto
    const originalText = await extractTextFromPDF(inputPath);
    if (!originalText.trim()) {
      return res.status(422).json({ error: "No se pudo extraer texto del PDF. Quizás es una imagen escaneada." });
    }

    // 2. Traducir con Gemini
    const translatedText = await translateText(originalText, targetLang);

    // 3. Generar nuevo PDF con el texto traducido
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const LANG_LABELS = { es: "Español", en: "English", fr: "Français" };
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 14;
    const maxWidth = pageWidth - margin * 2;
    const fontSize = 11;

    // Dividimos el texto traducido en líneas
    const paragraphs = translatedText.split("\n").filter(p => p.trim());
    let currentY = pageHeight - margin;
    let page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Encabezado en la primera página
    page.drawText(`Traducción al ${LANG_LABELS[targetLang]}`, {
      x: margin,
      y: currentY,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.3, 0.7),
    });
    currentY -= 30;

    for (const para of paragraphs) {
      // Dividimos el párrafo en líneas que quepan en el ancho de la página
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const testLine = line ? line + " " + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line) {
          // Chequeamos si necesitamos nueva página
          if (currentY < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          page.drawText(line, { x: margin, y: currentY, size: fontSize, font, color: rgb(0, 0, 0) });
          currentY -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (currentY < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y: currentY, size: fontSize, font, color: rgb(0, 0, 0) });
        currentY -= lineHeight;
      }
      currentY -= 6; // Espacio entre párrafos
    }

    const pdfBytes = await pdfDoc.save();

    const outputFilename = `translated_${targetLang}_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, "../../uploads", outputFilename);
    fs.writeFileSync(outputPath, pdfBytes);

    fs.unlink(inputPath, () => {});
    inputPath = null;

    const baseUrl = req.protocol + "://" + req.get("host");
    res.json({ url: `${baseUrl}/uploads/${outputFilename}` });

    setTimeout(() => fs.unlink(outputPath, () => {}), 10 * 60 * 1000);
  } catch (error) {
    console.error("Error al traducir:", error);
    if (inputPath) fs.unlink(inputPath, () => {});
    res.status(500).json({ error: error.message || "Error interno al traducir el PDF." });
  }
};

module.exports = { translatePDF };

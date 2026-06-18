// Controlador de Audio Libro: extrae texto del PDF y genera un archivo MP3
const fs = require("fs");
const path = require("path");
const { extractTextFromPDF } = require("../services/pdfExtractor");
const { generateAudioFromText } = require("../services/audioService");

const generateAudioBook = async (req, res) => {
  let inputPath = null;
  try {
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo PDF." });
    }
    const lang = req.body.lang || "es";

    inputPath = req.files.pdf[0].path;

    // 1. Extraer texto
    const text = await extractTextFromPDF(inputPath);
    if (!text.trim()) {
      return res.status(422).json({ error: "No se pudo extraer texto del PDF. Quizás es una imagen escaneada." });
    }

    // 2. Generar audio con Neural2
    const audioBuffer = await generateAudioFromText(text, lang);

    const outputFilename = `audiobook_${Date.now()}.mp3`;
    const outputPath = path.join(__dirname, "../../uploads", outputFilename);
    fs.writeFileSync(outputPath, audioBuffer);

    fs.unlink(inputPath, () => {});
    inputPath = null;

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const baseUrl = protocol + "://" + req.get("host");
    res.json({ url: `${baseUrl}/uploads/${outputFilename}` });

    // Limpiamos después de 30 minutos (el archivo es grande, el usuario necesita más tiempo)
    setTimeout(() => fs.unlink(outputPath, () => {}), 30 * 60 * 1000);
  } catch (error) {
    console.error("Error al generar audio libro:", error);
    if (inputPath) fs.unlink(inputPath, () => {});
    res.status(500).json({ error: error.message || "Error interno al generar el audio libro." });
  }
};

module.exports = { generateAudioBook };

// Controlador de Notas: recibe el PDF y la nota, inserta el cuadro y devuelve el PDF modificado
const fs = require("fs");
const path = require("path");
const { addNoteToPDF } = require("../services/notesService");

const addNote = async (req, res) => {
  let inputPath = null;
  try {
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo PDF." });
    }
    const { noteText, pageNumber } = req.body;
    if (!noteText || !noteText.trim()) {
      return res.status(400).json({ error: "El texto de la nota no puede estar vacío." });
    }

    inputPath = req.files.pdf[0].path;
    const page = parseInt(pageNumber, 10) || 1;

    const modifiedPdfBuffer = await addNoteToPDF(inputPath, noteText.trim(), page);

    const outputFilename = `noted_${Date.now()}_${req.files.pdf[0].filename}`;
    const outputPath = path.join(__dirname, "../../uploads", outputFilename);
    fs.writeFileSync(outputPath, modifiedPdfBuffer);

    fs.unlink(inputPath, () => {});
    inputPath = null;

    const baseUrl = req.protocol + "://" + req.get("host");
    res.json({ url: `${baseUrl}/uploads/${outputFilename}` });

    setTimeout(() => fs.unlink(outputPath, () => {}), 5 * 60 * 1000);
  } catch (error) {
    console.error("Error al añadir nota:", error);
    if (inputPath) fs.unlink(inputPath, () => {});
    res.status(500).json({ error: error.message || "Error interno al añadir la nota." });
  }
};

module.exports = { addNote };

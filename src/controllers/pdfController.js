const fs = require("fs");
const path = require("path");
const { compressPDFService, mergePDFService } = require("../services/pdfService");

const compressPDF = async (req, res) => {
  try {
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo PDF." });
    }

    const file = req.files.pdf[0];
    const inputPath = file.path;
    const outputFilename = `compressed_${Date.now()}_${file.filename}`;
    const outputPath = path.join(__dirname, "../../uploads", outputFilename);

    await compressPDFService(inputPath, outputPath);

    // Limpiamos el archivo de entrada inmediatamente
    fs.unlink(inputPath, () => {});

    // Devolvemos la URL para que el cliente lo descargue
    const baseUrl = req.protocol + "://" + req.get("host");
    const fileUrl = `${baseUrl}/uploads/${outputFilename}`;

    res.json({ url: fileUrl });

    // Programamos limpieza del archivo final en 5 minutos
    setTimeout(() => {
      fs.unlink(outputPath, () => {});
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error("Error al comprimir:", error);
    if (req.files && req.files.pdf) {
      fs.unlink(req.files.pdf[0].path, () => {});
    }
    res.status(500).json({ error: error.message || "Error interno al comprimir PDF." });
  }
};

const mergePDF = async (req, res) => {
  try {
    if (!req.files || !req.files.pdfs || req.files.pdfs.length < 2) {
      return res.status(400).json({ error: "Se requieren al menos 2 archivos PDF para unir." });
    }

    const inputPaths = req.files.pdfs.map(f => f.path);
    const outputFilename = `merged_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, "../../uploads", outputFilename);

    await mergePDFService(inputPaths, outputPath);

    // Limpiamos los archivos de entrada inmediatamente
    inputPaths.forEach(p => fs.unlink(p, () => {}));

    // Devolvemos la URL para que el cliente lo descargue
    const baseUrl = req.protocol + "://" + req.get("host");
    const fileUrl = `${baseUrl}/uploads/${outputFilename}`;

    res.json({ url: fileUrl });

    // Programamos limpieza del archivo final en 5 minutos
    setTimeout(() => {
      fs.unlink(outputPath, () => {});
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error("Error al unir:", error);
    if (req.files && req.files.pdfs) {
      req.files.pdfs.forEach(f => fs.unlink(f.path, () => {}));
    }
    res.status(500).json({ error: error.message || "Error interno al unir PDFs." });
  }
};

module.exports = {
  compressPDF,
  mergePDF
};

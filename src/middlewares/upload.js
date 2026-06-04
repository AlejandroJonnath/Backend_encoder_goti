const multer = require("multer");
const path = require("path");

// Configuración para almacenamiento en memoria (para firmas, donde los PDFs suelen ser pequeños y requerimos el buffer rápido)
const memoryUpload = multer({ storage: multer.memoryStorage() });

const fs = require("fs");

// Asegurar que el directorio de subidas exista (importante para Render u otros servidores)
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración para almacenamiento en disco (para compresión y unión, con límite de 200MB)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".pdf");
  },
});

const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // Límite de 200 MB por archivo
});

module.exports = {
  memoryUpload,
  diskUpload,
};

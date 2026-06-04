const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Determinar el comando de Ghostscript según el SO
const getGhostscriptCommand = () => {
  if (os.platform() === "win32") {
    // Rutas más comunes de instalación en Windows
    const candidates = [
      "C:\\Program Files\\gs\\gs10.03.0\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe",
      "C:\\Program Files\\gs\\gs9.56.1\\bin\\gswin64c.exe",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return "gswin64c"; // fallback si está en el PATH del sistema
  }
  // En Linux (Render, Docker, etc.) Ghostscript se instala con apt-get como 'gs'
  return "gs";
};

const compressPDFService = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const gs = getGhostscriptCommand();

    // -dPDFSETTINGS=/screen: compresión máxima (imágenes a ~72dpi)
    // Si se prefiere mejor calidad pero menos compresión usar /ebook (150dpi)
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dPDFSETTINGS=/screen",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath
    ];

    const proc = spawn(gs, args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Ghostscript no encontrado. ¿Está instalado? Detalle: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Ghostscript error al comprimir (código ${code}): ${stderr}`));
      }
    });
  });
};

const mergePDFService = (inputPaths, outputPath) => {
  return new Promise((resolve, reject) => {
    const gs = getGhostscriptCommand();

    const args = [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=pdfwrite",
      `-sOutputFile=${outputPath}`,
      ...inputPaths
    ];

    const proc = spawn(gs, args);
    let stderr = "";

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`Ghostscript no encontrado. ¿Está instalado? Detalle: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Ghostscript error al unir (código ${code}): ${stderr}`));
      }
    });
  });
};

module.exports = {
  compressPDFService,
  mergePDFService
};

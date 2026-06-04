// Este archivo define las rutas HTTP para las herramientas de procesamiento de PDFs,
// su trabajo es recibir las peticiones que lleguen a /api/pdf/compress y /api/pdf/merge,
// aplicar el middleware de Multer para que los archivos se guarden en disco antes de llegar al controlador,
// y finalmente llamar al controlador correspondiente que hace la lógica de negocio,
// este archivo no contiene lógica de procesamiento; solo conecta URLs con middlewares y controladores (patrón de enrutamiento modular de Express)

const express = require("express"); // Express es el framework web del servidor; lo necesitamos aquí para crear un Router independiente (un mini-servidor de rutas que luego server.js monta bajo /api/pdf)
const router = express.Router(); // Router nos permite definir rutas en un archivo separado sin tener que tenerlas todas en server.js; server.js luego monta este router bajo el prefijo /api/pdf
const { diskUpload } = require("../middlewares/upload"); // Importamos la configuración de Multer con almacenamiento en disco; la usamos aquí porque compress y merge trabajan con archivos grandes que no caben bien en memoria RAM
const { compressPDF, mergePDF } = require("../controllers/pdfController"); // Importamos los dos controladores que contienen la lógica para comprimir y unir PDFs

router.post(
  "/compress", // Ruta completa cuando está montado en server.js: POST /api/pdf/compress; el cliente llama aquí para comprimir un PDF
  diskUpload.fields([{ name: "pdf", maxCount: 1 }]), // Middleware de Multer: espera exactamente un archivo en el campo llamado "pdf"; lo guarda en disco antes de que la petición llegue al controlador compressPDF
  compressPDF // Función controladora que valida el archivo, lo manda a comprimir con Ghostscript y responde con la URL de descarga
);

router.post(
  "/merge", // Ruta completa: POST /api/pdf/merge; el cliente llama aquí para unir varios PDFs en uno
  diskUpload.fields([{ name: "pdfs", maxCount: 20 }]), // permitimos hasta 20 PDFs a la vez; Multer espera uno o más archivos en el campo "pdfs" (nombre en plural porque son múltiples); los guarda todos en disco antes de llegar al controlador
  mergePDF // Función controladora que valida que llegaron al menos 2 archivos, los manda a unir con Ghostscript y responde con la URL del PDF resultante
);

module.exports = router; // Exportamos el router para que server.js lo pueda importar y montar bajo el prefijo /api/pdf

// si quitas la ruta de /compress pasa que cualquier petición al botón de comprimir en el frontend recibirá un error 404 (ruta no encontrada) y la herramienta dejará de funcionar completamente,
// para solucionar esto vuelve a agregar router.post("/compress", diskUpload.fields([{ name: "pdf", maxCount: 1 }]), compressPDF)

// si quitas la ruta de /merge pasa que la herramienta de unión dejará de responder con un 404,
// para solucionar esto vuelve a agregar router.post("/merge", diskUpload.fields([{ name: "pdfs", maxCount: 20 }]), mergePDF)

// si quitas diskUpload.fields(...) de cualquiera de las rutas pasa que req.files llegará vacío o undefined al controlador porque nadie habrá procesado los archivos del formulario; el controlador rechazará la petición con un error 400,
// para solucionar esto vuelve a agregar el middleware diskUpload.fields(...) entre la ruta y el controlador

// si quitas el module.exports del router pasa que server.js no podrá importar este archivo y lanzará un error "Cannot find module" o similar al arrancar,
// para solucionar esto vuelve a agregar module.exports = router al final del archivo

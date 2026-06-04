// Este archivo define la ruta HTTP para la firma electrónica de documentos PDF,
// su trabajo es recibir las peticiones que lleguen a /api/sign (que en server.js está montado como POST /api/sign),
// aplicar el middleware de Multer en memoria para recibir el PDF a firmar y el certificado P12 del usuario,
// y luego llamar al controlador signDocument que hace toda la lógica de firma,
// igual que pdfRoutes.js, este archivo solo conecta la URL con su middleware y controlador sin tener lógica propia

const express = require("express"); // Necesitamos Express para poder crear un Router separado y mantener las rutas organizadas en su propio archivo
const router = express.Router(); // Creamos un mini-enrutador de Express que luego server.js montará bajo el prefijo /api/sign
const { memoryUpload } = require("../middlewares/upload"); // Importamos la configuración de Multer en memoria (no en disco); para la firma usamos memoria porque los PDFs a firmar suelen ser pequeños y necesitamos acceder al buffer directamente en RAM para procesarlos
const { signDocument } = require("../controllers/signController"); // Importamos el controlador que contiene toda la lógica de firma electrónica (extracción del certificado, dibujo del sello visual y firma criptográfica)

router.post(
  "/", // Ruta completa cuando está montado en server.js: POST /api/sign; el cliente llama aquí enviando el PDF y el certificado P12
  memoryUpload.fields([ // Middleware de Multer en memoria que espera exactamente dos archivos en la misma petición
    { name: "pdf", maxCount: 1 }, // Campo "pdf": el documento PDF que el usuario quiere firmar digitalmente
    { name: "p12", maxCount: 1 } // Campo "p12": el certificado de firma electrónica del usuario (un archivo binario con extensión .p12 que contiene la clave privada y el certificado público)
  ]),
  signDocument // Controlador que toma los archivos en memoria, extrae los datos del certificado, dibuja el sello visual en el PDF y aplica la firma criptográfica PKCS#7
);

module.exports = router; // Exportamos el router para que server.js lo pueda importar y montar bajo /api/sign

// si quitas la ruta router.post("/", ..., signDocument) pasa que ninguna petición de firma llegará a ser procesada y el cliente recibirá un 404; toda la funcionalidad de firma electrónica quedará inoperativa,
// para solucionar esto vuelve a agregar la ruta con los tres parámetros: la ruta "/" (raíz del router), el middleware memoryUpload.fields con los dos campos (pdf y p12), y el controlador signDocument

// si quitas memoryUpload.fields de la ruta pasa que req.files estará vacío cuando llegue al controlador y el servidor responderá con un error 400 porque no encontrará el PDF ni el P12,
// para solucionar esto vuelve a agregar memoryUpload.fields([{ name: "pdf", maxCount: 1 }, { name: "p12", maxCount: 1 }]) como segundo argumento de router.post

// si cambias memoryUpload por diskUpload pasa que los archivos se guardarán en disco en lugar de RAM; el controlador de firma usa file.buffer directamente (no file.path) así que fallará con un error "Cannot read property 'buffer' of undefined",
// para solucionar esto vuelve a usar memoryUpload que es la única configuración compatible con la firma

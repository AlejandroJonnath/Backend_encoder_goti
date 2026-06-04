// Este archivo es el controlador de las herramientas PDF (el intermediario entre las rutas HTTP y el servicio de Ghostscript),
// su responsabilidad es recibir las peticiones del cliente (la app móvil), validar que los archivos llegaron correctamente,
// pedirle al servicio de Ghostscript que haga el procesamiento pesado, construir la URL pública del archivo resultante y responderle al cliente con esa URL,
// también se encarga de limpiar los archivos temporales del disco para que el servidor no se llene de basura: los archivos de entrada se borran inmediatamente después del procesamiento, y el archivo de salida se borra automáticamente 5 minutos después de que el cliente lo descargó

const fs = require("fs"); // fs se usa para borrar los archivos temporales del disco una vez que ya no son necesarios (tanto los archivos de entrada como los de salida)
const path = require("path"); // path se usa para construir la ruta absoluta donde se guardará el PDF procesado dentro de la carpeta uploads
const { compressPDFService, mergePDFService } = require("../services/pdfService"); // Importamos las dos funciones del servicio de Ghostscript; compressPDFService comprime un PDF y mergePDFService une varios en uno

// Controlador que maneja la petición POST /api/pdf/compress; recibe un PDF del cliente, lo comprime con Ghostscript y responde con la URL del archivo comprimido
const compressPDF = async (req, res) => {
  try {
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo PDF." }); // Si el cliente no envió ningún archivo en el campo "pdf" del formulario respondemos con un error 400 (Bad Request) explicando el problema antes de intentar procesar nada
    }

    const file = req.files.pdf[0]; // Tomamos el primer (y único) archivo del campo "pdf"; Multer ya lo guardó en disco y nos da un objeto con sus metadatos (ruta en disco, nombre original, tamaño, etc.)
    const inputPath = file.path; // La ruta completa donde Multer guardó el archivo temporal en la carpeta uploads (ejemplo: uploads/pdf-1717000000000-123456789.pdf)
    const outputFilename = `compressed_${Date.now()}_${file.filename}`; // Generamos un nombre único para el archivo de salida combinando el prefijo "compressed_", la fecha actual y el nombre que Multer le dio al archivo de entrada, así evitamos colisiones si dos usuarios comprimen al mismo tiempo
    const outputPath = path.join(__dirname, "../../uploads", outputFilename); // Construimos la ruta absoluta completa donde Ghostscript debe guardar el PDF comprimido resultante

    await compressPDFService(inputPath, outputPath); // Le pedimos al servicio de Ghostscript que comprima el PDF; usamos await porque es una operación asíncrona que puede tardar varios segundos con archivos grandes

    // Limpiamos el archivo de entrada inmediatamente
    fs.unlink(inputPath, () => {}); // Borramos el archivo original que subió el usuario del disco tan pronto como Ghostscript termina de procesarlo; ya no necesitamos el original porque el comprimido es el que le vamos a entregar al cliente; el callback vacío () => {} hace que los errores de borrado (si los hay) se ignoren silenciosamente sin romper el flujo

    // Devolvemos la URL para que el cliente lo descargue
    const baseUrl = req.protocol + "://" + req.get("host"); // Construimos la URL base del servidor (ejemplo: "https://backend-encoder-goti.onrender.com") usando el protocolo (http/https) y el host de la petición entrante; de esta forma la URL funciona tanto en desarrollo local como en producción
    const fileUrl = `${baseUrl}/uploads/${outputFilename}`; // Construimos la URL completa donde el cliente puede descargar el PDF comprimido (ejemplo: "https://backend-encoder-goti.onrender.com/uploads/compressed_1717000000000_pdf-xxx.pdf")

    res.json({ url: fileUrl }); // Respondemos al cliente con un JSON que contiene la URL de descarga; el frontend hará un downloadAsync a esa URL para guardar el archivo en el dispositivo del usuario

    // Programamos limpieza del archivo final en 5 minutos
    setTimeout(() => {
      fs.unlink(outputPath, () => {}); // Después de 5 minutos (300,000 milisegundos) borramos el archivo comprimido del servidor; le damos 5 minutos para que el cliente tenga tiempo suficiente de descargarlo incluso con una conexión lenta
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error("Error al comprimir:", error); // Registramos el error completo en los logs del servidor para facilitar el diagnóstico en caso de fallo
    if (req.files && req.files.pdf) {
      fs.unlink(req.files.pdf[0].path, () => {}); // Si algo salió mal también intentamos borrar el archivo de entrada para no dejarlo huérfano en el disco; lo hacemos con try implícito (callback vacío) para no generar un segundo error si el archivo ya no existe
    }
    res.status(500).json({ error: error.message || "Error interno al comprimir PDF." }); // Respondemos al cliente con un error 500 (Internal Server Error) incluyendo el mensaje del error para que el frontend pueda mostrárselo al usuario
  }
};

// Controlador que maneja la petición POST /api/pdf/merge; recibe múltiples PDFs del cliente, los une con Ghostscript y responde con la URL del archivo resultante
const mergePDF = async (req, res) => {
  try {
    if (!req.files || !req.files.pdfs || req.files.pdfs.length < 2) {
      return res.status(400).json({ error: "Se requieren al menos 2 archivos PDF para unir." }); // Validamos que el cliente envió al menos 2 archivos en el campo "pdfs"; unir un solo PDF no tiene sentido y rechazamos la petición antes de gastar recursos
    }

    const inputPaths = req.files.pdfs.map(f => f.path); // Extraemos las rutas en disco de todos los archivos recibidos usando map; Multer ya guardó cada uno en la carpeta uploads y nos da sus metadatos en el array req.files.pdfs
    const outputFilename = `merged_${Date.now()}.pdf`; // Nombre único para el archivo de salida combinando el prefijo "merged_" con la fecha actual en milisegundos
    const outputPath = path.join(__dirname, "../../uploads", outputFilename); // Ruta absoluta completa donde Ghostscript guardará el PDF unido

    await mergePDFService(inputPaths, outputPath); // Le pasamos al servicio la lista de rutas de los PDFs de entrada y la ruta de salida; Ghostscript los concatenará en el orden en que los recibió

    // Limpiamos los archivos de entrada inmediatamente
    inputPaths.forEach(p => fs.unlink(p, () => {})); // Borramos cada uno de los archivos de entrada del disco tan pronto como la unión termina; ya no son necesarios porque el PDF unido es el producto final

    // Devolvemos la URL para que el cliente lo descargue
    const baseUrl = req.protocol + "://" + req.get("host"); // Construimos la URL base del servidor igual que en compressPDF
    const fileUrl = `${baseUrl}/uploads/${outputFilename}`; // URL completa para descargar el PDF unido

    res.json({ url: fileUrl }); // Enviamos la URL al frontend para que lo descargue en el dispositivo del usuario

    // Programamos limpieza del archivo final en 5 minutos
    setTimeout(() => {
      fs.unlink(outputPath, () => {}); // Borramos el PDF unido del servidor después de 5 minutos para mantener limpio el disco
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error("Error al unir:", error); // Registramos el error en los logs del servidor
    if (req.files && req.files.pdfs) {
      req.files.pdfs.forEach(f => fs.unlink(f.path, () => {})); // Si algo falló durante la unión borramos todos los archivos de entrada que habían llegado para no dejarlos acumulados en el disco
    }
    res.status(500).json({ error: error.message || "Error interno al unir PDFs." }); // Respondemos al cliente con el error para que pueda informarle al usuario qué pasó
  }
};

module.exports = {
  compressPDF, // Exportamos el controlador de compresión para que pdfRoutes.js lo pueda asignar a la ruta POST /compress
  mergePDF // Exportamos el controlador de unión para que pdfRoutes.js lo pueda asignar a la ruta POST /merge
};

// si quitas compressPDF pasa que la ruta POST /api/pdf/compress no tendrá controlador y Express lanzará un error al intentar registrar la ruta en pdfRoutes.js,
// para solucionar esto vuelve a crear la función async con el mismo nombre, validando req.files.pdf, llamando a compressPDFService y respondiendo con res.json({ url })

// si quitas mergePDF pasa lo mismo pero para la ruta POST /api/pdf/merge; ningún usuario podrá unir PDFs,
// para solucionar esto vuelve a crear la función validando que lleguen al menos 2 archivos en req.files.pdfs, llamando a mergePDFService y respondiendo con la URL

// si quitas los fs.unlink de limpieza pasa que el servidor irá acumulando archivos en la carpeta uploads indefinidamente y con el tiempo llenará el disco del servidor (especialmente crítico en planes gratuitos de Render con disco limitado),
// para solucionar esto vuelve a agregar fs.unlink para los archivos de entrada inmediatamente después del procesamiento y un setTimeout de 5 minutos para el archivo de salida

// si quitas el setTimeout de limpieza del archivo de salida pasa que el cliente podría intentar descargar el archivo y encontrarlo ya borrado; el setTimeout de 5 minutos es el balance entre no llenar el disco y darle tiempo suficiente al cliente para descargar,
// para solucionar esto vuelve a agregar el setTimeout con 5 * 60 * 1000 milisegundos

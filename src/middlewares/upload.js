// Este archivo configura y exporta dos versiones de Multer (la librería que maneja la recepción de archivos en el servidor),
// una versión guarda los archivos directamente en la memoria RAM del servidor (útil para archivos pequeños que se procesan al instante como las firmas),
// y la otra versión los guarda en el disco duro en una carpeta temporal llamada "uploads" (necesario para archivos pesados de hasta 200MB como los PDFs que se comprimen o unen),
// también se encarga de crear esa carpeta "uploads" si no existe cuando el servidor arranca (especialmente importante en entornos de producción como Render o Docker donde la carpeta no viene incluida)

const multer = require("multer"); // Multer es el middleware especializado en recibir archivos enviados mediante formularios multipart/form-data (el formato estándar para subir archivos desde una app o web)
const path = require("path"); // path nos ayuda a construir rutas de carpetas de forma segura sin importar si el servidor corre en Windows (barras invertidas) o Linux (barras normales)

// Configuración para almacenamiento en memoria (para firmas, donde los PDFs suelen ser pequeños y requerimos el buffer rápido)
const memoryUpload = multer({ storage: multer.memoryStorage() }); // Con memoryStorage los archivos recibidos se guardan como buffers en la RAM del servidor, esto es ideal para la firma porque el archivo se procesa y se devuelve inmediatamente sin necesidad de tocarlo desde el disco

const fs = require("fs"); // fs (File System) es el módulo nativo de Node para manejar operaciones sobre archivos y carpetas como crear, leer, borrar o verificar si existen

// Asegurar que el directorio de subidas exista (importante para Render u otros servidores)
const uploadsDir = path.join(__dirname, "../../uploads"); // Construimos la ruta absoluta a la carpeta "uploads" que estará en la raíz del proyecto (dos niveles arriba desde src/middlewares/)
if (!fs.existsSync(uploadsDir)) { // Verificamos si la carpeta "uploads" ya existe en el sistema de archivos
  fs.mkdirSync(uploadsDir, { recursive: true }); // Si no existe la creamos automáticamente; el flag recursive:true permite crear todas las carpetas intermedias necesarias si tampoco existen
}

// Configuración para almacenamiento en disco (para compresión y unión, con límite de 200MB)
const diskStorage = multer.diskStorage({ // diskStorage le dice a Multer que guarde los archivos físicamente en el disco duro en lugar de la memoria RAM
  destination: function (req, file, cb) {
    cb(null, uploadsDir); // Le indicamos a Multer dónde guardar cada archivo que llegue; usamos la variable uploadsDir que ya calculamos y verificamos arriba
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9); // Generamos un sufijo único combinando la fecha actual en milisegundos con un número aleatorio grande para evitar que dos archivos con el mismo nombre original se sobreescriban entre sí
    cb(null, file.fieldname + "-" + uniqueSuffix + ".pdf"); // El nombre final en disco queda como por ejemplo "pdf-1717000000000-123456789.pdf" (no tiene relación con el nombre original del usuario, eso se maneja en el frontend al momento de descargar)
  },
});

const diskUpload = multer({
  storage: diskStorage, // Usamos la configuración de disco que definimos arriba
  limits: { fileSize: 200 * 1024 * 1024 }, // Límite de 200 MB por archivo (equivalente a plataformas premium como iLovePDF); si alguien intenta subir un archivo más grande Multer lo rechazará automáticamente con un error antes de llegar al controlador
});

module.exports = {
  memoryUpload, // Exportamos la configuración de memoria para que las rutas de firma la puedan usar directamente
  diskUpload, // Exportamos la configuración de disco para que las rutas de compresión y unión la puedan usar directamente
};

// si quitas memoryUpload pasa que las rutas de firma electrónica no podrán recibir el PDF ni el archivo P12 y el servidor lanzará un error al intentar acceder a req.files,
// para solucionar esto vuelve a crear un multer con multer.memoryStorage() y expórtalo con el mismo nombre

// si quitas diskUpload pasa que las rutas de comprimir y unir PDFs no podrán recibir los archivos del cliente y el servidor fallará sin llegar siquiera al controlador,
// para solucionar esto vuelve a crear un multer con multer.diskStorage() apuntando a la carpeta uploads y con el límite de tamaño

// si quitas el bloque if (!fs.existsSync(uploadsDir)) con el mkdirSync pasa que en un servidor limpio como Render o un contenedor Docker el servidor arrancará correctamente pero cuando intente guardar el primer archivo fallará porque la carpeta uploads no existe,
// para solucionar esto vuelve a agregar ese bloque antes de la definición de diskStorage

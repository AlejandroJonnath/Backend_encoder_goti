// Este archivo es el punto de entrada principal del servidor (el archivo que Node.js ejecuta primero cuando arranca la aplicación),
// su trabajo es crear la aplicación Express, activar los permisos de CORS para que el frontend pueda hablar con este servidor desde cualquier origen,
// registrar todas las rutas disponibles (firmas y PDFs) y finalmente encender el servidor en un puerto específico para que empiece a escuchar peticiones

const express = require("express"); // Express es el framework que nos permite crear rutas, manejar peticiones HTTP y responder con datos o archivos
require("dotenv").config(); // Cargar variables de entorno desde el archivo .env
const cors = require("cors"); // CORS (Cross-Origin Resource Sharing) permite que el frontend (que corre en otro dominio o puerto) pueda hacer peticiones a este servidor sin que el navegador las bloquee por seguridad
const fs = require("fs"); // Módulo nativo de Node para trabajar con el sistema de archivos (leer, escribir, borrar archivos y carpetas)
const app = express(); // Creamos la instancia principal de la aplicación Express, todo lo que configuremos sobre "app" define el comportamiento del servidor
app.use(cors()); // Activamos CORS de manera global para que todas las rutas del servidor acepten peticiones de cualquier origen (importante para la app móvil Expo)

const signRoutes = require("./src/routes/signRoutes"); // Importamos el enrutador que contiene todas las rutas relacionadas con la firma electrónica de documentos PDF
const pdfRoutes = require("./src/routes/pdfRoutes"); // Importamos el enrutador que contiene las rutas para comprimir PDFs y unir varios PDFs en uno solo
const notesRoutes = require("./src/routes/notesRoutes"); // Rutas para añadir notas a PDFs
const translateRoutes = require("./src/routes/translateRoutes"); // Rutas para traducir PDFs
const detectRoutes = require("./src/routes/detectRoutes"); // Rutas para detectores de IA y Plagio
const path = require("path"); // Módulo nativo de Node para construir rutas de archivos de manera segura y compatible con cualquier sistema operativo (Windows, Linux, Mac)

// Rutas
app.use("/api/sign", signRoutes); // Registramos el enrutador de firmas bajo la ruta base "/api/sign", cualquier petición que llegue a esa ruta será manejada por signRoutes
app.use("/api/pdf", pdfRoutes); // Registramos el enrutador de PDFs bajo "/api/pdf", dentro de él se definen sub-rutas como "/compress" y "/merge"
app.use("/api/notes", notesRoutes); // Registramos el enrutador de notas
app.use("/api/translate", translateRoutes); // Registramos el enrutador de traducción
app.use("/api/detect", detectRoutes); // Registramos el enrutador de detección

// Servir la carpeta uploads para que los PDFs puedan ser descargados por el cliente
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Exponemos la carpeta "uploads" como una ruta estática pública, de esta forma cuando el controlador guarda un PDF procesado ahí, el cliente puede descargarlo directamente con una URL del tipo http://servidor/uploads/archivo.pdf

const PORT = process.env.PORT || 3000; // Leemos el puerto desde la variable de entorno "PORT" que Render (o cualquier servidor de producción) inyecta automáticamente; si no existe esa variable usamos el puerto 3000 como valor por defecto para desarrollo local
app.listen(PORT, () => {
  console.log(`Servidor de Firmas EC corriendo en el puerto ${PORT}`); // Mensaje en consola que confirma que el servidor arrancó correctamente y en qué puerto está escuchando
});

// si quitas el app.use(cors()) pasa que el frontend va a recibir errores de "CORS policy" cada vez que intente hacer una petición y ninguna herramienta funcionará,
// para solucionar esto solo vuelve a agregar app.use(cors()) antes de registrar las rutas

// si quitas app.use("/api/sign", signRoutes) pasa que todas las peticiones de firma electrónica devolverán un error 404 (ruta no encontrada) y la herramienta de firma quedará completamente inservible,
// para solucionar esto vuelve a agregar esa línea apuntando al archivo src/routes/signRoutes.js

// si quitas app.use("/api/pdf", pdfRoutes) pasa que las herramientas de comprimir y unir PDFs dejarán de responder y devolverán 404,
// para solucionar esto vuelve a agregar esa línea apuntando al archivo src/routes/pdfRoutes.js

// si quitas app.use("/uploads", express.static(...)) pasa que el cliente recibirá la URL del archivo procesado pero al intentar descargarlo obtendrá un error 404 porque el servidor ya no expondrá esa carpeta públicamente,
// para solucionar esto vuelve a agregar esa línea; la ruta debe apuntar a la carpeta "uploads" en la raíz del proyecto

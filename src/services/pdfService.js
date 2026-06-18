// Este archivo contiene la lógica pura de procesamiento de PDFs usando Ghostscript (un programa externo nativo muy potente para manipular documentos PDF),
// su trabajo es detectar automáticamente en qué sistema operativo está corriendo el servidor para saber qué comando de Ghostscript ejecutar,
// luego expone dos funciones principales: una para comprimir un PDF reduciendo drásticamente su tamaño, y otra para unir varios PDFs en un solo documento,
// ambas funciones lanzan un proceso hijo (subprocess) de Ghostscript en segundo plano y esperan a que termine antes de responder,
// este archivo no sabe nada del servidor web ni de las rutas HTTP, solo se enfoca en el procesamiento de archivos (separación de responsabilidades)

const { spawn } = require("child_process"); // spawn nos permite lanzar procesos externos del sistema operativo desde Node.js (en este caso Ghostscript) como si los ejecutáramos desde una terminal, de forma asíncrona sin bloquear el servidor
const fs = require("fs"); // fs se usa aquí para verificar con existsSync si los archivos ejecutables de Ghostscript existen en rutas específicas del disco de Windows
const os = require("os"); // os nos dice información del sistema operativo donde corre el servidor; usamos os.platform() para saber si es Windows ("win32") o Linux ("linux")
const path = require("path"); // path se importa para manejar rutas de archivos aunque en este archivo su uso es indirecto a través de las rutas que se pasan como argumentos a Ghostscript

// Función interna que detecta el sistema operativo y devuelve el comando correcto para ejecutar Ghostscript
const getGhostscriptCommand = () => {
  if (os.platform() === "win32") { // Si el servidor está corriendo en Windows (útil para desarrollo local)
    // Rutas más comunes de instalación en Windows
    const candidates = [ // Lista de rutas donde Ghostscript suele instalarse en Windows dependiendo de la versión
      "C:\\Program Files\\gs\\gs10.03.0\\bin\\gswin64c.exe", // Ruta de la versión 10.03.0 de Ghostscript para Windows 64 bits (la que instalamos en este proyecto)
      "C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe", // Ruta alternativa para versiones ligeramente anteriores
      "C:\\Program Files\\gs\\gs9.56.1\\bin\\gswin64c.exe", // Ruta para versiones más antiguas por si alguien tiene una instalación previa
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p; // Recorremos la lista una por una y devolvemos la primera ruta que exista en el disco; así el servidor funciona sin importar qué versión exacta de Ghostscript esté instalada
    }
    return "gswin64c"; // fallback si está en el PATH del sistema; si ninguna ruta de la lista existe, intentamos llamarlo directamente por nombre (esto funciona si el usuario lo agregó manualmente a las variables de entorno de Windows)
  }
  // En Linux (Render, Docker, etc.) Ghostscript se instala con apt-get como 'gs'
  return "gs"; // En Linux el ejecutable simplemente se llama "gs" y está disponible globalmente después de instalarlo con "apt-get install ghostscript" (que hacemos en el Dockerfile)
};

// Función que recibe la ruta de un PDF de entrada y una ruta de salida, comprime el PDF usando Ghostscript y resuelve la promesa cuando termina
const compressPDFService = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => { // Devolvemos una Promise porque el proceso de Ghostscript es asíncrono; el controlador esperará (con await) a que esta promesa se resuelva o rechace antes de continuar
    const gs = getGhostscriptCommand(); // Obtenemos el comando correcto de Ghostscript para este sistema operativo

    // -dPDFSETTINGS=/screen: compresión máxima (imágenes a ~72dpi)
    // Si se prefiere mejor calidad pero menos compresión usar /ebook (150dpi)
    const args = [ // Lista de argumentos que le pasamos a Ghostscript para definir cómo debe comprimir el archivo
      "-sDEVICE=pdfwrite", // Le decimos a Ghostscript que el dispositivo de salida (formato de salida) es PDF
      "-dCompatibilityLevel=1.4", // Establecemos la versión de compatibilidad del PDF de salida en 1.4 (compatible con prácticamente todos los lectores de PDF)
      "-dPDFSETTINGS=/screen", // Nivel de compresión máximo; "/screen" optimiza para pantalla reduciendo imágenes a 72dpi y comprimiendo fuentes agresivamente (ideal para bajar de 150MB a unos pocos MB)
      "-dColorImageDownsampleType=/Subsample", // OPTIMIZACIÓN: Acelera enormemente la compresión usando subsample en lugar de bicubic
      "-dGrayImageDownsampleType=/Subsample", // OPTIMIZACIÓN: Igual para imágenes en escala de grises
      "-dMonoImageDownsampleType=/Subsample", // OPTIMIZACIÓN: Igual para imágenes monocromáticas
      "-dColorConversionStrategy=/LeaveColorUnchanged", // OPTIMIZACIÓN: Evita conversiones de perfil de color pesadas que toman mucho tiempo
      "-dNumRenderingThreads=4", // OPTIMIZACIÓN: Usa múltiples hilos de CPU para acelerar
      "-dNOPAUSE", // Le decimos a Ghostscript que no pause ni pida confirmación entre páginas durante el procesamiento
      "-dQUIET", // Suprime la mayor parte de los mensajes de salida de Ghostscript para que no llenen los logs del servidor con información irrelevante
      "-dBATCH", // Indica que Ghostscript debe salir automáticamente cuando termine de procesar, sin esperar input del usuario (esencial para procesos automáticos)
      `-sOutputFile=${outputPath}`, // Ruta completa donde Ghostscript debe guardar el PDF comprimido resultante
      inputPath // Ruta del archivo PDF original que queremos comprimir (el que subió el usuario)
    ];

    const proc = spawn(gs, args); // Lanzamos Ghostscript como un proceso hijo del sistema operativo pasándole el comando y todos los argumentos; esto no bloquea el servidor mientras se ejecuta
    let stderr = ""; // Variable acumuladora donde iremos guardando cualquier mensaje de error que Ghostscript envíe a su canal de errores estándar

    proc.stderr.on("data", (data) => {
      stderr += data.toString(); // Cada vez que Ghostscript escribe algo en su canal de errores (stderr) lo convertimos a texto y lo acumulamos en la variable stderr para poder mostrarlo si algo falla
    });

    proc.on("error", (err) => {
      reject(new Error(`Ghostscript no encontrado. ¿Está instalado? Detalle: ${err.message}`)); // Este evento se dispara cuando Node no pudo siquiera lanzar el proceso (por ejemplo si Ghostscript no está instalado o el comando no existe); en ese caso rechazamos la promesa con un mensaje claro
    });

    proc.on("close", (code) => { // Este evento se dispara cuando Ghostscript termina su ejecución, con o sin error
      if (code === 0) {
        resolve(outputPath); // El código de salida 0 significa éxito; le devolvemos al controlador la ruta donde quedó guardado el PDF comprimido
      } else {
        reject(new Error(`Ghostscript error al comprimir (código ${code}): ${stderr}`)); // Cualquier código distinto de 0 significa que algo salió mal; rechazamos la promesa incluyendo el stderr acumulado para saber qué falló exactamente
      }
    });
  });
};

// Función que recibe una lista de rutas de PDFs de entrada y una ruta de salida, los une todos en un solo documento usando Ghostscript y resuelve la promesa cuando termina
const mergePDFService = (inputPaths, outputPath) => {
  return new Promise((resolve, reject) => { // Misma estructura de Promise que compressPDFService; el controlador esperará a que esta promesa se resuelva antes de responder al cliente
    const gs = getGhostscriptCommand(); // Obtenemos el comando correcto de Ghostscript según el sistema operativo actual

    const args = [ // Lista de argumentos para la operación de unión de PDFs
      "-q", // Modo silencioso (equivalente a -dQUIET pero en forma abreviada); suprime los mensajes de inicio de Ghostscript
      "-dNOPAUSE", // No pausa entre páginas ni archivos durante el procesamiento
      "-dBATCH", // Sale automáticamente al terminar sin esperar input
      "-sDEVICE=pdfwrite", // El formato de salida es PDF
      `-sOutputFile=${outputPath}`, // Ruta donde se guardará el PDF unido resultante
      ...inputPaths // Expandimos el array de rutas de entrada usando el operador spread; Ghostscript acepta múltiples archivos de entrada simplemente listándolos como argumentos adicionales y los concatena en el orden en que se pasan
    ];

    const proc = spawn(gs, args); // Lanzamos el proceso de Ghostscript con los argumentos de unión
    let stderr = ""; // Acumulador de mensajes de error de Ghostscript

    proc.stderr.on("data", (data) => {
      stderr += data.toString(); // Acumulamos cualquier mensaje de error que Ghostscript genere durante la unión
    });

    proc.on("error", (err) => {
      reject(new Error(`Ghostscript no encontrado. ¿Está instalado? Detalle: ${err.message}`)); // Si el proceso no pudo iniciarse (Ghostscript no instalado) rechazamos con error descriptivo
    });

    proc.on("close", (code) => { // Cuando Ghostscript termina revisamos el código de salida
      if (code === 0) {
        resolve(outputPath); // Éxito; devolvemos la ruta del PDF unido al controlador
      } else {
        reject(new Error(`Ghostscript error al unir (código ${code}): ${stderr}`)); // Fallo; rechazamos con el mensaje de error de Ghostscript para facilitar el diagnóstico
      }
    });
  });
};

module.exports = {
  compressPDFService, // Exportamos la función de compresión para que pdfController.js la pueda importar y usar
  mergePDFService // Exportamos la función de unión para que pdfController.js la pueda importar y usar
};

// si quitas getGhostscriptCommand pasa que compressPDFService y mergePDFService no sabrán qué comando ejecutar y el servidor lanzará un error al intentar comprimir o unir cualquier PDF,
// para solucionar esto vuelve a agregar la función detectando el OS con os.platform() y devolviendo "gs" para Linux o la ruta del ejecutable para Windows

// si quitas compressPDFService pasa que el controlador de compresión (pdfController.js) no encontrará la función al importarla y el servidor se caerá al arrancar con un error "is not a function",
// para solucionar esto vuelve a crear la función siguiendo el mismo patrón de Promise con spawn de Ghostscript usando los argumentos -dPDFSETTINGS=/screen

// si quitas mergePDFService pasa exactamente lo mismo pero para la herramienta de unión de PDFs; el servidor se caerá al arrancar,
// para solucionar esto vuelve a crear la función siguiendo el mismo patrón pero pasando el array de rutas con el operador spread como argumentos finales de Ghostscript

// si quitas el manejo de proc.stderr.on("data") pasa que cuando Ghostscript falle no tendrás información de qué fue lo que salió mal, solo verás el código de error numérico sin contexto,
// para solucionar esto vuelve a agregar el listener de stderr acumulando los mensajes en una variable de texto antes del evento "close"

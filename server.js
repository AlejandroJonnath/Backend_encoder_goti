const express = require("express");
const cors = require("cors");
const fs = require("fs");
const app = express();
app.use(cors());

const signRoutes = require("./src/routes/signRoutes");
const pdfRoutes = require("./src/routes/pdfRoutes");
const path = require("path");

// ...

// Rutas
app.use("/api/sign", signRoutes);
app.use("/api/pdf", pdfRoutes);

// Servir la carpeta uploads para que los PDFs puedan ser descargados por el cliente
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor de Firmas EC corriendo en el puerto ${PORT}`);
});

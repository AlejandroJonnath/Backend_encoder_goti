const express = require("express");
const router = express.Router();
const { handleDetectAI, handleDetectPlagiarism } = require("../controllers/detectController");

// Estas rutas no usan Multer porque reciben texto plano en formato JSON
router.post("/ai", express.json(), handleDetectAI);
router.post("/plagiarism", express.json(), handleDetectPlagiarism);

module.exports = router;

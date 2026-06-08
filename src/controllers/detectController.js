const { detectAI, detectPlagiarism } = require("../services/detectService");

const handleDetectAI = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "El texto no puede estar vacío." });
    }
    const result = await detectAI(text);
    res.json(result);
  } catch (error) {
    console.error("Error en detector de IA:", error);
    res.status(500).json({ error: error.message || "Error interno al detectar IA." });
  }
};

const handleDetectPlagiarism = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "El texto no puede estar vacío." });
    }
    const result = await detectPlagiarism(text);
    res.json(result);
  } catch (error) {
    console.error("Error en detector de plagio:", error);
    res.status(500).json({ error: error.message || "Error interno al detectar plagio." });
  }
};

module.exports = {
  handleDetectAI,
  handleDetectPlagiarism,
};

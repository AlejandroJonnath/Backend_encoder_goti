const { signElectronicDocument } = require("../../signer");

const signDocument = async (req, res) => {
  try {
    const { pdf, p12 } = req.files;
    const password = req.body.password;
    const posX = parseFloat(req.body.posX) || 70;
    const posY = parseFloat(req.body.posY) || 10;

    if (!pdf || !p12 || !password) {
      return res.status(400).json({ error: "Faltan archivos (pdf, p12) o contraseña." });
    }

    // Firmar criptográficamente el documento
    const signedPdfBuffer = await signElectronicDocument({
      pdfBuffer: pdf[0].buffer,
      p12Buffer: p12[0].buffer,
      password,
      posX,
      posY
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="signed_document.pdf"');
    res.send(signedPdfBuffer);

  } catch (error) {
    console.error("Error al firmar:", error);
    res.status(500).json({ error: error.message || "Error interno al firmar documento." });
  }
};

module.exports = {
  signDocument
};

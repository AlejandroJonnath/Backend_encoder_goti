const express = require("express");
const router = express.Router();
const { diskUpload } = require("../middlewares/upload");
const { compressPDF, mergePDF } = require("../controllers/pdfController");

router.post(
  "/compress",
  diskUpload.fields([{ name: "pdf", maxCount: 1 }]),
  compressPDF
);

router.post(
  "/merge",
  diskUpload.fields([{ name: "pdfs", maxCount: 20 }]), // permitimos hasta 20 PDFs a la vez
  mergePDF
);

module.exports = router;

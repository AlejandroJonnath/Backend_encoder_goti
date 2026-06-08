const express = require("express");
const router = express.Router();
const { diskUpload } = require("../middlewares/upload");
const { translatePDF } = require("../controllers/translateController");

router.post("/", diskUpload.fields([{ name: "pdf", maxCount: 1 }]), translatePDF);

module.exports = router;

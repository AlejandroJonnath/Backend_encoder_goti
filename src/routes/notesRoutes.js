const express = require("express");
const router = express.Router();
const { diskUpload } = require("../middlewares/upload");
const { addNote } = require("../controllers/notesController");

router.post("/", diskUpload.fields([{ name: "pdf", maxCount: 1 }]), addNote);

module.exports = router;

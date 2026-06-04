const express = require("express");
const router = express.Router();
const { memoryUpload } = require("../middlewares/upload");
const { signDocument } = require("../controllers/signController");

router.post(
  "/",
  memoryUpload.fields([
    { name: "pdf", maxCount: 1 },
    { name: "p12", maxCount: 1 }
  ]),
  signDocument
);

module.exports = router;

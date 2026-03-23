import express from "express";
import multer from "multer";
import { getKycByHash, uploadKyc } from "../controllers/kycController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("document"), uploadKyc);
router.get("/:hash", getKycByHash);

export default router;

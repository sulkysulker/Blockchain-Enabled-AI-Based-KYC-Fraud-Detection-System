import express from "express";
import multer from "multer";
import { getKycByHash, uploadKyc, getKycCount } from "../controllers/kycController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("document"), uploadKyc);
router.get("/count", getKycCount);
router.get("/:hash", getKycByHash);

export default router;

import express from "express";
import { mirrorFraudReport } from "../controllers/fraudController.js";

const router = express.Router();

router.post("/report", mirrorFraudReport);

export default router;

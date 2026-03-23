import FraudReport from "../models/FraudReport.js";

export async function mirrorFraudReport(req, res) {
  try {
    const { hash, score, reason, reportedBy, txHash } = req.body;
    if (!hash || score === undefined || !reason) {
      return res.status(400).json({ message: "hash, score, and reason are required." });
    }

    const report = await FraudReport.create({
      hash,
      score,
      reason,
      reportedBy: reportedBy || "",
      txHash: txHash || ""
    });

    return res.status(201).json({
      message: "Fraud report logged successfully.",
      data: report
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Fraud mirror logging failed." });
  }
}

import mongoose from "mongoose";

const FraudReportSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, index: true },
    score: { type: Number, min: 0, max: 100, required: true },
    reason: { type: String, required: true },
    reportedBy: { type: String, default: "" },
    txHash: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("FraudReport", FraudReportSchema);

import mongoose from "mongoose";

const KycRecordSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, index: true, unique: true },
    identifierType: { type: String, enum: ["email", "id", "other"], default: "other" },
    originalIdentifier: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipfsCid: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("KycRecord", KycRecordSchema);

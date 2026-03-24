import KycRecord from "../models/KycRecord.js";
import { uploadToPinata } from "../services/ipfsService.js";

export async function uploadKyc(req, res) {
  try {
    const { hash, identifierType = "other", originalIdentifier, metadata } = req.body;
    if (!hash || !originalIdentifier) {
      return res.status(400).json({ message: "hash and originalIdentifier are required." });
    }

    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      } catch {
        return res.status(400).json({ message: "Invalid metadata JSON." });
      }
    }

    let ipfsCid = "";
    if (req.file) {
      try {
        ipfsCid = await uploadToPinata(req.file);
      } catch (uploadError) {
        console.warn(`IPFS upload failed, saving record without document: ${uploadError.message}`);
      }
    }

    const record = await KycRecord.findOneAndUpdate(
      { hash },
      {
        hash,
        identifierType,
        originalIdentifier,
        metadata: parsedMetadata,
        ...(ipfsCid ? { ipfsCid } : {})
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: "KYC metadata stored successfully.",
      data: record
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Upload failed." });
  }
}

export async function getKycByHash(req, res) {
  try {
    const { hash } = req.params;
    const record = await KycRecord.findOne({ hash });
    if (!record) {
      return res.status(404).json({ message: "KYC record not found." });
    }
    return res.status(200).json({ data: record });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Fetch failed." });
  }
}

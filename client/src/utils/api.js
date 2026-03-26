import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5000",
  timeout: 20000
});

export async function uploadKycMetadata(payload) {
  const formData = new FormData();
  formData.append("hash", payload.hash);
  formData.append("identifierType", payload.identifierType || "other");
  formData.append("originalIdentifier", payload.originalIdentifier);
  if (payload.metadata) {
    formData.append("metadata", JSON.stringify(payload.metadata));
  }
  if (payload.documentFile) {
    formData.append("document", payload.documentFile);
  }

  const { data } = await api.post("/kyc/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data;
}

export async function getOffChainKyc(hash) {
  try {
    const { data } = await api.get(`/kyc/${hash}`);
    return data;
  } catch (error) {
    // Return null for 404 errors (no off-chain data) - this is expected
    if (error.response?.status === 404) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

export async function mirrorFraudReport(payload) {
  const { data } = await api.post("/fraud/report", payload);
  return data;
}

export async function getKycCount() {
  const { data } = await api.get("/kyc/count");
  return data;
}

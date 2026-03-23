const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function uploadToPinata(file) {
  if (!process.env.PINATA_JWT) {
    throw new Error("PINATA_JWT is not configured.");
  }
  if (!file) {
    throw new Error("File is required for upload.");
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append("file", blob, file.originalname);

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`
    },
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IPFS upload failed: ${text}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

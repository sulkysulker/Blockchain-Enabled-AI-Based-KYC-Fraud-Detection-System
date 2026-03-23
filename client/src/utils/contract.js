import { ethers } from "ethers";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const ABI_JSON = import.meta.env.VITE_CONTRACT_ABI;

let contractAbi;
try {
  contractAbi = ABI_JSON ? JSON.parse(ABI_JSON) : [];
} catch (error) {
  throw new Error("Invalid VITE_CONTRACT_ABI JSON in environment variables.");
}

export function getContract(signerOrProvider) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("VITE_CONTRACT_ADDRESS is missing.");
  }
  if (!contractAbi.length) {
    throw new Error("VITE_CONTRACT_ABI is missing or empty.");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signerOrProvider);
}

export async function sendTx(txPromise, onStatus) {
  try {
    onStatus?.({ state: "pending", message: "Transaction submitted. Waiting for confirmation..." });
    const tx = await txPromise;
    const receipt = await tx.wait();
    onStatus?.({ state: "success", message: `Transaction confirmed: ${receipt.hash}` });
    return receipt;
  } catch (error) {
    const message = error?.shortMessage || error?.message || "Transaction failed";
    onStatus?.({ state: "error", message });
    throw error;
  }
}

export function hashIdentifier(identifier) {
  if (!identifier?.trim()) {
    throw new Error("Identifier is required.");
  }
  return ethers.keccak256(ethers.toUtf8Bytes(identifier.trim().toLowerCase()));
}

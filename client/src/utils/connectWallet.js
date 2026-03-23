import { ethers } from "ethers";

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export function getEthereumProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask.");
  }
  return window.ethereum;
}

export async function connectWallet() {
  const provider = getEthereumProvider();
  const browserProvider = new ethers.BrowserProvider(provider);
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const network = await browserProvider.getNetwork();
  const signer = await browserProvider.getSigner();

  return {
    account: accounts[0],
    chainId: `0x${network.chainId.toString(16)}`,
    provider: browserProvider,
    signer
  };
}

export async function initializeWalletSilently() {
  const provider = getEthereumProvider();
  const browserProvider = new ethers.BrowserProvider(provider);
  const accounts = await provider.request({ method: "eth_accounts" });
  const network = await browserProvider.getNetwork();
  const signer = accounts[0] ? await browserProvider.getSigner() : null;

  return {
    account: accounts[0] || "",
    chainId: `0x${network.chainId.toString(16)}`,
    provider: browserProvider,
    signer
  };
}

export async function getCurrentAccount() {
  const provider = getEthereumProvider();
  const accounts = await provider.request({ method: "eth_accounts" });
  return accounts[0] || null;
}

export async function switchToSepolia() {
  const provider = getEthereumProvider();
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
  });
}

export function onAccountsChanged(handler) {
  const provider = getEthereumProvider();
  provider.on("accountsChanged", handler);
}

export function onChainChanged(handler) {
  const provider = getEthereumProvider();
  provider.on("chainChanged", handler);
}

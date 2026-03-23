import { SEPOLIA_CHAIN_ID_HEX } from "../utils/connectWallet";

function WalletBar({ account, roleLabel, chainId, onConnect, onSwitchNetwork }) {
  const isSepolia = (chainId || "").toLowerCase() === SEPOLIA_CHAIN_ID_HEX;

  return (
    <header className="wallet-bar">
      <div>
        <h1>VeriChainKYC</h1>
        <p>Blockchain-based KYC and DAO governance</p>
      </div>
      <div className="wallet-meta">
        <div><strong>Account:</strong> {account || "Not connected"}</div>
        <div><strong>Role:</strong> {roleLabel || "Unknown"}</div>
        <div><strong>Network:</strong> {chainId || "N/A"}</div>
        {!account ? (
          <button onClick={onConnect}>Connect MetaMask</button>
        ) : !isSepolia ? (
          <button onClick={onSwitchNetwork}>Switch to Sepolia</button>
        ) : null}
      </div>
    </header>
  );
}

export default WalletBar;

import { useState, useEffect } from "react";
import { SEPOLIA_CHAIN_ID_HEX } from "../utils/connectWallet";

function WalletBar({ account, roleLabel, chainId, onConnect, onSwitchNetwork }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const isSepolia = (chainId || "").toLowerCase() === SEPOLIA_CHAIN_ID_HEX;
  const isConnected = !!account;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`wallet-bar ${isScrolled ? 'wallet-bar--compact' : ''}`}>
      <div className="brand-section">
        <div className="brand-logo">
          <span className="logo-icon">🔗</span>
          <div>
            <h1 className="brand-title">VeriChainKYC</h1>
            <p className="brand-subtitle">Secure Blockchain KYC & Governance</p>
          </div>
        </div>
      </div>

      <div className="wallet-section">
        <div className="status-indicators">
          <div className={`status-item ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-icon">{isConnected ? '🟢' : '🔴'}</span>
            <span className="status-text">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {isConnected && (
            <div className={`status-item ${isSepolia ? 'network-valid' : 'network-invalid'}`}>
              <span className="status-icon">{isSepolia ? '✅' : '⚠️'}</span>
              <span className="status-text">
                {isSepolia ? 'Sepolia' : 'Wrong Network'}
              </span>
            </div>
          )}
        </div>

        <div className="wallet-details">
          {isConnected && (
            <>
              <div className="detail-item">
                <span className="detail-label">Account:</span>
                <span className="detail-value account-address">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Role:</span>
                <span className="detail-value">{roleLabel || "Unknown"}</span>
              </div>
            </>
          )}
        </div>

        <div className="wallet-actions">
          {!isConnected ? (
            <button className="btn-primary" onClick={onConnect}>
              <span className="btn-icon">🔗</span>
              Connect Wallet
            </button>
          ) : !isSepolia ? (
            <button className="btn-secondary" onClick={onSwitchNetwork}>
              <span className="btn-icon">🔄</span>
              Switch to Sepolia
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default WalletBar;

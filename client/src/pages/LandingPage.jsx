import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Building,
  CheckCircle,
  FileCheck,
  LockKeyhole,
  Activity,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import NasaParticles from '../components/Nasa';
import WalletBar from '../components/WalletBar';

export default function LandingPage({ account, walletProps, children }) {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <NasaParticles />
      
      <header className="fixed-header">
        <WalletBar {...walletProps} />
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge pulse">VeriChain KYC</div>
          <h1 className="hero-title">
            The Trust Layer for <br />
            <span className="text-gradient">Decentralized Identity</span>
          </h1>
          <p className="hero-subtitle">
            A blockchain-enabled autonomous KYC platform empowering institutions with secure, fraud-resistant identity verification.
          </p>
          <div className="hero-actions">
            {!account && (
              <p className="notice highlight">Connect your MetaMask wallet in the top bar to get started.</p>
            )}
          </div>
        </div>
        
        <div className="hero-stats">
          <div className="stat-card glassmorphism">
            <LockKeyhole className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">100%</span>
              <span className="stat-label">On-chain Security</span>
            </div>
          </div>
          <div className="stat-card glassmorphism">
            <Activity className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">Real-time</span>
              <span className="stat-label">Verification</span>
            </div>
          </div>
          <div className="stat-card glassmorphism">
            <ShieldAlert className="stat-icon" />
            <div className="stat-info">
              <span className="stat-value">Zero-Trust</span>
              <span className="stat-label">Fraud Detection</span>
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Dashboard Injection */}
      {children}

      {/* Roles Split Section (Only show if not connected, keeping it clean) */}
      {!account && (
        <section className="roles-section">
          <div className="section-header">
            <h2>Ecosystem Participants</h2>
            <p>Two distinct roles working together to establish absolute trust.</p>
          </div>

          <div className="roles-grid">
            {/* Issuer Flow */}
            <div className="role-card glassmorphism hover-glow">
              <div className="role-icon-wrapper issuer-theme">
                <Building className="role-icon" />
              </div>
              <h3 className="role-title">For Issuers</h3>
              <p className="role-desc">
                Trusted entities that initiate the KYC process for individuals seeking verification.
              </p>
              
              <ul className="feature-list">
                <li>
                  <CheckCircle className="li-icon issuer-theme" />
                  <span>Submit users for KYC verification</span>
                </li>
                <li>
                  <CheckCircle className="li-icon issuer-theme" />
                  <span>Propose new verifiers to the network</span>
                </li>
                <li>
                  <CheckCircle className="li-icon issuer-theme" />
                  <span>Monitor KYC application statuses</span>
                </li>
              </ul>
              
              <div className="role-footer">
                <span className="role-tag issuer-theme">Role: Initiator</span>
              </div>
            </div>

            {/* Verifier Flow */}
            <div className="role-card glassmorphism hover-glow">
              <div className="role-icon-wrapper verifier-theme">
                <ShieldCheck className="role-icon" />
              </div>
              <h3 className="role-title">For Verifiers</h3>
              <p className="role-desc">
                Independent auditors responsible for reviewing and confirming the validity of user data.
              </p>
              
              <ul className="feature-list">
                <li>
                  <CheckCircle className="li-icon verifier-theme" />
                  <span>Review submitted identity documents</span>
                </li>
                <li>
                  <CheckCircle className="li-icon verifier-theme" />
                  <span>Vote on pending KYC applications</span>
                </li>
                <li>
                  <CheckCircle className="li-icon verifier-theme" />
                  <span>Maintain consensus and integrity</span>
                </li>
              </ul>
              
              <div className="role-footer">
                <span className="role-tag verifier-theme">Role: Validator</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer / CTA space if needed */}
      <footer className="landing-footer">
        <div className="footer-content glassmorphism">
          <ShieldCheck className="footer-logo" />
          <p>© 2026 VeriChain KYC System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { sendTx } from "../utils/contract";
import DashboardLayout from "../layouts/DashboardLayout";
import { Settings, ShieldCheck, UserPlus, Zap } from "lucide-react";

function AdminDashboard({ contract, onTxStatus, walletProps }) {
  const [initialIssuer, setInitialIssuer] = useState("");
  const [votingPeriodSeconds, setVotingPeriodSeconds] = useState("");
  const [activeTab, setActiveTab] = useState('settings');

  async function handleAddInitialIssuer() {
    const receipt = await sendTx(contract.addInitialIssuer(initialIssuer), onTxStatus);
    toast.success(`Initial issuer added: ${receipt.hash}`);
  }

  async function handleSetVotingPeriod() {
    const receipt = await sendTx(contract.setVotingPeriod(Number(votingPeriodSeconds)), onTxStatus);
    toast.success(`Voting period updated: ${receipt.hash}`);
  }

  async function handleFinalizeBootstrap() {
    const receipt = await sendTx(contract.finaliseBootstrap(), onTxStatus);
    toast.success(`Bootstrap finalized: ${receipt.hash}`);
  }

  async function wrapAction(fn) {
    try {
      await fn();
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || "Admin action failed");
      onTxStatus?.({ state: "error", message: error?.message || "Admin action failed" });
    }
  }

  const sidebarItems = [
    { id: 'settings', label: 'Admin Settings', icon: Settings },
  ];

  return (
    <DashboardLayout 
      sidebarItems={sidebarItems} 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      walletProps={walletProps}
    >
      <div className="tab-content slide-up">
        {activeTab === 'settings' && (
          <>
            <div className="cyber-card" style={{ marginBottom: "2rem" }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: "2rem", borderBottom: "1px solid var(--border-muted)", paddingBottom: "1.5rem" }}>
                <div className="card-icon" style={{ color: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)', padding: '0.75rem', borderRadius: '12px' }}><Zap size={32} /></div>
                <div style={{ flexGrow: 1 }}>
                  <h2 className="cyber-heading">Admin Configuration</h2>
                  <p className="cyber-subheading">Configure governance parameters and initialize the VeriChain network.</p>
                </div>
                <span className="cyber-badge core">God Mode</span>
              </div>

              <div className="form-section">
                <div className="form-group" style={{ marginBottom: "2rem" }}>
                  <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "var(--text-primary)" }}>Network Bootstrap</h3>
                  <label className="form-label">
                    <span className="label-icon"><UserPlus size={16} /></span>
                    Initial Issuer Address
                  </label>
                  <input 
                    value={initialIssuer} 
                    onChange={(e) => setInitialIssuer(e.target.value)} 
                    placeholder="0x..." 
                    className="neon-input"
                  />
                  <div className="card-actions" style={{ marginTop: "1rem" }}>
                    <button className="cyber-button" onClick={() => wrapAction(handleAddInitialIssuer)}>Add Initial Issuer</button>
                    <button className="cyber-button" onClick={() => wrapAction(handleFinalizeBootstrap)}>Finalize Bootstrap</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "2rem", borderTop: "1px solid var(--border-muted)", paddingTop: "2rem" }}>
                  <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "var(--text-primary)" }}>Governance Config</h3>
                  <label className="form-label">
                    <span className="label-icon"><ShieldCheck size={16} /></span>
                    Voting Period (seconds)
                  </label>
                  <input
                    type="number"
                    value={votingPeriodSeconds}
                    onChange={(e) => setVotingPeriodSeconds(e.target.value)}
                    placeholder="86400"
                    className="neon-input"
                  />
                  <div className="card-actions" style={{ marginTop: "1rem" }}>
                    <button className="cyber-button" onClick={() => wrapAction(handleSetVotingPeriod)}>
                      <Settings size={18} /> Configure Voting Period
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;

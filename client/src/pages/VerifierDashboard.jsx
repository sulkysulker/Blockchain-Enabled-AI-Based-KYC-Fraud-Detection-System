import { useState } from "react";
import toast from "react-hot-toast";
import { hashIdentifier, sendTx } from "../utils/contract";

function toDisplayJson(value) {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

function summarizeKycRecord(raw, queriedHash) {
  if (!raw) return [];

  const pick = (names, index) => {
    for (const name of names) {
      if (raw?.[name] !== undefined) return raw[name];
    }
    if (index === undefined || index === null) return undefined;
    try {
      if (typeof raw?.length === "number" && (index < 0 || index >= raw.length)) {
        return undefined;
      }
      return raw?.[index];
    } catch {
      return undefined;
    }
  };

  const formatVerified = (value) => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      if (numeric === 1) return "Yes";
      if (numeric === 0) return "No";
    }
    return value;
  };

  const formatTimestamp = (value) => {
    if (value === undefined || value === null || value === "") return "—";
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return String(value);
    const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
  };

  const formatValue = (value) => {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return toDisplayJson(value);
    return String(value);
  };

  const fields = [
    { label: "Hash", value: pick(["hash", "identifierHash", "userHash", "kycHash"]) ?? queriedHash },
    { label: "Verified", value: formatVerified(pick(["verified", "isVerified", "status"], 1)) },
    { label: "Issuer", value: pick(["issuer", "verifiedBy", "updatedBy"], 2) },
    { label: "Last Updated", value: formatTimestamp(pick(["timestamp", "updatedAt", "lastUpdated"], 3)) },
    { label: "Exists", value: pick(["exists"], 4) }
  ];

  return fields
    .filter((item) => item.value !== undefined)
    .map((item) => ({ ...item, value: formatValue(item.value) }));
}

function VerifierDashboard({ contract, onTxStatus }) {
  const [identifier, setIdentifier] = useState("");
  const [kycData, setKycData] = useState(null);
  const [fraudData, setFraudData] = useState(null);
  const [accessLogs, setAccessLogs] = useState(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const queriedHash = identifier.trim() ? hashIdentifier(identifier) : "";
  const kycSummary = summarizeKycRecord(kycData, queriedHash);

  function getHash() {
    return hashIdentifier(identifier);
  }

  async function handleViewKYC() {
    try {
      setLoadingKyc(true);
      const hash = getHash();
      const result = await contract.getKYC(hash);
      setKycData(result);
      // Log access automatically for compliance
      try {
        await contract.logAccess(hash);
      } catch (error) {
        console.warn("Access log failed silently:", error?.message);
      }
      toast.success("KYC data loaded successfully");
    } catch (error) {
      toast.error(error?.message || "Unable to fetch KYC");
    } finally {
      setLoadingKyc(false);
    }
  }

  async function handleLogAccess() {
    try {
      if (!identifier.trim()) {
        throw new Error("Identifier is required");
      }
      const hash = getHash();
      const receipt = await sendTx(contract.logAccess(hash), onTxStatus);
      toast.success(`Access logged: ${receipt.hash}`);
    } catch (error) {
      toast.error(error?.message || "Unable to log access");
    }
  }

  async function handleViewAccessLogs() {
    try {
      setLoadingLogs(true);
      const hash = getHash();
      const logs = await contract.getAccessLogs(hash);
      setAccessLogs(logs);
      toast.success("Access logs loaded successfully");
    } catch (error) {
      toast.error(error?.message || "Unable to fetch logs");
    } finally {
      setLoadingLogs(false);
    }
  }


  async function handleViewFraud() {
    try {
      setLoadingFraud(true);
      const hash = getHash();
      const result = await contract.getFraud(hash);
      // Convert Result object to plain object, handling both numeric indices and named properties
      const fraudReport = {
        score: result?.score !== undefined ? Number(result.score) : (result?.[0] !== undefined ? Number(result[0]) : null),
        reason: result?.reason !== undefined ? result.reason : (result?.[1] !== undefined ? result[1] : "")
      };
      setFraudData(fraudReport);
      // Log access automatically for compliance
      try {
        await contract.logAccess(hash);
      } catch (error) {
        console.warn("Access log failed silently:", error?.message);
      }
      toast.success("Fraud data loaded successfully");
    } catch (error) {
      toast.error(error?.message || "Unable to fetch fraud data");
    } finally {
      setLoadingFraud(false);
    }
  }

  return (
    <div className="verifier-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-icon">🔍</div>
          <div>
            <h1 className="dashboard-title">Verifier Dashboard</h1>
            <p className="dashboard-subtitle">View KYC records, verify fraud status, and audit access logs</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'kyc' ? 'active' : ''}`}
          onClick={() => setActiveTab('kyc')}
        >
          <span className="tab-icon">📋</span>
          KYC Verification
        </button>
        <button
          className={`tab-button ${activeTab === 'fraud' ? 'active' : ''}`}
          onClick={() => setActiveTab('fraud')}
        >
          <span className="tab-icon">🚨</span>
          Fraud Review
        </button>
        <button
          className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <span className="tab-icon">📊</span>
          Access Audit
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* KYC Verification Tab */}
        {activeTab === 'kyc' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-icon">📋</div>
              <h2 className="card-title">KYC Verification</h2>
              <span className="card-badge info">Lookup</span>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  User Identifier
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or government ID"
                  className="form-input"
                />
              </div>

              <div className="card-actions">
                <button
                  className="btn-primary"
                  onClick={handleViewKYC}
                  disabled={loadingKyc || !identifier.trim()}
                >
                  <span className="btn-icon">{loadingKyc ? '⏳' : '📋'}</span>
                  {loadingKyc ? 'Loading...' : 'View KYC Record'}
                </button>
              </div>

              {kycData && (
                <div className="data-display">
                  <h3 className="data-title">On-Chain KYC Record</h3>
                  <div className="data-block">
                    {kycSummary.length ? (
                      kycSummary.map((item) => (
                        <div key={item.label}>
                          <strong>{item.label}:</strong> {item.value}
                        </div>
                      ))
                    ) : (
                      <div>No labeled fields detected for this contract response.</div>
                    )}
                  </div>
                </div>
              )}

              {!kycData && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p className="empty-text">No KYC data loaded</p>
                  <p className="empty-hint">Enter an identifier and click "View KYC Record" to retrieve data</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fraud Review Tab */}
        {activeTab === 'fraud' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-icon">🚨</div>
              <h2 className="card-title">Fraud Review</h2>
              <span className="card-badge danger">Alert</span>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  User Identifier
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or government ID"
                  className="form-input"
                />
              </div>

              <div className="card-actions">
                <button
                  className="btn-danger"
                  onClick={handleViewFraud}
                  disabled={loadingFraud || !identifier.trim()}
                >
                  <span className="btn-icon">{loadingFraud ? '⏳' : '🚨'}</span>
                  {loadingFraud ? 'Loading...' : 'Check Fraud Status'}
                </button>
              </div>

              {fraudData && (
                <div className="data-display fraud-review">
                  <h3 className="data-title">Fraud Report</h3>
                  <div className="fraud-content">
                    {fraudData.score !== undefined && (
                      <div className="fraud-score">
                        <span className="score-label">Risk Score:</span>
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{
                              width: `${fraudData.score}%`,
                              backgroundColor: fraudData.score > 70 ? '#ef4444' : fraudData.score > 40 ? '#fbbf24' : '#22c55e'
                            }}
                          ></div>
                        </div>
                        <span className="score-value">{fraudData.score}/100</span>
                      </div>
                    )}
                  </div>
                  <pre className="data-block">{toDisplayJson(fraudData)}</pre>
                </div>
              )}

              {!fraudData && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p className="empty-text">No fraud data loaded</p>
                  <p className="empty-hint">Enter an identifier and click "Check Fraud Status" to review</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Access Audit Tab */}
        {activeTab === 'audit' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-icon">📊</div>
              <h2 className="card-title">Access Audit</h2>
              <span className="card-badge info">Compliance</span>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  User Identifier
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or government ID"
                  className="form-input"
                />
              </div>

              <div className="card-actions">
                <button
                  className="btn-info"
                  onClick={handleViewAccessLogs}
                  disabled={loadingLogs || !identifier.trim()}
                >
                  <span className="btn-icon">{loadingLogs ? '⏳' : '📜'}</span>
                  {loadingLogs ? 'Loading...' : 'View Access Logs'}
                </button>
              </div>

              {accessLogs && (
                <div className="data-display">
                  <h3 className="data-title">Access History</h3>
                  <div className="logs-summary">
                    <div className="summary-item">
                      <span className="summary-label">Total Accesses:</span>
                      <span className="summary-value">{accessLogs.length || 0}</span>
                    </div>
                  </div>
                  <pre className="data-block">{toDisplayJson(accessLogs)}</pre>
                </div>
              )}

              {!accessLogs && (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p className="empty-text">No access logs loaded</p>
                  <p className="empty-hint">Enter an identifier and click "View Access Logs" to review compliance history</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifierDashboard;

import { useState } from 'react';
import toast from 'react-hot-toast';
import { hashIdentifier, sendTx } from '../utils/contract';
import { getOffChainKyc } from '../utils/api';
import {
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  User,
  Search,
  FileText,
  Database,
  ExternalLink,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import FooterStats from '../components/FooterStats';

function toDisplayJson(value) {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === 'bigint' ? v.toString() : v),
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
      if (
        typeof raw?.length === 'number' &&
        (index < 0 || index >= raw.length)
      ) {
        return undefined;
      }
      return raw?.[index];
    } catch {
      return undefined;
    }
  };

  const formatVerified = (value) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      if (numeric === 1) return 'Yes';
      if (numeric === 0) return 'No';
    }
    return value;
  };

  const formatTimestamp = (value) => {
    if (value === undefined || value === null || value === '') return '—';
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return String(value);
    const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString();
  };

  const formatValue = (value) => {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return toDisplayJson(value);
    return String(value);
  };

  const fields = [
    {
      label: 'Hash',
      value:
        pick(['hash', 'identifierHash', 'userHash', 'kycHash']) ?? queriedHash,
    },
    {
      label: 'Verified',
      value: formatVerified(pick(['verified', 'isVerified', 'status'], 1)),
    },
    { label: 'Issuer', value: pick(['issuer', 'verifiedBy', 'updatedBy'], 2) },
    {
      label: 'Last Updated',
      value: formatTimestamp(
        pick(['timestamp', 'updatedAt', 'lastUpdated'], 3)
      ),
    },
    { label: 'Exists', value: pick(['exists'], 4) },
  ];

  return fields
    .filter((item) => item.value !== undefined)
    .map((item) => ({ ...item, value: formatValue(item.value) }));
}

function VerifierDashboard({ contract, onTxStatus, walletProps, txStatus }) {
  const [identifier, setIdentifier] = useState('');
  const [kycData, setKycData] = useState(null);
  const [offChainData, setOffChainData] = useState(null);
  const [fraudData, setFraudData] = useState(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const queriedHash = identifier.trim() ? hashIdentifier(identifier) : '';
  const kycSummary = summarizeKycRecord(kycData, queriedHash);

  function getHash() {
    return hashIdentifier(identifier);
  }

  async function handleViewKYC() {
    try {
      setLoadingKyc(true);
      setOffChainData(null);
      const hash = getHash();
      const result = await contract.getKYC(hash);
      setKycData(result);

      // Fetch off-chain metadata
      try {
        const offChain = await getOffChainKyc(hash);
        if (offChain?.data) {
          setOffChainData(offChain.data);
        }
      } catch (err) {
        console.info('No off-chain metadata found for this hash.');
      }

      toast.success('KYC data loaded successfully');
    } catch (error) {
      toast.error(error?.message || 'Unable to fetch KYC');
    } finally {
      setLoadingKyc(false);
    }
  }

  async function handleLogAccess() {
    try {
      if (!identifier.trim()) {
        throw new Error('Identifier is required');
      }
      const hash = getHash();
      const receipt = await sendTx(contract.logAccess(hash), onTxStatus);
      toast.success(`Access logged: ${receipt.hash}`);
    } catch (error) {
      toast.error(error?.message || 'Unable to log access');
    }
  }

  async function handleViewFraud() {
    try {
      setLoadingFraud(true);
      setFraudData(null);
      const hash = getHash();
      const result = await contract.getFraud(hash);
      // Convert Result object to plain object, handling both numeric indices and named properties
      const fraudReport = {
        score:
          result?.score !== undefined
            ? Number(result.score)
            : result?.[0] !== undefined
              ? Number(result[0])
              : null,
        reason:
          result?.reason !== undefined
            ? result.reason
            : result?.[1] !== undefined
              ? result[1]
              : '',
      };
      setFraudData(fraudReport);
      toast.success('Fraud data loaded successfully');
    } catch (error) {
      // If no fraud record exists, show a friendly message
      if (error?.message?.includes('not found')) {
        toast.info('No fraud record found for this user');
        setFraudData({ score: 0, reason: 'No fraud record - User is clean' });
      } else {
        toast.error(error?.message || 'Unable to fetch fraud data');
      }
    } finally {
      setLoadingFraud(false);
    }
  }

  const sidebarItems = [
    { id: 'kyc', label: 'KYC Verification', icon: ClipboardList },
    { id: 'fraud', label: 'Fraud Review', icon: AlertTriangle },
  ];

  return (
    <DashboardLayout
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      walletProps={walletProps}
    >
      <div className="tab-content slide-up">
        {/* KYC Verification Tab */}
        {activeTab === 'kyc' && (
          <div className="cyber-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1.25rem',
                marginBottom: '2rem',
                borderBottom: '1px solid var(--border-muted)',
                paddingBottom: '1.5rem',
              }}
            >
              <div
                className="card-icon"
                style={{
                  color: '#06b6d4',
                  background: 'rgba(6, 182, 212, 0.1)',
                  padding: '0.75rem',
                  borderRadius: '12px',
                }}
              >
                <ClipboardList size={32} />
              </div>
              <div style={{ flexGrow: 1 }}>
                <h2 className="cyber-heading">KYC Verification</h2>
                <p className="cyber-subheading">
                  Lookup identity records submitted to the network.
                </p>
              </div>
              <span className="cyber-badge info">Lookup</span>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">
                    <User size={16} />
                  </span>
                  User Identifier
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or government ID"
                  className="neon-input"
                />
              </div>

              <div className="card-actions">
                <button
                  className="cyber-button"
                  onClick={handleViewKYC}
                  disabled={loadingKyc || !identifier.trim()}
                >
                  <Search size={18} />
                  {loadingKyc ? 'Loading...' : 'View KYC Record'}
                </button>
              </div>

              {kycData && (
                <div className="data-display slide-up">
                  <h3
                    className="data-title"
                    style={{
                      color: 'var(--accent-cyan)',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <CheckCircle size={18} /> Record Retrieved
                  </h3>
                  <div
                    className="data-block"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {kycSummary.length ? (
                      kycSummary.map((item) => (
                        <div
                          key={item.label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--border-muted)',
                            paddingBottom: '0.5rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {item.label}:
                          </span>
                          <span
                            className={
                              item.label === 'Hash' || item.label === 'Issuer'
                                ? 'mono-value'
                                : ''
                            }
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              textAlign: 'right',
                              maxWidth: '60%',
                              wordBreak: 'break-all',
                            }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--accent-rose)' }}>
                        No valid data found on-chain.
                      </div>
                    )}
                  </div>

                  {offChainData && (
                    <div
                      className="data-block offchain-block slide-up"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        marginTop: '1.5rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid var(--border-neon)',
                      }}
                    >
                      <h4
                        style={{
                          color: 'var(--accent-purple)',
                          margin: '0 0 0.5rem',
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Database size={18} /> Off-Chain Metadata
                      </h4>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--border-muted)',
                          paddingBottom: '0.5rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Original Identifier:
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {offChainData.originalIdentifier}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--border-muted)',
                          paddingBottom: '0.5rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Identity Type:
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {offChainData.identifierType}
                        </span>
                      </div>

                      {offChainData.metadata &&
                        Object.entries(offChainData.metadata).map(
                          ([key, val]) => (
                            <div
                              key={key}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-muted)',
                                paddingBottom: '0.5rem',
                              }}
                            >
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Metadata ({key}):
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {String(val)}
                              </span>
                            </div>
                          )
                        )}

                      {offChainData.ipfsCid && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            paddingBottom: '0.5rem',
                            marginTop: '0.25rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Attached Document:
                          </span>
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${offChainData.ipfsCid}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--accent-blue)',
                              fontWeight: 'bold',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            View on IPFS <ExternalLink size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="card-actions" style={{ marginTop: '1.5rem' }}>
                    <button
                      className="cyber-button"
                      onClick={() => {
                        setKycData(null);
                        setOffChainData(null);
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      <span className="btn-icon">
                        <RefreshCw size={16} />
                      </span>{' '}
                      Clear Output
                    </button>
                  </div>
                </div>
              )}

              {!kycData && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FileText size={48} className="text-muted" />
                  </div>
                  <p className="empty-text">No KYC data loaded</p>
                  <p className="empty-hint">
                    Enter an identifier and click "View KYC Record" to retrieve
                    data
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fraud Review Tab */}
        {activeTab === 'fraud' && (
          <div className="cyber-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1.25rem',
                marginBottom: '2rem',
                borderBottom: '1px solid var(--border-muted)',
                paddingBottom: '1.5rem',
              }}
            >
              <div
                className="card-icon"
                style={{
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.75rem',
                  borderRadius: '12px',
                }}
              >
                <AlertTriangle size={32} />
              </div>
              <div style={{ flexGrow: 1 }}>
                <h2 className="cyber-heading">Fraud Review</h2>
                <p className="cyber-subheading">
                  Analyze flagged user reports and check risk scores.
                </p>
              </div>
              <span className="cyber-badge danger">Alert</span>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">
                    <User size={16} />
                  </span>
                  User Identifier
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or government ID"
                  className="neon-input"
                />
              </div>

              <div className="card-actions">
                <button
                  className="cyber-button"
                  onClick={handleViewFraud}
                  disabled={loadingFraud || !identifier.trim()}
                >
                  <ShieldCheck size={18} />
                  {loadingFraud ? 'Loading...' : 'Check Fraud Status'}
                </button>
              </div>

              {fraudData && (
                <div className="data-display fraud-review slide-up">
                  <h3
                    className="data-title"
                    style={{
                      color: 'var(--accent-rose)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <ShieldCheck size={18} /> Fraud Report
                  </h3>
                  <div className="fraud-content">
                    {fraudData.score !== undefined && (
                      <div className="fraud-score">
                        <span className="score-label">Risk Score:</span>
                        <div className="score-bar">
                          <div
                            className="score-fill"
                            style={{
                              width: `${fraudData.score}%`,
                              backgroundColor:
                                fraudData.score > 70
                                  ? '#ef4444'
                                  : fraudData.score > 40
                                    ? '#fbbf24'
                                    : '#22c55e',
                            }}
                          ></div>
                        </div>
                        <span className="score-value">
                          {fraudData.score}/100
                        </span>
                      </div>
                    )}
                  </div>
                  <pre className="data-block">{toDisplayJson(fraudData)}</pre>
                  <div className="card-actions" style={{ marginTop: '1rem' }}>
                    <button
                      className="cyber-button"
                      onClick={() => {
                        setFraudData(null);
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      <span className="btn-icon">
                        <RefreshCw size={16} />
                      </span>{' '}
                      Clear Output
                    </button>
                  </div>
                </div>
              )}

              {!fraudData && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <FileText size={48} className="text-muted" />
                  </div>
                  <p className="empty-text">No fraud data loaded</p>
                  <p className="empty-hint">
                    Enter an identifier and click "Check Fraud Status" to review
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <FooterStats contract={contract} />
    </DashboardLayout>
  );
}

export default VerifierDashboard;

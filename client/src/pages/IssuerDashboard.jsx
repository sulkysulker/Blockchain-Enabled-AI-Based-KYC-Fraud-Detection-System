import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { hashIdentifier, sendTx } from "../utils/contract";
import { mirrorFraudReport, uploadKycMetadata, getOffChainKyc } from "../utils/api";
import { 
  Building, 
  ClipboardList, 
  AlertTriangle, 
  Scale, 
  User, 
  Lock, 
  CheckCircle, 
  Tag, 
  FileText, 
  Paperclip,
  Plus,
  Search,
  MessageSquare,
  FileCode,
  Landmark,
  Target,
  Link as LinkIcon,
  Vote,
  RefreshCw,
  Eraser,
  UserPlus,
  Database,
  ExternalLink
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";

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

function proposalStatusLabel(statusValue) {
  const status = Number(statusValue);
  const map = {
    0: "Active",
    1: "Executed",
    2: "Rejected",
    3: "Cancelled",
    4: "Expired"
  };
  return map[status] || `Unknown (${status})`;
}

function normalizeProposal(raw, id, type) {
  const get = (name, index) => {
    if (raw?.[name] !== undefined) return raw[name];
    return raw?.[index];
  };

  const status = get("status", 9);
  return {
    id,
    type,
    proposedTarget: type === "issuer" ? get("proposedIssuer", 0) : get("proposedVerifier", 0),
    proposedBy: get("proposedBy", 1),
    organizationName: get("organizationName", 2),
    justification: get("justification", 3),
    evidenceURI: get("evidenceURI", 4),
    approvals: get("approvals", 6),
    rejections: get("rejections", 7),
    deadline: get("deadline", 8),
    status,
    statusLabel: proposalStatusLabel(status)
  };
}

function IssuerDashboard({ contract, onTxStatus, walletProps, txStatus }) {
  const [activeTab, setActiveTab] = useState("kyc");
  const [kycSubTab, setKycSubTab] = useState("register");
  const [fraudSubTab, setFraudSubTab] = useState("check");
  const [govSubTab, setGovSubTab] = useState("vote");
  const [identifier, setIdentifier] = useState("");
  const [verified, setVerified] = useState(true);
  const [fraudScore, setFraudScore] = useState(0);
  const [fraudReason, setFraudReason] = useState("");
  const [proposal, setProposal] = useState({
    target: "",
    organizationName: "",
    justification: "",
    evidenceURI: ""
  });
  const [proposalType, setProposalType] = useState("issuer");
  const [proposalId, setProposalId] = useState("");
  const [proposalData, setProposalData] = useState(null);
  const [proposalStatusFilter, setProposalStatusFilter] = useState("all");
  const [proposalLaneFilter, setProposalLaneFilter] = useState("all");
  const [voteApprove, setVoteApprove] = useState(true);
  const [identifierType, setIdentifierType] = useState("other");
  const [metadataJson, setMetadataJson] = useState('{"country":"IN"}');
  const [documentFile, setDocumentFile] = useState(null);
  const [kycRecord, setKycRecord] = useState(null);
  const [loadingKycRecord, setLoadingKycRecord] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [offChainData, setOffChainData] = useState(null);

  const kycHash = useMemo(() => (identifier ? hashIdentifier(identifier) : ""), [identifier]);

  async function handleAddKYC() {
    const receipt = await sendTx(contract.addKYC(kycHash, verified), onTxStatus);
    await uploadKycMetadata({
      hash: kycHash,
      identifierType,
      originalIdentifier: identifier,
      metadata: JSON.parse(metadataJson || "{}"),
      documentFile
    });
    toast.success(`KYC added: ${receipt.hash}`);
  }

  async function handleGetKYC() {
    setLoadingKycRecord(true);
    setOffChainData(null);
    try {
      const result = await contract.getKYC(kycHash);
      setKycRecord(result);
      
      // Fetch off-chain metadata
      try {
        const offChain = await getOffChainKyc(kycHash);
        if (offChain?.data) {
          setOffChainData(offChain.data);
        }
      } catch (err) {
        console.info("No off-chain metadata found for this hash.");
      }

      // Log access automatically for compliance
      try {
        await contract.logAccess(kycHash);
      } catch (error) {
        console.warn("Access log failed silently:", error?.message);
      }
      toast.success("KYC record loaded successfully");
    } finally {
      setLoadingKycRecord(false);
    }
  }

  async function handleCheckFraud() {
    setLoadingFraud(true);
    try {
      const result = await contract.getFraud(kycHash);
      // Convert Result object to plain object, handling both numeric indices and named properties
      const fraudReport = {
        score: result?.score !== undefined ? Number(result.score) : (result?.[0] !== undefined ? Number(result[0]) : null),
        reason: result?.reason !== undefined ? result.reason : (result?.[1] !== undefined ? result[1] : "")
      };
      setFraudData(fraudReport);
      // Log access automatically for compliance
      try {
        await contract.logAccess(kycHash);
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

  async function handleReportFraud() {
    const score = Number(fraudScore);
    if (score < 0 || score > 100) throw new Error("Fraud score must be between 0 and 100.");
    
    // Verify KYC record exists before reporting fraud
    try {
      const kycRecord = await contract.getKYC(kycHash);
      if (!kycRecord) {
        throw new Error("KYC record does not exist for this identifier.");
      }
    } catch (error) {
      throw new Error(`Cannot report fraud: KYC record not found for this identifier. ${error?.message || ""}`);
    }
    
    const receipt = await sendTx(contract.reportFraud(kycHash, score, fraudReason), onTxStatus);
    await mirrorFraudReport({
      hash: kycHash,
      score,
      reason: fraudReason,
      txHash: receipt.hash
    });
    toast.success(`Fraud reported: ${receipt.hash}`);
  }

  async function handleCreateProposal() {
    const { target, organizationName, justification, evidenceURI } = proposal;
    const txPromise =
      proposalType === "issuer"
        ? contract.proposeIssuer(target, organizationName, justification, evidenceURI)
        : contract.proposeVerifier(target, organizationName, justification, evidenceURI);
    const receipt = await sendTx(txPromise, onTxStatus);
    toast.success(`Proposal submitted: ${receipt.hash}`);
  }

  async function handleViewProposal() {
    const result =
      proposalType === "issuer"
        ? await contract.getIssuerProposal(Number(proposalId))
        : await contract.getVerifierProposal(Number(proposalId));
    setProposalData(result);
  }

  async function handleVote() {
    const txPromise =
      proposalType === "issuer"
        ? contract.voteIssuer(Number(proposalId), voteApprove)
        : contract.voteVerifier(Number(proposalId), voteApprove);
    const receipt = await sendTx(txPromise, onTxStatus);
    toast.success(`Vote submitted: ${receipt.hash}`);
  }

  async function handleCancelProposal() {
    const txPromise =
      proposalType === "issuer"
        ? contract.cancelIssuerProposal(Number(proposalId))
        : contract.cancelVerifierProposal(Number(proposalId));
    const receipt = await sendTx(txPromise, onTxStatus);
    toast.success(`Proposal cancelled: ${receipt.hash}`);
  }

  async function handleExpireProposal() {
    const txPromise =
      proposalType === "issuer"
        ? contract.expireIssuerProposal(Number(proposalId))
        : contract.expireVerifierProposal(Number(proposalId));
    const receipt = await sendTx(txPromise, onTxStatus);
    toast.success(`Proposal expired: ${receipt.hash}`);
  }

  async function fetchProposalsByType(type) {
    try {
      // Get count method name
      const countMethodName = type === "issuer" ? "issuerProposalCount" : "verifierProposalCount";
      const fetchMethodName = type === "issuer" ? "getIssuerProposal" : "getVerifierProposal";

      // Verify methods exist
      if (typeof contract[countMethodName] !== "function") {
        console.warn(`Method ${countMethodName} not found`);
        return [];
      }
      if (typeof contract[fetchMethodName] !== "function") {
        console.warn(`Method ${fetchMethodName} not found`);
        return [];
      }

      // Get total count
      const count = await contract[countMethodName]();
      const total = Number(count);

      if (total === 0) return [];

      // Exhaustively fetch 0 through total (inclusive).
      // This bulletproofs against both 0-based and 1-based index offsets used by different Solidity mappings
      // by simply grabbing the full spectrum and evicting any empty EVM struct responses.
      const fetchPromises = [];
      for (let i = 0; i <= total; i++) {
        fetchPromises.push(
          contract[fetchMethodName](i).then(raw => {
             return { id: i, type, raw };
          }).catch(err => null)
        );
      }
      
      const rawItems = await Promise.all(fetchPromises);
      
      const validItems = [];
      for (const item of rawItems) {
        if (!item || !item.raw) continue;
        
        const normalized = normalizeProposal(item.raw, item.id, type);
        
        // Evict empty/default structs returned by the EVM for uninitialized index mappings
        if (!normalized.proposedTarget || 
            normalized.proposedTarget === "0x0000000000000000000000000000000000000000" || 
            normalized.organizationName === "") {
            continue;
        }
        
        validItems.push(normalized);
      }
      
      return validItems;
    } catch (error) {
      console.error(`Error fetching ${type} proposals:`, error);
      return [];
    }
  }

  async function handleLoadAllProposals() {
    setLoadingProposals(true);
    try {
      if (!contract) {
        throw new Error("Contract not initialized");
      }

      // Fetch both issuer and verifier proposals in parallel
      const [issuerProposals, verifierProposals] = await Promise.all([
        fetchProposalsByType("issuer"),
        fetchProposalsByType("verifier")
      ]);

      // Combine results
      const allProposals = [...issuerProposals, ...verifierProposals];

      if (allProposals.length === 0) {
        setProposals([]);
        toast.success("No proposals found");
        return;
      }

      // Sort by type and then by id
      allProposals.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "issuer" ? -1 : 1;
        }
        return Number(a.id) - Number(b.id);
      });

      setProposals(allProposals);
      toast.success(`Loaded ${issuerProposals.length} issuer + ${verifierProposals.length} verifier proposal(s)`);
    } catch (error) {
      console.error("Load all proposals error:", error);
      toast.error(error?.shortMessage || error?.message || "Unable to load proposals");
      onTxStatus?.({ state: "error", message: error?.message || "Failed to load proposals" });
    } finally {
      setLoadingProposals(false);
    }
  }

  async function wrapAction(fn) {
    try {
      const noIdentifierNeeded = [
        handleCreateProposal,
        handleViewProposal,
        handleVote,
        handleCancelProposal,
        handleExpireProposal,
        handleLoadAllProposals
      ];
      if (!identifier.trim() && !noIdentifierNeeded.includes(fn)) {
        throw new Error("Identifier is required.");
      }
      await fn();
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || "Action failed");
      onTxStatus?.({ state: "error", message: error?.message || "Action failed" });
    }
  }

  const filteredProposals = proposals.filter((item) => {
    if (proposalStatusFilter === "all") return true;
    return String(Number(item.status)) === proposalStatusFilter;
  });
  const issuerProposals = filteredProposals.filter((p) => p.type === "issuer");
  const verifierProposals = filteredProposals.filter((p) => p.type === "verifier");
  const showIssuerLane = proposalLaneFilter === "all" || proposalLaneFilter === "issuer";
  const showVerifierLane = proposalLaneFilter === "all" || proposalLaneFilter === "verifier";
  const kycRecordSummary = summarizeKycRecord(kycRecord, kycHash);

  const sidebarItems = [
    { id: 'kyc', label: 'KYC Management', icon: ClipboardList },
    { id: 'fraud', label: 'Fraud Reporting', icon: AlertTriangle },
    { id: 'governance', label: 'Governance', icon: Scale },
  ];

  return (
    <DashboardLayout 
      sidebarItems={sidebarItems} 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      walletProps={walletProps}
    >
      <div className="tab-content slide-up">
        {activeTab === 'kyc' && (
          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: "1.5rem", borderBottom: "1px solid var(--border-muted)", paddingBottom: "1.5rem" }}>
              <div className="card-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px' }}><ClipboardList size={32} /></div>
              <div style={{ flexGrow: 1 }}>
                <h2 className="cyber-heading">KYC Management</h2>
                <p className="cyber-subheading" style={{ marginBottom: 0 }}>Add, search, and manage user identity records securely on the VeriChain network.</p>
              </div>
              <span className="cyber-badge success">Active Node</span>
            </div>

            <div className="horizontal-tabs" style={{ marginBottom: '2.5rem', display: 'inline-flex', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                className={`horizontal-tab ${kycSubTab === 'register' ? 'active' : ''}`}
                onClick={() => setKycSubTab('register')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <UserPlus className="tab-icon" size={18} /> Register Identity
              </button>
              <button 
                className={`horizontal-tab ${kycSubTab === 'lookup' ? 'active' : ''}`}
                onClick={() => setKycSubTab('lookup')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <Search className="tab-icon" size={18} /> Lookup Identity
              </button>
            </div>

            {kycSubTab === 'register' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><User size={16} /></span>
                    User Identifier
                  </label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or government ID"
                    className="neon-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><CheckCircle size={16} /></span>
                      Verification Status
                    </label>
                    <select
                      value={verified ? "true" : "false"}
                      onChange={(e) => setVerified(e.target.value === "true")}
                      className="neon-input"
                    >
                      <option value="true">Verified</option>
                      <option value="false">Not Verified</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🏷️</span>
                      Identifier Type
                    </label>
                    <select
                      value={identifierType}
                      onChange={(e) => setIdentifierType(e.target.value)}
                      className="neon-input"
                    >
                      <option value="email">Email</option>
                      <option value="id">Government ID</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><FileText size={16} /></span>
                    Metadata JSON
                  </label>
                  <textarea
                    value={metadataJson}
                    onChange={(e) => setMetadataJson(e.target.value)}
                    placeholder='{"country":"IN", "region":"Maharashtra"}'
                    className="form-textarea neon-input"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><Paperclip size={16} /></span>
                    KYC Document (IPFS)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    className="form-file neon-input"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem' }}
                  />
                </div>

                <div className="card-actions" style={{ marginTop: '2rem' }}>
                  <button className="cyber-button" onClick={() => wrapAction(handleAddKYC)} style={{ width: '100%', justifyContent: 'center' }}>
                    <span className="btn-icon"><Plus size={16} /></span>
                    Add KYC Record
                  </button>
                </div>
              </div>
            )}

            {kycSubTab === 'lookup' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><Search size={16} /></span>
                    Search Identifier
                  </label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter identifier to lookup"
                    className="neon-input"
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>Changes here sync with the registration form.</small>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><Lock size={16} /></span>
                    Computed Keccak256 Hash
                  </label>
                  <input value={kycHash} readOnly className="neon-input" style={{ opacity: 0.6 }} />
                </div>
                
                <div className="card-actions" style={{ marginTop: '2rem' }}>
                  <button
                    className="cyber-button"
                    onClick={() => wrapAction(handleGetKYC)}
                    disabled={loadingKycRecord}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span className="btn-icon">{loadingKycRecord ? <RefreshCw size={16} /> : <Search size={16} />}</span>
                    {loadingKycRecord ? 'Loading...' : 'Query Blockchain Record'}
                  </button>
                </div>

                {kycRecord && (
                  <div className="data-display slide-up" style={{ marginTop: '2rem', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-neon)' }}>
                    <h3 className="data-title" style={{ color: 'var(--accent-cyan)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={18} /> Record Retrieved
                    </h3>
                    <div className="data-block" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {kycRecordSummary.length ? (
                        kycRecordSummary.map((item) => (
                          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-muted)', paddingBottom: '0.5rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{item.label}:</span>
                            <span className={item.label === 'Hash' || item.label === 'Issuer' ? 'mono-value' : ''} style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>
                              {item.value}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--accent-rose)' }}>No valid data found on-chain.</div>
                      )}
                    </div>

                    {offChainData && (
                      <div className="data-block offchain-block slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-neon)' }}>
                        <h4 style={{ color: 'var(--accent-purple)', margin: '0 0 0.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Database size={18} /> Off-Chain Metadata
                        </h4>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-muted)', paddingBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Original Identifier:</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{offChainData.originalIdentifier}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-muted)', paddingBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Identity Type:</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{offChainData.identifierType}</span>
                        </div>

                        {offChainData.metadata && Object.entries(offChainData.metadata).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-muted)', paddingBottom: '0.5rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Metadata ({key}):</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{String(val)}</span>
                          </div>
                        ))}

                        {offChainData.ipfsCid && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', marginTop: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Attached Document:</span>
                            <a 
                              href={`https://gateway.pinata.cloud/ipfs/${offChainData.ipfsCid}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: 'var(--accent-blue)', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              View on IPFS <ExternalLink size={14} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="card-actions" style={{ marginTop: '1.5rem' }}>
                      <button className="cyber-button" onClick={() => { setKycRecord(null); setOffChainData(null); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                        <span className="btn-icon"><RefreshCw size={16} /></span> Clear Output
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: "2rem", borderBottom: "1px solid var(--border-muted)", paddingBottom: "1.5rem" }}>
              <div className="card-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px' }}><AlertTriangle size={32} /></div>
              <div style={{ flexGrow: 1 }}>
                <h2 className="cyber-heading">Fraud Reporting</h2>
                <p className="cyber-subheading">Identify and flag suspicious on-chain behavior associated with KYC records.</p>
              </div>
              <span className="cyber-badge warning">High Priority</span>
            </div>

            <div className="horizontal-tabs" style={{ marginBottom: '2.5rem', display: 'inline-flex', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                className={`horizontal-tab ${fraudSubTab === 'check' ? 'active' : ''}`}
                onClick={() => setFraudSubTab('check')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <Search className="tab-icon" size={18} /> Check Fraud Status
              </button>
              <button 
                className={`horizontal-tab ${fraudSubTab === 'report' ? 'active' : ''}`}
                onClick={() => setFraudSubTab('report')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <AlertTriangle className="tab-icon" size={18} /> Report Fraud
              </button>
            </div>

            {fraudSubTab === 'check' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><User size={16} /></span>
                    Target Identifier
                  </label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or government ID"
                    className="neon-input"
                  />
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>Changes here sync with the reporting form.</small>
                </div>
                
                <div className="card-actions" style={{ marginTop: '2rem' }}>
                  <button
                    className="cyber-button"
                    onClick={() => wrapAction(handleCheckFraud)}
                    disabled={loadingFraud}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span className="btn-icon">{loadingFraud ? <RefreshCw size={16} /> : <Search size={16} />}</span>
                    {loadingFraud ? 'Loading...' : 'Query Blockchain Status'}
                  </button>
                </div>

                {fraudData && (
                  <div className="data-display slide-up" style={{ marginTop: '2rem', background: 'var(--bg-elevated)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-neon)' }}>
                    <h3 className="data-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} /> Fraud Report Retrieved
                    </h3>
                    <div className="data-block">
                      {fraudData.score !== undefined && (
                        <div>
                          <strong>Risk Score:</strong> {fraudData.score}/100
                          <div className="score-bar" style={{ marginTop: '8px', marginBottom: '8px' }}>
                            <div
                              className="score-fill"
                              style={{
                                width: `${fraudData.score}%`,
                                backgroundColor: fraudData.score > 70 ? '#ef4444' : fraudData.score > 40 ? '#fbbf24' : '#22c55e',
                                height: '8px'
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                      {fraudData.reason && (
                        <div style={{ marginTop: '12px' }}>
                          <strong>Reason:</strong> {fraudData.reason}
                        </div>
                      )}
                    </div>
                    <div className="card-actions" style={{ marginTop: '1.5rem' }}>
                      <button className="cyber-button" onClick={() => setFraudData(null)}>
                        <span className="btn-icon"><Eraser size={16} /></span>
                        Clear Result
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fraudSubTab === 'report' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><User size={16} /></span>
                    Target Identifier
                  </label>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or government ID"
                    className="neon-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><AlertTriangle size={16} /></span>
                    Fraud Score (0-100)
                  </label>
                  <input
                    type="number"
                    value={fraudScore}
                    onChange={(e) => setFraudScore(e.target.value)}
                    min="0"
                    max="100"
                    className="neon-input"
                    placeholder="Enter risk score"
                  />
                  <div className="input-hint">
                    <div className="score-indicator">
                      <div className="score-bar">
                        <div
                          className="score-fill"
                          style={{
                            width: `${fraudScore}%`,
                            backgroundColor: fraudScore > 70 ? '#ef4444' : fraudScore > 40 ? '#fbbf24' : '#22c55e'
                          }}
                        ></div>
                      </div>
                      <span className="score-text">{fraudScore}/100</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">💬</span>
                    Fraud Reason
                  </label>
                  <textarea
                    value={fraudReason}
                    onChange={(e) => setFraudReason(e.target.value)}
                    placeholder="Describe suspicious behavior, unusual patterns, or evidence of fraud..."
                    className="form-textarea neon-input"
                    rows="4"
                  />
                </div>

                <div className="card-actions" style={{ marginTop: '2rem' }}>
                  <button className="cyber-button" onClick={() => wrapAction(handleReportFraud)} style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 8px 20px -5px rgba(244, 63, 94, 0.4)' }}>
                    <span className="btn-icon"><AlertTriangle size={16} /></span>
                    Submit Fraud Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="cyber-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: "1.5rem", borderBottom: "1px solid var(--border-muted)", paddingBottom: "1.5rem" }}>
              <div className="card-icon" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '12px' }}><Scale size={32} /></div>
              <div style={{ flexGrow: 1 }}>
                <h2 className="cyber-heading">Network Governance</h2>
                <p className="cyber-subheading" style={{ marginBottom: 0 }}>Participate directly in network governance by submitting, reviewing, and voting on proposals.</p>
              </div>
              <span className="cyber-badge governance">Voting</span>
            </div>

            <div className="horizontal-tabs" style={{ marginBottom: '2.5rem', display: 'inline-flex', padding: '0.5rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                className={`horizontal-tab ${govSubTab === 'vote' ? 'active' : ''}`}
                onClick={() => setGovSubTab('vote')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <Vote className="tab-icon" size={18} /> Review & Vote
              </button>
              <button 
                className={`horizontal-tab ${govSubTab === 'create' ? 'active' : ''}`}
                onClick={() => setGovSubTab('create')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <FileCode className="tab-icon" size={18} /> Submit Proposal
              </button>
              <button 
                className={`horizontal-tab ${govSubTab === 'list' ? 'active' : ''}`}
                onClick={() => setGovSubTab('list')}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.95rem' }}
              >
                <ClipboardList className="tab-icon" size={18} /> All Proposals
              </button>
            </div>

            {govSubTab === 'create' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">🏛️</span>
                    Proposal Category
                  </label>
                  <select
                    value={proposalType}
                    onChange={(e) => setProposalType(e.target.value)}
                    className="form-select"
                  >
                    <option value="issuer">Issuer Proposal</option>
                    <option value="verifier">Verifier Proposal</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><Target size={16} /></span>
                      Target Address
                    </label>
                    <input
                      value={proposal.target}
                      onChange={(e) => setProposal({ ...proposal, target: e.target.value })}
                      placeholder="0x..."
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon"><Building size={16} /></span>
                      Organization Name
                    </label>
                    <input
                      value={proposal.organizationName}
                      onChange={(e) => setProposal({ ...proposal, organizationName: e.target.value })}
                      placeholder="Organization name"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><MessageSquare size={16} /></span>
                    Justification
                  </label>
                  <textarea
                    value={proposal.justification}
                    onChange={(e) => setProposal({ ...proposal, justification: e.target.value })}
                    placeholder="Explain why this proposal should be approved..."
                    className="form-textarea"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon"><LinkIcon size={16} /></span>
                    Evidence URI
                  </label>
                  <input
                    value={proposal.evidenceURI}
                    onChange={(e) => setProposal({ ...proposal, evidenceURI: e.target.value })}
                    placeholder="IPFS hash or external link"
                    className="form-input"
                  />
                </div>

                <div className="card-actions">
                  <button className="cyber-button" onClick={() => wrapAction(handleCreateProposal)}>
                    <span className="btn-icon"><FileText size={16} /></span>
                    Submit Proposal
                  </button>
                </div>
              </div>
            )}

            {govSubTab === 'vote' && (
              <div className="form-section slide-up">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">🏛️</span>
                    Proposal Category
                  </label>
                  <select
                    value={proposalType}
                    onChange={(e) => setProposalType(e.target.value)}
                    className="form-select"
                  >
                    <option value="issuer">🏢 Issuer Proposals</option>
                    <option value="verifier">🔍 Verifier Proposals</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">🔍</span>
                    Proposal ID
                  </label>
                  <input
                    value={proposalId}
                    onChange={(e) => setProposalId(e.target.value)}
                    placeholder="Enter proposal ID"
                    className="form-input"
                  />
                </div>

                <div className="voting-section">
                  <div className="vote-controls">
                    <label className="form-label">
                      <span className="label-icon">🗳️</span>
                      Your Vote
                    </label>
                    <div className="vote-buttons">
                      <button
                        className={`vote-btn ${voteApprove ? 'active' : ''}`}
                        onClick={() => setVoteApprove(true)}
                      >
                        ✅ Approve
                      </button>
                      <button
                        className={`vote-btn ${!voteApprove ? 'active' : ''}`}
                        onClick={() => setVoteApprove(false)}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="cyber-button" onClick={() => wrapAction(handleViewProposal)}>
                    <span className="btn-icon"><Search size={16} /></span>
                    View Proposal
                  </button>
                  <button className="cyber-button" onClick={() => wrapAction(handleVote)}>
                    <span className="btn-icon"><Vote size={16} /></span>
                    Cast Vote
                  </button>
                  <button className="cyber-button" onClick={() => wrapAction(handleCancelProposal)}>
                    <span className="btn-icon"><AlertTriangle size={16} /></span>
                    Cancel
                  </button>
                  <button className="cyber-button" onClick={() => wrapAction(handleExpireProposal)}>
                    <span className="btn-icon"><RefreshCw size={16} /></span>
                    Expire
                  </button>
                </div>

                {proposalData && (
                  <div className="proposal-data">
                    <h3 className="data-title">Proposal Details</h3>
                    <pre className="data-block">{toDisplayJson(proposalData)}</pre>
                  </div>
                )}
              </div>
            )}

            {govSubTab === 'list' && (
              <div className="form-section slide-up">

              <div className="card-actions proposal-list-toolbar">
                <button
                  className="cyber-button"
                  onClick={() => wrapAction(handleLoadAllProposals)}
                  disabled={loadingProposals}
                >
                  <span className="btn-icon">{loadingProposals ? <RefreshCw size={16} /> : <Search size={16} />}</span>
                  {loadingProposals ? 'Loading...' : 'Load Proposals'}
                </button>
                <select
                  className="form-select"
                  value={proposalStatusFilter}
                  onChange={(e) => setProposalStatusFilter(e.target.value)}
                  style={{ maxWidth: "220px" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="0">Active</option>
                  <option value="1">Executed</option>
                  <option value="2">Rejected</option>
                  <option value="3">Cancelled</option>
                  <option value="4">Expired</option>
                </select>
              </div>

              <div className="proposal-lane-tabs" role="tablist" aria-label="Proposal type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={proposalLaneFilter === "all"}
                  className={`proposal-lane-tab ${proposalLaneFilter === "all" ? "proposal-lane-tab--active" : ""}`}
                  onClick={() => setProposalLaneFilter("all")}
                >
                  All proposals
                  <span className="proposal-lane-tab__hint">Issuer + Verifier</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={proposalLaneFilter === "issuer"}
                  className={`proposal-lane-tab proposal-lane-tab--issuer ${proposalLaneFilter === "issuer" ? "proposal-lane-tab--active-issuer" : ""}`}
                  onClick={() => setProposalLaneFilter("issuer")}
                >
                  Issuer only
                  <span className="proposal-lane-tab__hint">{issuerProposals.length} in view</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={proposalLaneFilter === "verifier"}
                  className={`proposal-lane-tab proposal-lane-tab--verifier ${proposalLaneFilter === "verifier" ? "proposal-lane-tab--active-verifier" : ""}`}
                  onClick={() => setProposalLaneFilter("verifier")}
                >
                  Verifier only
                  <span className="proposal-lane-tab__hint">{verifierProposals.length} in view</span>
                </button>
              </div>

              {filteredProposals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <p className="empty-text">No proposals found for selected status</p>
                  <p className="empty-hint">Click "Load Proposals" and change status filter</p>
                </div>
              ) : (
                <div
                  className={`proposals-split ${proposalLaneFilter === "all" ? "proposals-split--two-col" : "proposals-split--single"}`}
                >
                  {showIssuerLane && (
                    <section className="proposals-section proposals-section--issuer proposals-section--standalone" aria-labelledby="issuer-proposals-heading">
                      <header className="proposals-section__header proposals-section__header--issuer">
                        <div className="proposals-section__title-wrap">
                          <span className="proposals-section__eyebrow">Section A</span>
                          <h3 id="issuer-proposals-heading" className="proposals-section__title">Issuer proposals</h3>
                          <p className="proposals-section__desc">On-chain votes to add or change issuer roles</p>
                        </div>
                        <span className="proposals-section__count proposals-section__count--issuer">{issuerProposals.length}</span>
                      </header>
                      {issuerProposals.length === 0 ? (
                        <p className="proposals-section__empty">No issuer proposals for this status filter.</p>
                      ) : (
                        <div className="proposals-grid proposals-grid--issuer">
                          {issuerProposals.map((item) => (
                            <ProposalCard key={`issuer-${item.id}`} item={item} />
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {showVerifierLane && (
                    <section className="proposals-section proposals-section--verifier proposals-section--standalone" aria-labelledby="verifier-proposals-heading">
                      <header className="proposals-section__header proposals-section__header--verifier">
                        <div className="proposals-section__title-wrap">
                          <span className="proposals-section__eyebrow">Section B</span>
                          <h3 id="verifier-proposals-heading" className="proposals-section__title">Verifier proposals</h3>
                          <p className="proposals-section__desc">On-chain votes to add or change verifier roles</p>
                        </div>
                        <span className="proposals-section__count proposals-section__count--verifier">{verifierProposals.length}</span>
                      </header>
                      {verifierProposals.length === 0 ? (
                        <p className="proposals-section__empty">No verifier proposals for this status filter.</p>
                      ) : (
                        <div className="proposals-grid proposals-grid--verifier">
                          {verifierProposals.map((item) => (
                            <ProposalCard key={`verifier-${item.id}`} item={item} />
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ProposalCard({ item }) {
  const isIssuer = item.type === "issuer";
  const variant = isIssuer ? "issuer" : "verifier";
  const label = isIssuer ? "Issuer" : "Verifier";
  const icon = isIssuer ? "🏢" : "🔍";

  return (
    <article className={`proposal-card proposal-card--${variant}`}>
      <div className={`proposal-card__accent proposal-card__accent--${variant}`} aria-hidden />
      <div className="proposal-card__header">
        <div className="proposal-card__id-block">
          <span className={`proposal-card__pill proposal-card__pill--${variant}`}>{label}</span>
          <h4 className="proposal-card__heading">
            {icon} Proposal #{item.id}
          </h4>
        </div>
        <span className={`status-badge status-${item.statusLabel.toLowerCase()}`}>
          {item.statusLabel}
        </span>
      </div>

      <div className="proposal-card__body">
        <dl className="proposal-card__meta">
          <div className="proposal-card__meta-row">
            <dt>Target</dt>
            <dd className="proposal-card__mono">{item.proposedTarget || "—"}</dd>
          </div>
          <div className="proposal-card__meta-row">
            <dt>Proposed by</dt>
            <dd className="proposal-card__mono">{item.proposedBy || "—"}</dd>
          </div>
          <div className="proposal-card__meta-row proposal-card__meta-row--full">
            <dt>Organization</dt>
            <dd>{item.organizationName || "—"}</dd>
          </div>
          <div className="proposal-card__meta-row proposal-card__meta-row--full">
            <dt>Justification</dt>
            <dd className="field-value description">{item.justification || "—"}</dd>
          </div>
          {item.evidenceURI ? (
            <div className="proposal-card__meta-row proposal-card__meta-row--full">
              <dt>Evidence</dt>
              <dd>
                <a href={item.evidenceURI} target="_blank" rel="noopener noreferrer" className={`field-link proposal-card__link--${variant}`}>
                  Open link
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className={`proposal-stats proposal-stats--${variant}`}>
          <div className="stat-item">
            <span className="stat-label">Approvals</span>
            <span className="stat-value approve">{String(item.approvals ?? 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Rejections</span>
            <span className="stat-value reject">{String(item.rejections ?? 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Deadline</span>
            <span className="stat-value proposal-card__mono">{String(item.deadline ?? "—")}</span>
          </div>
        </div>

        <details className="proposal-details-toggle">
          <summary className="details-summary">Raw proposal data</summary>
          <pre className="data-block details-content">{toDisplayJson(item)}</pre>
        </details>
      </div>
    </article>
  );
}

export default IssuerDashboard;

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { hashIdentifier, sendTx } from "../utils/contract";
import { mirrorFraudReport, uploadKycMetadata } from "../utils/api";

function toDisplayJson(value) {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
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

function IssuerDashboard({ contract, onTxStatus }) {
  const [activeTab, setActiveTab] = useState("kyc");
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
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

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

  async function handleUpdateKYC() {
    // Some deployed ABI variants expose only addKYC, which behaves as upsert.
    const txPromise =
      typeof contract.updateKYC === "function"
        ? contract.updateKYC(kycHash, verified)
        : contract.addKYC(kycHash, verified);
    const receipt = await sendTx(txPromise, onTxStatus);
    toast.success(`KYC updated: ${receipt.hash}`);
  }

  async function handleReportFraud() {
    const score = Number(fraudScore);
    if (score < 0 || score > 100) throw new Error("Fraud score must be between 0 and 100.");
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

      // Fetch all proposals
      const items = await Promise.all(
        Array.from({ length: total }, async (_, index) => {
          let id = index;
          let raw;

          try {
            // Try 0-based index first
            try {
              raw = await contract[fetchMethodName](id);
            } catch (err) {
              // Fallback to 1-based index
              id = index + 1;
              raw = await contract[fetchMethodName](id);
            }

            return {
              id,
              type,
              ...raw,
              statusLabel: proposalStatusLabel(raw.status)
            };
          } catch (err) {
            console.warn(`Skipping invalid ${type} proposal at index ${index}:`, err.message);
            return null;
          }
        })
      );

      // Keep all valid proposals; filter in UI.
      return items
        .filter((item) => item !== null)
        .map((item) => normalizeProposal(item, item.id, type));
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

  return (
    <div className="issuer-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-icon">🏢</div>
          <div>
            <h1 className="dashboard-title">Issuer Dashboard</h1>
            <p className="dashboard-subtitle">Manage KYC records, report fraud, and participate in governance</p>
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
          KYC Management
        </button>
        <button
          className={`tab-button ${activeTab === 'fraud' ? 'active' : ''}`}
          onClick={() => setActiveTab('fraud')}
        >
          <span className="tab-icon">🚨</span>
          Fraud Reporting
        </button>
        <button
          className={`tab-button ${activeTab === 'governance' ? 'active' : ''}`}
          onClick={() => setActiveTab('governance')}
        >
          <span className="tab-icon">⚖️</span>
          Governance
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'kyc' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-icon">📋</div>
              <h2 className="card-title">KYC Management</h2>
              <span className="card-badge core">Active</span>
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

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔒</span>
                  Hashed Identifier
                </label>
                <input value={kycHash} readOnly className="form-input readonly" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">✅</span>
                    Verification Status
                  </label>
                  <select
                    value={verified ? "true" : "false"}
                    onChange={(e) => setVerified(e.target.value === "true")}
                    className="form-select"
                  >
                    <option value="true">✅ Verified</option>
                    <option value="false">❌ Not Verified</option>
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
                    className="form-select"
                  >
                    <option value="email">📧 Email</option>
                    <option value="id">🆔 Government ID</option>
                    <option value="other">📄 Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📊</span>
                  Metadata JSON
                </label>
                <textarea
                  value={metadataJson}
                  onChange={(e) => setMetadataJson(e.target.value)}
                  placeholder='{"country":"IN", "region":"Maharashtra"}'
                  className="form-textarea"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📎</span>
                  KYC Document (IPFS)
                </label>
                <input
                  type="file"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  className="form-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
              </div>

              <div className="card-actions">
                <button className="btn-primary" onClick={() => wrapAction(handleAddKYC)}>
                  <span className="btn-icon">➕</span>
                  Add KYC Record
                </button>
                <button className="btn-secondary" onClick={() => wrapAction(handleUpdateKYC)}>
                  <span className="btn-icon">🔄</span>
                  Update KYC Record
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="dashboard-card">
            <div className="card-header">
              <div className="card-icon">🚨</div>
              <h2 className="card-title">Fraud Reporting</h2>
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

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📈</span>
                  Fraud Score (0-100)
                </label>
                <input
                  type="number"
                  value={fraudScore}
                  onChange={(e) => setFraudScore(e.target.value)}
                  min="0"
                  max="100"
                  className="form-input"
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
                  <span className="label-icon">📝</span>
                  Fraud Reason
                </label>
                <textarea
                  value={fraudReason}
                  onChange={(e) => setFraudReason(e.target.value)}
                  placeholder="Describe suspicious behavior, unusual patterns, or evidence of fraud..."
                  className="form-textarea"
                  rows="4"
                />
              </div>

              <div className="card-actions">
                <button className="btn-danger" onClick={() => wrapAction(handleReportFraud)}>
                  <span className="btn-icon">🚨</span>
                  Report Fraud
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="governance-section">
            {/* Proposal Creation Section */}
            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon">📜</div>
                <h2 className="card-title">Create Proposal</h2>
                <span className="card-badge governance">Governance</span>
              </div>

              <div className="form-section">
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
                    <option value="issuer">🏢 Issuer Proposal</option>
                    <option value="verifier">🔍 Verifier Proposal</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <span className="label-icon">🎯</span>
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
                      <span className="label-icon">🏢</span>
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
                    <span className="label-icon">💬</span>
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
                    <span className="label-icon">🔗</span>
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
                  <button className="btn-governance" onClick={() => wrapAction(handleCreateProposal)}>
                    <span className="btn-icon">📜</span>
                    Submit Proposal
                  </button>
                </div>
              </div>
            </div>

            {/* Proposal Management Section */}
            <div className="dashboard-card">
              <div className="card-header">
                <div className="card-icon">⚖️</div>
                <h2 className="card-title">Proposal Management</h2>
                <span className="card-badge governance">Voting</span>
              </div>

              <div className="form-section">
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
                  <button className="btn-info" onClick={() => wrapAction(handleViewProposal)}>
                    <span className="btn-icon">👁️</span>
                    View Proposal
                  </button>
                  <button className="btn-primary" onClick={() => wrapAction(handleVote)}>
                    <span className="btn-icon">🗳️</span>
                    Cast Vote
                  </button>
                  <button className="btn-warning" onClick={() => wrapAction(handleCancelProposal)}>
                    <span className="btn-icon">🚫</span>
                    Cancel
                  </button>
                  <button className="btn-secondary" onClick={() => wrapAction(handleExpireProposal)}>
                    <span className="btn-icon">⏰</span>
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
            </div>

            {/* All Proposals Section */}
            <div className="dashboard-card full-width">
              <div className="card-header">
                <div className="card-icon">📋</div>
                <h2 className="card-title">All Proposals</h2>
                <span className="card-badge info">{filteredProposals.length} Showing</span>
              </div>

              <div className="card-actions proposal-list-toolbar">
                <button
                  className="btn-info"
                  onClick={() => wrapAction(handleLoadAllProposals)}
                  disabled={loadingProposals}
                >
                  <span className="btn-icon">{loadingProposals ? '⏳' : '🔄'}</span>
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
          </div>
        )}
      </div>
    </div>
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

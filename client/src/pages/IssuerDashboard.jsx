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

function IssuerDashboard({ contract, onTxStatus }) {
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

  async function handleLoadAllProposals() {
    setLoadingProposals(true);
    try {
      const count =
        proposalType === "issuer"
          ? await contract.issuerProposalCount()
          : await contract.verifierProposalCount();

      const total = Number(count);
      const fetchProposal = async (id) => (
        proposalType === "issuer"
          ? contract.getIssuerProposal(id)
          : contract.getVerifierProposal(id)
      );

      const items = await Promise.all(
        Array.from({ length: total }, async (_, index) => {
          let id = index;
          let raw;
          try {
            // Most contracts with proposalCount use zero-based indexing.
            raw = await fetchProposal(id);
          } catch {
            // Fallback for one-based indexing variants.
            id = index + 1;
            raw = await fetchProposal(id);
          }
          return {
            id,
            ...raw,
            statusLabel: proposalStatusLabel(raw.status)
          };
        })
      );

      const activeOnly = items.filter((item) => Number(item.status) === 0);
      setProposals(activeOnly);
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || "Unable to load proposals");
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

  return (
    <section className="grid-2">
      <div className="panel">
        <h2>Issuer - KYC Management</h2>
        <label>User Identifier</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="email or government ID" />
        <label>Hashed Identifier</label>
        <input value={kycHash} readOnly />

        <label>Verified Status</label>
        <select value={verified ? "true" : "false"} onChange={(e) => setVerified(e.target.value === "true")}>
          <option value="true">Verified</option>
          <option value="false">Not Verified</option>
        </select>
        <label>Identifier Type (off-chain)</label>
        <select value={identifierType} onChange={(e) => setIdentifierType(e.target.value)}>
          <option value="email">Email</option>
          <option value="id">ID</option>
          <option value="other">Other</option>
        </select>
        <label>Metadata JSON (off-chain)</label>
        <textarea value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} />
        <label>KYC Document (optional, IPFS)</label>
        <input type="file" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} />

        <div className="actions">
          <button onClick={() => wrapAction(handleAddKYC)}>Add KYC</button>
          <button onClick={() => wrapAction(handleUpdateKYC)}>Update KYC</button>
        </div>
      </div>

      <div className="panel">
        <h2>Issuer - Fraud Reporting</h2>
        <label>Fraud Score (0-100)</label>
        <input type="number" value={fraudScore} onChange={(e) => setFraudScore(e.target.value)} min="0" max="100" />
        <label>Reason</label>
        <textarea value={fraudReason} onChange={(e) => setFraudReason(e.target.value)} placeholder="Suspicious behavior details" />
        <button onClick={() => wrapAction(handleReportFraud)}>Report Fraud</button>
      </div>

      <div className="panel">
        <h2>DAO Proposal</h2>
        <label>Proposal Category</label>
        <select value={proposalType} onChange={(e) => setProposalType(e.target.value)}>
          <option value="issuer">Issuer Proposal</option>
          <option value="verifier">Verifier Proposal</option>
        </select>
        <label>Target Address</label>
        <input value={proposal.target} onChange={(e) => setProposal({ ...proposal, target: e.target.value })} />
        <label>Organization Name</label>
        <input value={proposal.organizationName} onChange={(e) => setProposal({ ...proposal, organizationName: e.target.value })} />
        <label>Justification</label>
        <textarea value={proposal.justification} onChange={(e) => setProposal({ ...proposal, justification: e.target.value })} />
        <label>Evidence URI</label>
        <input value={proposal.evidenceURI} onChange={(e) => setProposal({ ...proposal, evidenceURI: e.target.value })} />
        <button onClick={() => wrapAction(handleCreateProposal)}>Create Proposal</button>
      </div>

      <div className="panel">
        <h2>Proposal Lookup & Voting</h2>
        <label>Proposal Category</label>
        <select value={proposalType} onChange={(e) => setProposalType(e.target.value)}>
          <option value="issuer">Issuer Proposal</option>
          <option value="verifier">Verifier Proposal</option>
        </select>
        <label>Proposal ID</label>
        <input value={proposalId} onChange={(e) => setProposalId(e.target.value)} placeholder="0" />
        <div className="actions">
          <button onClick={() => wrapAction(handleViewProposal)}>View Proposal</button>
          <select value={voteApprove ? "true" : "false"} onChange={(e) => setVoteApprove(e.target.value === "true")}>
            <option value="true">Approve</option>
            <option value="false">Reject</option>
          </select>
          <button onClick={() => wrapAction(handleVote)}>Vote</button>
          <button onClick={() => wrapAction(handleCancelProposal)}>Cancel</button>
          <button onClick={() => wrapAction(handleExpireProposal)}>Expire</button>
        </div>

        {proposalData && (
          <pre className="data-block">{toDisplayJson(proposalData)}</pre>
        )}
      </div>

      <div className="panel full-span">
        <h2>All Proposals ({proposalType})</h2>
        <div className="actions">
          <button onClick={() => wrapAction(handleLoadAllProposals)} disabled={loadingProposals}>
            {loadingProposals ? "Loading..." : "Load All Proposals"}
          </button>
        </div>
        {proposals.length === 0 ? (
          <p>No proposals loaded.</p>
        ) : (
          <div className="grid-2">
            {proposals.map((item) => (
              <div className="panel" key={`${proposalType}-${item.id}`}>
                <h3>Proposal #{item.id}</h3>
                <p><strong>Status:</strong> {item.statusLabel}</p>
                <p><strong>Target:</strong> {proposalType === "issuer" ? item.proposedIssuer : item.proposedVerifier}</p>
                <p><strong>Proposed By:</strong> {item.proposedBy}</p>
                <p><strong>Organization:</strong> {item.organizationName}</p>
                <p><strong>Justification:</strong> {item.justification}</p>
                <p><strong>Evidence URI:</strong> {item.evidenceURI}</p>
                <p><strong>Approvals:</strong> {String(item.approvals)}</p>
                <p><strong>Rejections:</strong> {String(item.rejections)}</p>
                <p><strong>Deadline:</strong> {String(item.deadline)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default IssuerDashboard;

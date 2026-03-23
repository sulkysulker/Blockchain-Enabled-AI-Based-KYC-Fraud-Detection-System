import { useState } from "react";
import toast from "react-hot-toast";
import { hashIdentifier, sendTx } from "../utils/contract";
import { getOffChainKyc } from "../utils/api";

function toDisplayJson(value) {
  return JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2
  );
}

function VerifierDashboard({ contract, onTxStatus }) {
  const [identifier, setIdentifier] = useState("");
  const [kycData, setKycData] = useState(null);
  const [fraudData, setFraudData] = useState(null);
  const [accessLogs, setAccessLogs] = useState(null);
  const [offChainData, setOffChainData] = useState(null);

  function getHash() {
    return hashIdentifier(identifier);
  }

  async function handleViewKYC() {
    try {
      const hash = getHash();
      const result = await contract.getKYC(hash);
      setKycData(result);
    } catch (error) {
      toast.error(error?.message || "Unable to fetch KYC");
    }
  }

  async function handleLogAccess() {
    try {
      const hash = getHash();
      const receipt = await sendTx(contract.logAccess(hash), onTxStatus);
      toast.success(`Access logged: ${receipt.hash}`);
    } catch (error) {
      toast.error(error?.message || "Unable to log access");
    }
  }

  async function handleViewAccessLogs() {
    try {
      const hash = getHash();
      const logs = await contract.getAccessLogs(hash);
      setAccessLogs(logs);
    } catch (error) {
      toast.error(error?.message || "Unable to fetch logs");
    }
  }

  async function handleViewOffChainKyc() {
    try {
      const hash = getHash();
      const data = await getOffChainKyc(hash);
      setOffChainData(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to fetch off-chain KYC");
    }
  }

  async function handleViewFraud() {
    try {
      const hash = getHash();
      const fraud = await contract.getFraud(hash);
      setFraudData(fraud);
    } catch (error) {
      toast.error(error?.message || "Unable to fetch fraud data");
    }
  }

  return (
    <section className="grid-2">
      <div className="panel">
        <h2>Verifier - KYC Lookup</h2>
        <label>User Identifier</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="email or ID" />
        <div className="actions">
          <button onClick={handleViewKYC}>View KYC</button>
          <button onClick={handleViewFraud}>View Fraud</button>
          <button onClick={handleLogAccess}>Log Access</button>
          <button onClick={handleViewAccessLogs}>View Access Logs</button>
          <button onClick={handleViewOffChainKyc}>View Off-chain KYC</button>
        </div>
      </div>

      <div className="panel">
        <h2>KYC Data</h2>
        {kycData ? <pre className="data-block">{toDisplayJson(kycData)}</pre> : <p>No KYC loaded.</p>}
      </div>

      <div className="panel full-span">
        <h2>Fraud Data</h2>
        {fraudData ? <pre className="data-block">{toDisplayJson(fraudData)}</pre> : <p>No fraud data loaded.</p>}
      </div>

      <div className="panel full-span">
        <h2>Access Logs</h2>
        {accessLogs ? <pre className="data-block">{toDisplayJson(accessLogs)}</pre> : <p>No logs loaded.</p>}
      </div>

      <div className="panel full-span">
        <h2>Off-chain KYC Record</h2>
        {offChainData ? <pre className="data-block">{toDisplayJson(offChainData)}</pre> : <p>No off-chain record loaded.</p>}
      </div>
    </section>
  );
}

export default VerifierDashboard;

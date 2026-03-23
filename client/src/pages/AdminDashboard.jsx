import { useState } from "react";
import toast from "react-hot-toast";
import { sendTx } from "../utils/contract";

function AdminDashboard({ contract, onTxStatus }) {
  const [initialIssuer, setInitialIssuer] = useState("");
  const [votingPeriodSeconds, setVotingPeriodSeconds] = useState("");

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

  return (
    <section className="grid-2">
      <div className="panel">
        <h2>Admin - Bootstrap</h2>
        <label>Initial Issuer Address</label>
        <input value={initialIssuer} onChange={(e) => setInitialIssuer(e.target.value)} placeholder="0x..." />
        <div className="actions">
          <button onClick={() => wrapAction(handleAddInitialIssuer)}>Add Initial Issuer</button>
          <button onClick={() => wrapAction(handleFinalizeBootstrap)}>Finalize Bootstrap</button>
        </div>
      </div>

      <div className="panel">
        <h2>Admin - Governance Config</h2>
        <label>Voting Period (seconds)</label>
        <input
          type="number"
          value={votingPeriodSeconds}
          onChange={(e) => setVotingPeriodSeconds(e.target.value)}
          placeholder="86400"
        />
        <button onClick={() => wrapAction(handleSetVotingPeriod)}>Set Voting Period</button>
      </div>
    </section>
  );
}

export default AdminDashboard;

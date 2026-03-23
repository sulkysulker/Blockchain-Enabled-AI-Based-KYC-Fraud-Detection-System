function TxStatus({ txStatus }) {
  if (!txStatus?.state) return null;

  return (
    <div className={`tx-status ${txStatus.state}`}>
      <strong>{txStatus.state.toUpperCase()}</strong>
      <span>{txStatus.message}</span>
    </div>
  );
}

export default TxStatus;

import { useState } from "react";
import { Settings, Building } from "lucide-react";
import AdminDashboard from "./AdminDashboard";
import IssuerDashboard from "./IssuerDashboard";

function AdminIssuerDashboard({ contract, onTxStatus, walletProps, txStatus }) {
  const [activeView, setActiveView] = useState("admin");

  const viewItems = [
    { id: "admin", label: "Admin Settings", icon: Settings },
    { id: "issuer", label: "Issuer Settings", icon: Building }
  ];

  return (
    <div className="slide-up">
      <nav className="horizontal-tabs" style={{ marginBottom: "1rem" }}>
        {viewItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`horizontal-tab ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <Icon size={18} className="tab-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {activeView === "admin" ? (
        <AdminDashboard contract={contract} onTxStatus={onTxStatus} walletProps={walletProps} txStatus={txStatus} />
      ) : (
        <IssuerDashboard contract={contract} onTxStatus={onTxStatus} walletProps={walletProps} txStatus={txStatus} />
      )}
    </div>
  );
}

export default AdminIssuerDashboard;
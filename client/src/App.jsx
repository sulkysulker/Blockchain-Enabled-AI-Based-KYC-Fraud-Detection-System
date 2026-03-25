import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import WalletBar from "./components/WalletBar";
import TxStatus from "./components/TxStatus";
import AdminDashboard from "./pages/AdminDashboard";
import IssuerDashboard from "./pages/IssuerDashboard";
import VerifierDashboard from "./pages/VerifierDashboard";
import LandingPage from "./pages/LandingPage";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { getContract } from "./utils/contract";
import {
  connectWallet,
  initializeWalletSilently,
  onAccountsChanged,
  onChainChanged,
  SEPOLIA_CHAIN_ID_HEX,
  switchToSepolia
} from "./utils/connectWallet";
import NasaParticles from "./components/Nasa";

const ROLE_KEYS = ["admin", "issuer", "verifier"];

function getRoleLabel(roles) {
  if (roles.admin) return "Admin";
  if (roles.issuer) return "Issuer";
  if (roles.verifier) return "Verifier";
  return "Unassigned";
}

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [roles, setRoles] = useState({ admin: false, issuer: false, verifier: false });
  const [txStatus, setTxStatus] = useState({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const contract = useMemo(() => {
    if (!signer && !provider) return null;
    try {
      return getContract(signer || provider);
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }, [signer, provider]);

  async function detectRole(currentAccount, activeContract) {
    if (!currentAccount || !activeContract) return;
    setLoadingRoles(true);
    try {
      const accountLower = currentAccount.toLowerCase();

      // Preferred path from your original requirements.
      if (typeof activeContract.getRoles === "function") {
        const roleData = await activeContract.getRoles(currentAccount);
        const mapped = ROLE_KEYS.reduce((acc, key, index) => {
          acc[key] = Boolean(roleData[index]);
          return acc;
        }, {});
        setRoles(mapped);
        return;
      }

      // Compatibility path for ABI variants like your current contract.
      const [adminAddress, isIssuer, isVerifier] = await Promise.all([
        typeof activeContract.admin === "function" ? activeContract.admin() : "",
        typeof activeContract.issuers === "function" ? activeContract.issuers(currentAccount) : false,
        typeof activeContract.verifiers === "function" ? activeContract.verifiers(currentAccount) : false
      ]);

      setRoles({
        admin: Boolean(adminAddress) && adminAddress.toLowerCase() === accountLower,
        issuer: Boolean(isIssuer),
        verifier: Boolean(isVerifier)
      });
    } catch (error) {
      toast.error(error?.message || "Failed to detect role");
    } finally {
      setLoadingRoles(false);
    }
  }

  async function handleConnect() {
    try {
      const result = await connectWallet();
      setAccount(result.account);
      setChainId(result.chainId);
      setProvider(result.provider);
      setSigner(result.signer);
    } catch (error) {
      toast.error(error?.message || "Wallet connection failed");
    }
  }

  useEffect(() => {
    initializeWalletSilently()
      .then((wallet) => {
        if (wallet.account) {
          setAccount(wallet.account);
          setChainId(wallet.chainId);
          setProvider(wallet.provider);
          setSigner(wallet.signer);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (account && contract) {
      detectRole(account, contract);
    }
  }, [account, contract]);

  useEffect(() => {
    if (!contract) return undefined;
    const hasEvent = (eventName) => {
      try {
        contract.interface.getEvent(eventName);
        return true;
      } catch {
        return false;
      }
    };

    const onKycAdded = (hash) => {
      toast.success(`KYCAdded event: ${hash}`);
    };
    const onIssuerProposalCreated = (id) => {
      toast.success(`Issuer proposal created: #${id.toString()}`);
    };
    const onVerifierProposalCreated = (id) => {
      toast.success(`Verifier proposal created: #${id.toString()}`);
    };

    if (hasEvent("KYCAdded")) {
      contract.on("KYCAdded", onKycAdded);
    }
    if (hasEvent("IssuerProposalCreated")) {
      contract.on("IssuerProposalCreated", onIssuerProposalCreated);
    }
    if (hasEvent("VerifierProposalCreated")) {
      contract.on("VerifierProposalCreated", onVerifierProposalCreated);
    }

    return () => {
      if (hasEvent("KYCAdded")) {
        contract.off("KYCAdded", onKycAdded);
      }
      if (hasEvent("IssuerProposalCreated")) {
        contract.off("IssuerProposalCreated", onIssuerProposalCreated);
      }
      if (hasEvent("VerifierProposalCreated")) {
        contract.off("VerifierProposalCreated", onVerifierProposalCreated);
      }
    };
  }, [contract]);

  useEffect(() => {
    try {
      onAccountsChanged((accounts) => {
        setAccount(accounts?.[0] || "");
        setTxStatus({});
      });
      onChainChanged((newChainId) => {
        setChainId(newChainId);
        setTxStatus({});
      });
    } catch {
      // MetaMask unavailable until extension is installed.
    }
  }, []);

  async function handleSwitchNetwork() {
    try {
      await switchToSepolia();
      toast.success("Switched to Sepolia");
    } catch (error) {
      toast.error(error?.message || "Unable to switch network");
    }
  }

  const roleLabel = getRoleLabel(roles);
  const isSepolia = chainId.toLowerCase() === SEPOLIA_CHAIN_ID_HEX;

  const walletProps = {
    account,
    roleLabel: loadingRoles ? "Loading..." : roleLabel,
    chainId,
    onConnect: handleConnect,
    onSwitchNetwork: handleSwitchNetwork
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <LandingPage account={account} walletProps={walletProps}>
              {account && (
                <div id="dashboard-section" style={{ padding: '0 2rem', maxWidth: '1400px', margin: '0 auto', paddingBottom: '4rem' }}>
                  {!isSepolia ? (
                    <div className="notice error page-notice" style={{ marginTop: "5vh", marginInline: "auto", maxWidth: "400px" }}>Please switch to Sepolia network to access the dashboard.</div>
                  ) : !contract ? (
                    <div className="notice page-notice" style={{ marginTop: "5vh", marginInline: "auto", maxWidth: "400px" }}>Initializing contract...</div>
                  ) : roles.admin ? (
                    <AdminDashboard contract={contract} onTxStatus={setTxStatus} walletProps={walletProps} txStatus={txStatus} />
                  ) : roles.issuer ? (
                    <IssuerDashboard contract={contract} onTxStatus={setTxStatus} walletProps={walletProps} txStatus={txStatus} />
                  ) : roles.verifier ? (
                    <VerifierDashboard contract={contract} onTxStatus={setTxStatus} walletProps={walletProps} txStatus={txStatus} />
                  ) : (
                    <div className="notice page-notice" style={{ marginTop: "5vh", marginInline: "auto", maxWidth: "400px" }}>Wallet connected, but no role is assigned in contract.</div>
                  )}
                </div>
              )}
            </LandingPage>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

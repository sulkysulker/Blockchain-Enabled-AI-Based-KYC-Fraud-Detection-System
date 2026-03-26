import React, { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  Clock,
  Settings,
  ShieldAlert,
  Key,
} from 'lucide-react';

export default function FooterStats({ contract }) {
  const [stats, setStats] = useState({
    admin: null,
    totalIssuers: null,
    issuerProposals: null,
    verifierProposals: null,
    votingPeriod: null,
    bootstrapComplete: null,
    bootstrapLimit: null,
  });

  useEffect(() => {
    async function fetchStats() {
      if (!contract) return;
      try {
        const [
          admin,
          totalIssuers,
          issuerProposals,
          verifierProposals,
          votingPeriod,
          bootstrapComplete,
          bootstrapLimit,
        ] = await Promise.all([
          contract.admin().catch(() => null),
          contract.totalIssuers().catch(() => null),
          contract.issuerProposalCount().catch(() => null),
          contract.verifierProposalCount().catch(() => null),
          contract.votingPeriod().catch(() => null),
          contract.bootstrapComplete().catch(() => null),
          contract.BOOTSTRAP_LIMIT().catch(() => null),
        ]);

        setStats({
          admin,
          totalIssuers: totalIssuers ? totalIssuers.toString() : '0',
          issuerProposals: issuerProposals ? issuerProposals.toString() : '0',
          verifierProposals: verifierProposals
            ? verifierProposals.toString()
            : '0',
          votingPeriod: votingPeriod ? votingPeriod.toString() : '0',
          bootstrapComplete,
          bootstrapLimit: bootstrapLimit ? bootstrapLimit.toString() : '0',
        });
      } catch (e) {
        console.warn('Failed to fetch footer stats:', e?.message);
      }
    }
    fetchStats();
  }, [contract]);

  return (
    <footer className="footer-stats-container">
      <div className="footer-stats-grid">
        {/* Network Core */}
        <div className="stat-card">
          <div className="stat-icon-wrap">
            <Key size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Network Admin</span>
            <span
              className="stat-value mono-val"
              title={stats.admin || 'Unknown'}
            >
              {stats.admin
                ? `${stats.admin.substring(0, 6)}...${stats.admin.substring(38)}`
                : '—'}
            </span>
          </div>
        </div>

        {/* Global Entities */}
        <div className="stat-card">
          <div className="stat-icon-wrap">
            <Users size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Issuers</span>
            <span className="stat-value">{stats.totalIssuers || '—'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap">
            <Settings size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Bootstrap Phase</span>
            <span className="stat-value">
              {stats.bootstrapComplete
                ? 'Completed'
                : `Pending (${stats.totalIssuers || 0}/${stats.bootstrapLimit || 0})`}
            </span>
          </div>
        </div>

        {/* Proposals */}
        <div className="stat-card">
          <div className="stat-icon-wrap">
            <FileText size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Issuer Props</span>
            <span className="stat-value">{stats.issuerProposals || '—'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap">
            <ShieldAlert size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Verifier Props</span>
            <span className="stat-value">{stats.verifierProposals || '—'}</span>
          </div>
        </div>

        {/* Configuration */}
        <div className="stat-card">
          <div className="stat-icon-wrap">
            <Clock size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Voting Period</span>
            <span className="stat-value">
              {stats.votingPeriod ? `${stats.votingPeriod}s` : '—'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .footer-stats-container {
          margin-top: 3rem;
          padding: 2rem;
          border: 1px solid var(--border-muted);
          border-radius: 12px;
          background: rgba(16, 18, 27, 0.5);
          backdrop-filter: blur(10px);
        }
        .footer-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }
        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(16, 18, 27, 0.4);
          border: 1px solid var(--border-subtle);
          padding: 1rem;
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          border-color: var(--border-neon);
          background: rgba(16, 18, 27, 0.8);
        }
        .stat-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--bg-elevated);
          color: var(--accent-cyan);
          border: 1px solid var(--border-muted);
        }
        .stat-info {
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .mono-val {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          color: var(--accent-cyan);
        }
      `}</style>
    </footer>
  );
}

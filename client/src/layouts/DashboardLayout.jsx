import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import WalletBar from '../components/WalletBar';

export default function DashboardLayout({ 
  children, 
  sidebarItems, 
  activeTab, 
  onTabChange 
}) {
  return (
    <div className="dashboard-horizontal-container slide-up">
      <nav className="horizontal-tabs">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`horizontal-tab ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={18} className="tab-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      {/* Main Content Area */}
      <div className="dashboard-content-scroll">
        {children}
      </div>
    </div>
  );
}

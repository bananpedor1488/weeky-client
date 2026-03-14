import React from 'react';
import './DesktopSidebar.css';
import './IconBase64.css';

const DesktopSidebar = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'account', label: 'Me', icon: 'account' },
  ];

  return (
    <aside className="desktop-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-base64-icon" />
        <h1>Weeky</h1>
      </div>
      
      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-nav-item ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <SidebarIcon icon={tab.icon} isActive={currentTab === tab.id} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <div className="footer-glow"></div>
        <p>Weeky</p>
      </div>
    </aside>
  );
};

const SidebarIcon = ({ icon, isActive }) => {
  const color = isActive ? '#ff2d55' : 'rgba(255,255,255,0.6)';
  
  switch (icon) {
    case 'home':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill={isActive ? color : 'none'} />
          <polyline points="9 22 9 12 15 12 15 22" fill={isActive ? color : 'none'} />
        </svg>
      );
    case 'search':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="11" cy="11" r={isActive ? 8 : 7} fill={isActive ? color : 'none'} />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'library':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" fill={isActive ? color : 'none'} />
        </svg>
      );
    case 'account':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" fill={isActive ? color : 'none'} />
        </svg>
      );
    default:
      return null;
  }
};

export default DesktopSidebar;

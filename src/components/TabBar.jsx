import React from 'react';
import './TabBar.css';

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'account', label: 'Account', icon: 'account' },
];

const TabBar = ({ currentTab, onTabChange }) => {
  return (
    <nav className="tab-bar">
      <div className="tab-bar-inner">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
          >
            <TabIcon icon={tab.icon} isActive={currentTab === tab.id} />
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const TabIcon = ({ icon, isActive }) => {
  const fill = isActive ? 'white' : 'var(--text-secondary)';
  
  switch (icon) {
    case 'home':
      return (
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2">
          <path d={isActive 
            ? "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
            : "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"} 
            fill={isActive ? fill : 'none'}
          />
          <polyline points="9 22 9 12 15 12 15 22" fill={isActive ? fill : 'none'} />
        </svg>
      );
    case 'search':
      return (
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2">
          <circle cx="11" cy="11" r={isActive ? 8 : 7} fill={isActive ? fill : 'none'} />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'library':
      return (
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d={isActive 
            ? "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" 
            : "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"}
            fill={isActive ? fill : 'none'}
          />
        </svg>
      );
    case 'account':
      return (
        <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" fill={isActive ? fill : 'none'} />
        </svg>
      );
    default:
      return null;
  }
};

export default TabBar;

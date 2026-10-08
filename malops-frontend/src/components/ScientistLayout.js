import React, { useContext, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BarChart2, GitCompare, Map, GitBranch, LogOut, MonitorPlay, Rocket, Menu, X } from 'lucide-react';
import './AdminLayout.css';

const navItems = [
  { to: '/scientist/orchestrator-wizard', label: 'Launch Orchestrator', icon: Rocket, highlight: true },
  { separator: true },
  { to: '/scientist/training',     label: 'Training Progress', icon: BarChart2 },
  { to: '/scientist/models',       label: 'Model Comparison',  icon: GitCompare },
  { to: '/scientist/predictions',  label: 'Predictions',       icon: Map },
  { to: '/scientist/pipelines',    label: 'Pipeline Manager',  icon: GitBranch },
  { to: '/scientist/clearml-ui',   label: 'ClearML UI',        icon: MonitorPlay },
];

const ScientistLayout = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-content">
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="welcome-text">Welcome to HydroVision</span>
                <span>MLOps Engineer</span>
              </div>
            )}
            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Agrandir' : 'Réduire'}
            >
              {collapsed ? <Menu size={18} /> : <X size={18} />}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) =>
            item.separator ? (
              !collapsed && <div key={`sep-${i}`} style={{ height:1, background:'rgba(255,255,255,.1)', margin:'.5rem .75rem' }}/>
            ) : item.highlight ? (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
                style={({ isActive }) => ({
                  background: isActive ? undefined : 'linear-gradient(135deg,rgba(124,58,237,.35),rgba(91,33,182,.25))',
                  borderLeft: '3px solid #a78bfa',
                  fontWeight: 700,
                })}>
                <item.icon size={17}/>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ) : (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}>
                <item.icon size={17}/>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout} title={collapsed ? 'Logout' : undefined}>
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
};

export default ScientistLayout;

import React, { useContext, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  FolderCog, ShieldCheck, BarChart3, Activity, LogOut, Menu, X,
} from 'lucide-react';
import './EngineerLayout.css';
import './AdminLayout.css';

const navItems = [
  { to: '/engineer/dataset-config',    label: 'Dataset Config',     icon: FolderCog },
  { to: '/engineer/validation-config', label: 'Validation Config',  icon: ShieldCheck },
  { to: '/engineer/validation',        label: 'Validation Report',  icon: BarChart3 },
  { to: '/engineer/quality-dashboard', label: 'Quality Dashboard',  icon: Activity },
];

export default function EngineerLayout() {
  const { logout } = useContext(AuthContext);
  const navigate   = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="engineer-shell">
      <aside className={`admin-sidebar engineer-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-content">
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="welcome-text">Welcome to HydroVision</span>
                <span>Data Engineer</span>
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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={17}/>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={() => { logout(); navigate('/login'); }} title={collapsed ? 'Logout' : undefined}>
            <LogOut size={16}/>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="engineer-main">
        <Outlet/>
      </main>
    </div>
  );
}

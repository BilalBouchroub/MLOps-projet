import React, { useContext, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Map, LogOut, TrendingUp, BarChart3, Menu, X } from 'lucide-react';
import './AdminLayout.css';

const navItems = [
  { to: '/client/prediction', label: 'Prédiction',          icon: TrendingUp },
  { to: '/client/analytics',  label: 'Analytics Dashboard',  icon: BarChart3 },
  { to: '/client/map',        label: 'Carte',                icon: Map },
];

const ClientLayout = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-content">
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="welcome-text">Welcome to HydroVision</span>
                <span>Espace Client</span>
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
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout} title={collapsed ? 'Déconnexion' : undefined}>
            <LogOut size={16} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default ClientLayout;

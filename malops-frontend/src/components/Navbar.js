import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, role, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated && location.pathname !== '/login') return null;

  return (
    <nav className="navbar">
      <div className="nav-brand">MLOps</div>
      {isAuthenticated && (
        <div className="nav-links">
          <Link to="/map" className={location.pathname === '/map' ? 'active' : ''}>
            Carte
          </Link>
          <Link to="/weather" className={location.pathname === '/weather' ? 'active' : ''}>
            Météo
          </Link>
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            Dashboard
          </Link>
          {role === 'admin' && (
            <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
              Admin
            </Link>
          )}
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

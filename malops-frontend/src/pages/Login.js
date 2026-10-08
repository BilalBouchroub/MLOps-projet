import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, role } = useContext(AuthContext);

  useEffect(() => {
    if (isAuthenticated) {
      if      (role === 'admin')          navigate('/admin');
      else if (role === 'data_engineer')  navigate('/engineer');
      else if (role === 'data_scientist') navigate('/scientist');
      else if (role === 'mlops_engineer') navigate('/client');
      else                                navigate('/map');
    }
    const params = new URLSearchParams(location.search);
    if (params.get('expired')) setError('Session expirée, reconnectez-vous');
  }, [isAuthenticated, role, navigate, location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userRole = await login(username, password);
      if      (userRole === 'admin')          navigate('/admin');
      else if (userRole === 'data_engineer')  navigate('/engineer');
      else if (userRole === 'data_scientist') navigate('/scientist');
      else if (userRole === 'mlops_engineer') navigate('/client');
      else                                    navigate('/map');
    } catch (err) {
      if (err.response) {
        if      (err.response.status === 401) setError('Identifiants invalides');
        else if (err.response.status === 403) setError('Accès non autorisé');
        else if (err.response.status === 500) setError('Erreur serveur, réessayez');
        else setError('Erreur de connexion au serveur');
      } else {
        setError('Erreur réseau, vérifiez votre connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-background">

      {/* ── Bouton retour haut droite ── */}
      <button className="back-btn" onClick={() => navigate('/')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Retour à l'accueil
      </button>

      <div className="login-box">

        {/* ── CÔTÉ GAUCHE : image stress hydrique + overlay ── */}
        <div className="login-left">

          {/* Image de fond */}
          <img src="/stress.png" alt="Stress hydrique" className="left-bg-image" />

          {/* Overlay dégradé vert */}
          <div className="left-overlay" />

          {/* Contenu sur l'image */}
          <div className="left-content">
            <div className="left-badge">
              <span className="badge-dot" />
              AGRICULTURE INTELLIGENTE
            </div>

            <h2>
              Bienvenue sur<br />
              <span className="brand-gradient">HydroVision</span>
            </h2>

            <p>
              Prédiction intelligente du stress hydrique au Maroc
              grâce à l'IA et aux données satellite.
            </p>

          </div>
        </div>

        {/* ── CÔTÉ DROIT : formulaire ── */}
        <div className="login-right">
          <div className="right-inner">

            {/* Logo mobile */}
            <div className="mobile-logo">
              <div className="logo-box">H</div>
              <span>HydroVision</span>
            </div>

            <div className="form-header">
              <h1>Se connecter</h1>
              <p>Accédez à vos tableaux de bord, modèles ML et résultats directement depuis cet espace.</p>
            </div>

            {error && <div className="error-alert">{error}</div>}

            <form onSubmit={handleLogin}>

              <div className="form-group">
                <label htmlFor="username">Identifiant</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="ex: admin"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Mot de passe</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                      stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Connexion en cours…' : 'Se connecter →'}
              </button>

            </form>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;

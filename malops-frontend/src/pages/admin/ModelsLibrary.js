import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';

const STATUS_STYLE = {
  production: { background: '#d1fae5', color: '#065f46', label: 'Production' },
  staging:    { background: '#fef3c7', color: '#92400e', label: 'Staging' },
  archived:   { background: '#f3f4f6', color: '#6b7280', label: 'Archived' },
};

const ModelsLibrary = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await apiUsers.get('/models/library');
      setModels(res.data?.models || []);
    } catch {
      setError('Impossible de charger les modèles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModels(); }, []);

  const handleActivate = async (version) => {
    setActionMsg('');
    try {
      await apiUsers.put(`/models/${version}/activate`);
      setActionMsg(`Modèle ${version} activé en production.`);
      fetchModels();
    } catch (err) {
      setError(err.userMessage || `Erreur lors de l'activation de ${version}.`);
    }
  };

  const handleDeactivate = async (version) => {
    setActionMsg('');
    try {
      await apiUsers.put(`/models/${version}/deactivate`);
      setActionMsg(`Modèle ${version} désactivé (staging).`);
      fetchModels();
    } catch (err) {
      setError(err.userMessage || `Erreur lors de la désactivation de ${version}.`);
    }
  };

  const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Models Library</h1>
          <p>Gérez les versions de modèles ML</p>
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      {actionMsg && (
        <div className="alert-info" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af' }}>✕</button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement…</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['Model Name', 'Version', 'R²', 'Status', 'Created At', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun modèle.</td></tr>
                ) : models.map(m => {
                  const s = STATUS_STYLE[m.status] || STATUS_STYLE.archived;
                  return (
                    <tr key={m.version}>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.version}</td>
                      <td>{m.r2 != null ? m.r2.toFixed(4) : '—'}</td>
                      <td>
                        <span className="status-badge" style={{ background: s.background, color: s.color }}>
                          {s.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(m.created_at)}</td>
                      <td>
                        {m.status !== 'production' && (
                          <button className="btn-action btn-activate" onClick={() => handleActivate(m.version)}>
                            Activate
                          </button>
                        )}
                        {m.status === 'production' && (
                          <button className="btn-action btn-deactivate" onClick={() => handleDeactivate(m.version)}>
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default ModelsLibrary;

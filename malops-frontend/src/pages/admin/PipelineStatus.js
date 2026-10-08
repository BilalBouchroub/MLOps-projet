import React, { useState, useEffect, useCallback } from 'react';
import { apiUsers } from '../../api/axios';
import { RefreshCw, FileText, Info, AlertTriangle, AlertCircle } from 'lucide-react';

const STATUS_STYLE = {
  OK:      { background: '#d1fae5', color: '#065f46', label: 'OK' },
  FAILED:  { background: '#fee2e2', color: '#991b1b', label: 'FAILED' },
  RUNNING: { background: '#dbeafe', color: '#1e40af', label: 'RUNNING', pulse: true },
  UNKNOWN: { background: '#f3f4f6', color: '#6b7280', label: 'UNKNOWN' },
};

const LEVEL_STYLE = {
  INFO:    { background: '#dbeafe', color: '#1e40af' },
  WARNING: { background: '#fef3c7', color: '#92400e' },
  ERROR:   { background: '#fee2e2', color: '#991b1b' },
};

const LOG_TYPE_STYLE = {
  'lancement du pipeline': { background: '#ede9fe', color: '#5b21b6' },
  'modèle activé':         { background: '#d1fae5', color: '#065f46' },
  'modèle désactivé':      { background: '#fef3c7', color: '#92400e' },
  'modèle créé':           { background: '#ecfdf5', color: '#047857' },
  'utilisateur créé':      { background: '#dbeafe', color: '#1d4ed8' },
  'utilisateur modifié':   { background: '#fef9c3', color: '#854d0e' },
  'utilisateur supprimé':  { background: '#fee2e2', color: '#991b1b' },
};

const PipelineStatus = () => {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runMsg, setRunMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await apiUsers.get('/pipelines/status');
      setPipelines(res.data?.pipelines || []);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError('Impossible de charger les statuts pipelines.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await apiUsers.get('/admin/logs');
      setLogs(res.data?.logs || []);
      setLogsError(null);
    } catch {
      setLogsError('Impossible de charger les logs système.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
    fetchLogs();
    const interval = setInterval(fetchPipelines, 30000);
    return () => clearInterval(interval);
  }, [fetchPipelines, fetchLogs]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const PIPELINE_LABELS = {
    dataset: 'Dataset',
    validation: 'Validation',
    training: 'Training',
    registry: 'Registry',
    serving: 'Serving',
    monitoring: 'Monitoring',
    predict: 'Predict',
  };

  const logStats = {
    total:   logs.length,
    info:    logs.filter(l => l.level === 'INFO').length,
    warning: logs.filter(l => l.level === 'WARNING').length,
    error:   logs.filter(l => l.level === 'ERROR').length,
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Pipeline Status</h1>
          <p>
            Statut des pipelines MLOps
            {lastRefresh && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#aaa' }}>
                — Actualisé à {lastRefresh.toLocaleTimeString('fr-FR')} (auto 30s)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-add" style={{ background: 'white', color: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-bg)' }}
            onClick={() => { fetchPipelines(); fetchLogs(); }}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>✕</button>
        </div>
      )}

      {runMsg && (
        <div className="alert-info" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{runMsg}</span>
          <button onClick={() => setRunMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af' }}>✕</button>
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
                  {['Pipeline', 'Dernier Run', 'Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pipelines.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun pipeline.</td></tr>
                ) : pipelines.map(p => {
                  const s = STATUS_STYLE[p.status] || STATUS_STYLE.UNKNOWN;
                  return (
                    <tr key={p.name}>
                      <td><strong>{PIPELINE_LABELS[p.name] || p.name}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.last_run)}</td>
                      <td>
                        <span
                          className={`status-badge${s.pulse ? ' pulse' : ''}`}
                          style={{ background: s.background, color: s.color }}
                        >
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Logs Système ── */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <FileText size={20} color="var(--sidebar-bg)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Logs Système
          </h2>
        </div>

        {/* Stats header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={statCard('#f8fafc', '#334155')}>
            <FileText size={18} style={{ marginBottom: '0.4rem', color: '#64748b' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{logStats.total}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Total des logs</div>
          </div>
          <div style={statCard('#eff6ff', '#1d4ed8')}>
            <Info size={18} style={{ marginBottom: '0.4rem', color: '#3b82f6' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{logStats.info}</div>
            <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '2px' }}>Informations</div>
          </div>
          <div style={statCard('#fffbeb', '#92400e')}>
            <AlertTriangle size={18} style={{ marginBottom: '0.4rem', color: '#f59e0b' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{logStats.warning}</div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '2px' }}>Avertissements</div>
          </div>
          <div style={statCard('#fef2f2', '#991b1b')}>
            <AlertCircle size={18} style={{ marginBottom: '0.4rem', color: '#ef4444' }} />
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{logStats.error}</div>
            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '2px' }}>Erreurs</div>
          </div>
        </div>

        {/* Logs table */}
        <div className="card">
          {logsLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Chargement des logs…</p>
          ) : logsError ? (
            <div className="alert-error">{logsError}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {['Timestamp', 'Niveau', 'Service', 'Message', 'Type de log'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                        Aucun événement système enregistré.
                      </td>
                    </tr>
                  ) : logs.map((log, i) => {
                    const lvl = LEVEL_STYLE[log.level] || LEVEL_STYLE.INFO;
                    const typeStyle = LOG_TYPE_STYLE[log.log_type] || { background: '#f3f4f6', color: '#374151' };
                    return (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          {formatDate(log.timestamp)}
                        </td>
                        <td>
                          <span className="status-badge" style={{ background: lvl.background, color: lvl.color, fontSize: '0.75rem' }}>
                            {log.level}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.87rem', color: 'var(--text-muted)' }}>{log.service}</td>
                        <td style={{ fontSize: '0.87rem' }}>{log.message}</td>
                        <td>
                          <span className="status-badge" style={{ background: typeStyle.background, color: typeStyle.color, fontSize: '0.75rem' }}>
                            {log.log_type}
                          </span>
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
    </div>
  );
};

function statCard(bg, color) {
  return {
    background: bg,
    border: `1px solid ${bg === '#f8fafc' ? '#e2e8f0' : 'transparent'}`,
    borderRadius: '10px',
    padding: '1.1rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    color,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };
}

export default PipelineStatus;

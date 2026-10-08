import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import { RefreshCw } from 'lucide-react';

const DatasetList = () => {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchDatasets = () => {
    setLoading(true);
    apiUsers.get('/datasets')
      .then(r => setDatasets(r.data?.datasets || []))
      .catch(() => setError('Impossible de charger les datasets.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDatasets();
    const iv = setInterval(() => {
      apiUsers.get('/datasets')
        .then(r => setDatasets(r.data?.datasets || []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === 'all'
    ? datasets
    : datasets.filter(d => d.status === filter.toUpperCase());

  const validated = datasets.filter(d => d.status === 'VALIDATED').length;
  const raw       = datasets.filter(d => d.status === 'RAW').length;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Dataset List</h1>
          <p>{datasets.length} fichiers disponibles — {validated} validés, {raw} bruts</p>
        </div>
        <button className="btn-add" style={{ background: 'white', color: 'var(--sidebar-bg)', border: '1px solid var(--sidebar-bg)' }} onClick={fetchDatasets}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[['all','Tous'], ['validated','Validated'], ['raw','Raw']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.85rem',
            background: filter === v ? 'var(--sidebar-bg)' : '#e5e7eb',
            color: filter === v ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            {l}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Chargement…</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['Filename', 'Année', 'Lignes', 'Taille', 'Nulls %', 'Dernière modif.', 'Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun dataset.</td></tr>
                ) : filtered.map(ds => (
                  <tr key={ds.filename}>
                    <td style={{ fontWeight: 500, fontSize: '0.88rem' }}>{ds.filename}</td>
                    <td>{ds.year || '—'}</td>
                    <td>{ds.rows != null ? ds.rows.toLocaleString('fr-FR') : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {ds.size_bytes ? `${(ds.size_bytes / 1_000_000).toFixed(1)} MB` : '—'}
                    </td>
                    <td>{ds.null_pct != null ? `${ds.null_pct}%` : '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {ds.last_modified ? new Date(ds.last_modified).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td>
                      {ds.status === 'VALIDATED'
                        ? <span className="ds-badge-validated">Validated</span>
                        : <span className="ds-badge-raw">Raw</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetList;

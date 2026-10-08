import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import { PlusCircle } from 'lucide-react';

const YEARS = ['2022', '2023', '2024', '2025', '2026'];

const ZONE_OPTIONS = [
  { value: 'all',    label: 'Tout le Maroc' },
  { value: 'nord',   label: 'Nord Maroc (lat > 34)' },
  { value: 'centre', label: 'Centre Maroc (lat 31–34)' },
  { value: 'sud',    label: 'Sud Maroc (lat < 31)' },
];

const REGIONS = [
  { id: 'tanger',      name: 'Tanger-Tétouan-Al Hoceïma', zone: 'nord' },
  { id: 'oriental',    name: 'Oriental',                   zone: 'nord' },
  { id: 'fes',         name: 'Fès-Meknès',                 zone: 'centre' },
  { id: 'rabat',       name: 'Rabat-Salé-Kénitra',         zone: 'centre' },
  { id: 'casablanca',  name: 'Casablanca-Settat',           zone: 'centre' },
  { id: 'beni-mellal', name: 'Béni Mellal-Khénifra',        zone: 'centre' },
  { id: 'marrakech',   name: 'Marrakech-Safi',              zone: 'centre' },
  { id: 'draa',        name: 'Drâa-Tafilalet',              zone: 'centre' },
  { id: 'souss',       name: 'Souss-Massa',                 zone: 'sud' },
  { id: 'guelmim',     name: 'Guelmim-Oued Noun',           zone: 'sud' },
  { id: 'laayoune',    name: 'Laâyoune-Sakia El Hamra',     zone: 'sud' },
  { id: 'dakhla',      name: 'Dakhla-Oued Ed-Dahab',        zone: 'sud' },
];

const ZONE_LABELS = { nord: 'Nord Maroc', centre: 'Centre Maroc', sud: 'Sud Maroc' };

const DatasetCreate = () => {
  const [year, setYear] = useState('2024');
  const [zone, setZone] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selected, setSelected] = useState(new Set(REGIONS.map(r => r.id)));

  const [datasets, setDatasets] = useState([]);
  const [loadingDs, setLoadingDs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiUsers.get('/datasets')
      .then(r => setDatasets(r.data?.datasets || []))
      .catch(() => setError('Impossible de charger la liste des datasets.'))
      .finally(() => setLoadingDs(false));
  }, []);

  // Sync checkboxes with zone dropdown
  const handleZoneChange = (z) => {
    setZone(z);
    if (z === 'all') {
      setSelected(new Set(REGIONS.map(r => r.id)));
    } else {
      setSelected(new Set(REGIONS.filter(r => r.zone === z).map(r => r.id)));
    }
  };

  const toggleRegion = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => setSelected(new Set(REGIONS.map(r => r.id)));

  const handleCreate = async () => {
    setCreating(true);
    setCreateMsg(null);
    setError(null);
    try {
      await apiUsers.post('/datasets/create', {
        year, zone,
        date_start: dateStart || null,
        date_end: dateEnd || null,
        regions: [...selected],
      });
      setCreateMsg({ type: 'success', text: `Dataset ${year} — ${ZONE_OPTIONS.find(z2 => z2.value === zone)?.label} créé avec succès.` });
    } catch {
      setCreateMsg({ type: 'info', text: "L'endpoint de création de dataset (/datasets/create) sera disponible prochainement." });
    } finally {
      setCreating(false);
    }
  };

  const grouped = ['nord', 'centre', 'sud'];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Create New Dataset</h1>
          <p>Configurez et générez un dataset filtré par année et région</p>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {createMsg && (
        <div className={createMsg.type === 'success' ? 'alert-info' : 'alert-info'} style={createMsg.type === 'success' ? { background: '#d1fae5', color: '#065f46', borderLeftColor: '#10b981' } : {}}>
          {createMsg.text}
        </div>
      )}

      {/* Two-column settings */}
      <div className="dataset-create-grid">

        {/* Left — Dataset Settings */}
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--sidebar-bg)', fontWeight: 700 }}>
            Dataset Settings
          </h3>

          <div className="form-group">
            <label>Année</label>
            <select value={year} onChange={e => setYear(e.target.value)}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Région</label>
            <select value={zone} onChange={e => handleZoneChange(e.target.value)}>
              {ZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Date début</label>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Date fin</label>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
        </div>

        {/* Right — Region Selection */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--sidebar-bg)', fontWeight: 700 }}>Region Selection</h3>
            <button className="btn-select-all" onClick={handleSelectAll}>Select All</button>
          </div>

          <div className="region-list">
            {grouped.map(z => (
              <div key={z}>
                <span className="region-zone-label">{ZONE_LABELS[z]}</span>
                {REGIONS.filter(r => r.zone === z).map(r => (
                  <label key={r.id} className="region-item">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRegion(r.id)}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            ))}
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {selected.size} / {REGIONS.length} régions sélectionnées
          </p>
        </div>
      </div>

      {/* Create button */}
      <button className="btn-create-dataset" onClick={handleCreate} disabled={creating}>
        <PlusCircle size={18} />
        {creating ? 'Création en cours…' : 'Create Dataset'}
      </button>

      {/* Available Datasets */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem', color: 'var(--sidebar-bg)', fontWeight: 700 }}>
          Available Datasets
        </h3>
        {loadingDs ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Chargement…</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {['Name', 'Année', 'Lignes', 'Nulls %', 'Status'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {datasets.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun dataset.</td></tr>
                ) : datasets.map(ds => (
                  <tr key={ds.filename}>
                    <td style={{ fontWeight: 500 }}>{ds.filename.replace('.csv', '')}</td>
                    <td>{ds.year || '—'}</td>
                    <td>{ds.rows != null ? ds.rows.toLocaleString('fr-FR') : '—'}</td>
                    <td>{ds.null_pct != null ? `${ds.null_pct}%` : '—'}</td>
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

export default DatasetCreate;

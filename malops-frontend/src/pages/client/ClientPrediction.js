import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apiUsers } from '../../api/axios';
import {
  Upload, MapPin, Loader2, BarChart3,
  AlertCircle, RefreshCw, Info,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const MONTH_LABELS = ['','Jan','Fév','Mar','Avr','Mai','Jun',
                       'Jul','Aoû','Sep','Oct','Nov','Déc'];

const MOROCCO_REGIONS = [
  'El Jadida','Casablanca','Rabat','Fès','Marrakech','Agadir','Meknès',
  'Oujda','Kénitra','Tétouan','Tanger','Safi','Beni Mellal','Settat',
  'Khémisset','Tiznit','Errachidia','Ouarzazate','Doukkala','Tout le Maroc',
];

function cwsiColor(cwsi) {
  if (cwsi < 0.2) return '#1a9850';
  if (cwsi < 0.4) return '#a6d96a';
  if (cwsi < 0.6) return '#fd8d3c';
  if (cwsi < 0.8) return '#e31a1c';
  return '#800026';
}

/* ── BreakdownTable ──────────────────────────────────────────────────────── */
function BreakdownTable({ breakdown, breakdownType }) {
  if (!breakdown?.length) return null;
  const label  = breakdownType === 'commune' ? 'Commune' : 'Région';
  const sorted = [...breakdown].sort((a, b) => b.mean_cwsi - a.mean_cwsi);

  return (
    <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
      boxShadow: '0 2px 8px rgba(0,0,0,.07)', marginTop: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '.75rem 1.25rem', background: '#f0f9ff',
        borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
        <MapPin size={15} color="#0891b2" />
        <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#0c4a6e' }}>
          Détail par {label} — {sorted.length} {label.toLowerCase()}{sorted.length > 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '.73rem', color: '#9ca3af', marginLeft: 'auto' }}>
          Trié par stress décroissant
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
          <thead>
            <tr>
              {[label, 'CWSI moyen', 'Verdict', 'Faible %', 'Modéré %', 'Sévère %'].map(h => (
                <th key={h} style={{ padding: '.5rem .9rem', background: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb', fontWeight: 700, color: '#374151',
                  textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa',
                borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '.5rem .9rem', fontWeight: 700, color: '#111827' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10,
                    borderRadius: 2, background: cwsiColor(row.mean_cwsi),
                    marginRight: 6, verticalAlign: 'middle' }} />
                  {row.name}
                </td>
                <td style={{ padding: '.5rem .9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 64, height: 6, background: '#e5e7eb',
                      borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', borderRadius: 20,
                        width: `${Math.min(row.mean_cwsi * 100, 100)}%`,
                        background: row.verdict_color }} />
                    </div>
                    <span style={{ fontWeight: 800, color: row.verdict_color,
                      fontFamily: 'monospace', fontSize: '.85rem' }}>
                      {row.mean_cwsi?.toFixed(3)}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '.5rem .9rem' }}>
                  <span style={{ padding: '.18rem .65rem', borderRadius: 20,
                    fontSize: '.73rem', fontWeight: 700, whiteSpace: 'nowrap',
                    background: `${row.verdict_color}18`, color: row.verdict_color,
                    border: `1px solid ${row.verdict_color}40` }}>
                    {row.verdict}
                  </span>
                </td>
                <td style={{ padding: '.5rem .9rem', color: '#16a34a', fontWeight: 700 }}>{row.faible_pct}%</td>
                <td style={{ padding: '.5rem .9rem', color: '#d97706', fontWeight: 700 }}>{row.modere_pct}%</td>
                <td style={{ padding: '.5rem .9rem', color: '#dc2626', fontWeight: 700 }}>{row.severe_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── ResultCard ──────────────────────────────────────────────────────────── */
function ResultCard({ result, onReset }) {
  const {
    faible_pct, modere_pct, severe_pct, mean_cwsi,
    verdict, verdict_color, filename, analyzed_rows,
    monthly, region, breakdown, breakdown_type,
    model_name, model_version, r2_test,
    lst_conversion_applied,
  } = result;

  const pieData = [
    { name: 'Faible',  value: faible_pct, color: '#16a34a' },
    { name: 'Modéré',  value: modere_pct, color: '#d97706' },
    { name: 'Sévère',  value: severe_pct, color: '#dc2626' },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
        boxShadow: '0 4px 20px rgba(0,0,0,.09)', overflow: 'hidden', marginBottom: '1.25rem' }}>

        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem',
          background: 'linear-gradient(135deg,#1a3a2a,#2d6a4f)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem',
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="#6ee7b7" />
              Résultats — {filename}
            </div>
            <div style={{ color: '#a7f3d0', fontSize: '.75rem', marginTop: 4,
              display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {region && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,.15)', padding: '.15rem .55rem',
                  borderRadius: 20, fontWeight: 700, fontSize: '.72rem' }}>
                  <MapPin size={11} />{region}
                </span>
              )}
              <span>{analyzed_rows?.toLocaleString()} lignes analysées</span>
              {model_name && (
                <span>· {model_name} {model_version} (R²={r2_test?.toFixed(4)})</span>
              )}
            </div>
          </div>
          <button onClick={onReset} style={{ background: 'rgba(255,255,255,.15)',
            border: 'none', borderRadius: 7, padding: '.4rem .9rem',
            cursor: 'pointer', color: 'white', fontWeight: 600, fontSize: '.83rem',
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} /> Nouvelle analyse
          </button>
        </div>

        {lst_conversion_applied && (
          <div style={{ padding: '.5rem 1.25rem', background: '#fef3c7',
            fontSize: '.75rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} /> LST converti automatiquement (Kelvin×10 → °C).
          </div>
        )}

        {/* Grille statistiques */}
        <div style={{ padding: '1.4rem', display: 'grid',
          gridTemplateColumns: '180px 1fr 1fr', gap: '2rem' }}>

          {/* Verdict + gauge + pie */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '.55rem 1.1rem', borderRadius: 20, fontWeight: 800,
              fontSize: '.9rem', background: `${verdict_color}18`, color: verdict_color,
              border: `2px solid ${verdict_color}`, textAlign: 'center' }}>
              {verdict}
            </div>

            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={70} cy={70} r={56} fill="none" stroke="#e5e7eb" strokeWidth={12} />
                <circle cx={70} cy={70} r={56} fill="none" stroke={verdict_color} strokeWidth={12}
                  strokeDasharray={`${mean_cwsi * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: verdict_color, lineHeight: 1 }}>
                  {mean_cwsi?.toFixed(3)}
                </span>
                <span style={{ fontSize: '.65rem', color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>
                  CWSI moyen
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>
                Distribution du stress
              </div>
              <ResponsiveContainer width={160} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={48}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={v => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {pieData.map(d => (
                  <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center',
                    gap: 3, fontSize: '.68rem', fontWeight: 700 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%',
                      background: d.color, display: 'inline-block' }} />
                    {d.name}: {d.value}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Barres de stress */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#374151', marginBottom: '1rem' }}>
              Répartition par classe de stress
            </div>
            {[
              { label: '✅ Stress faible (CWSI < 0.4)',  pct: faible_pct, color: '#16a34a' },
              { label: '⚡ Stress modéré (0.4 – 0.6)',   pct: modere_pct, color: '#d97706' },
              { label: '⚠️ Stress sévère (CWSI > 0.6)',  pct: severe_pct, color: '#dc2626' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: '.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: '.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  <span>{row.label}</span>
                  <span style={{ color: row.color, fontWeight: 800 }}>{row.pct}%</span>
                </div>
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 20, background: row.color,
                    width: `${row.pct}%`, transition: 'width .6s ease' }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: '1.25rem', padding: '.75rem 1rem',
              background: `${verdict_color}0d`, borderRadius: 9,
              border: `1px solid ${verdict_color}30` }}>
              <div style={{ fontWeight: 700, fontSize: '.8rem', color: verdict_color, marginBottom: '.3rem' }}>
                Interprétation
              </div>
              <div style={{ fontSize: '.77rem', color: '#374151', lineHeight: 1.55 }}>
                {mean_cwsi < 0.4
                  ? 'Les cultures présentent un niveau de stress hydrique faible. Les ressources en eau sont suffisantes.'
                  : mean_cwsi < 0.6
                  ? "Un stress modéré est détecté. Une surveillance et une irrigation d'appoint sont recommandées."
                  : 'Stress hydrique sévère détecté. Une irrigation urgente est nécessaire pour protéger les cultures.'}
              </div>
            </div>
          </div>

          {/* Graphique mensuel */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#374151', marginBottom: '1rem' }}>
              Évolution mensuelle du CWSI
            </div>
            {monthly?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }}
                    tickFormatter={m => MONTH_LABELS[m] || m} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [v.toFixed(3), 'CWSI moyen']} />
                  <Bar dataKey="mean_cwsi" radius={[4, 4, 0, 0]}>
                    {monthly.map((m, i) => (
                      <Cell key={i}
                        fill={m.mean_cwsi > 0.6 ? '#dc2626' : m.mean_cwsi > 0.4 ? '#d97706' : '#16a34a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#9ca3af', fontSize: '.83rem' }}>
                Données mensuelles non disponibles
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tableau détaillé par région */}
      <BreakdownTable breakdown={breakdown} breakdownType={breakdown_type} />
    </div>
  );
}

const STORAGE_KEY = 'malops_client_prediction';

/* ── Page principale ─────────────────────────────────────────────────────── */
export default function ClientPrediction() {
  const [region,    setRegion]    = useState('');
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [predResult,setPredResult]= useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [error,     setError]     = useState('');
  const [myProject, setMyProject] = useState(null);
  const fileRef   = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
  }, []);

  const reset = () => {
    setPredResult(null);
    setError('');
    setRegion('');
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const doPredict = async (file) => {
    setError('');
    setLoading(true);
    setPredResult(null);
    const fd = new FormData();
    fd.append('file', file);
    if (region) fd.append('region', region);
    try {
      const { data } = await apiUsers.post('/datasets/predict-upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPredResult(data);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || 'Erreur inconnue';
      setError(`[${e.response?.status || '?'}] ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) doPredict(f);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1150, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {myProject && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9,
          padding: '.5rem 1rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '.84rem' }}>
          <span style={{ fontWeight: 700, color: '#166534' }}>Projet :</span>
          <span style={{ color: '#166534' }}>{myProject.name}</span>
        </div>
      )}

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
          Prédiction du stress hydrique
        </h1>
        <p style={{ margin: '.3rem 0 0', color: '#6b7280', fontSize: '.88rem' }}>
          Importez votre CSV — les statistiques et graphiques s'affichent immédiatement.
        </p>
      </div>

      {!predResult && (
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: '1.5rem', marginBottom: '1.5rem' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
            <Upload size={18} color="#2d6a4f" />
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              Importer un fichier de données
            </h2>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600, fontSize: '.83rem', color: '#374151',
              display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <MapPin size={13} color="#7c3aed" />
              Région concernée
              <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optionnel)</span>
            </label>
            <select value={region} onChange={e => setRegion(e.target.value)}
              style={{ width: '100%', maxWidth: 320,
                border: `1.5px solid ${region ? '#7c3aed' : '#d1d5db'}`,
                borderRadius: 8, padding: '.4rem .7rem', fontSize: '.9rem',
                fontWeight: region ? 700 : 400,
                color: region ? '#5b21b6' : '#9ca3af',
                background: region ? '#faf5ff' : 'white', cursor: 'pointer' }}>
              <option value="">— Sélectionner (optionnel) —</option>
              {MOROCCO_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !loading && fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? '#2d6a4f' : '#d1d5db'}`,
              borderRadius: 12, padding: '2.5rem', textAlign: 'center',
              cursor: loading ? 'default' : 'pointer',
              background: dragging ? '#f0fdf4' : '#fafafa', transition: 'all .2s' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2d6a4f' }} />
                <span style={{ fontWeight: 700, color: '#374151' }}>Analyse en cours…</span>
                <span style={{ fontSize: '.78rem', color: '#6b7280' }}>
                  Calcul du stress hydrique et génération des statistiques
                </span>
              </div>
            ) : (
              <>
                <Upload size={36} color="#9ca3af" />
                <p style={{ margin: '.75rem 0 .3rem', fontWeight: 700, color: '#374151', fontSize: '1rem' }}>
                  Glisser-déposer votre fichier CSV ici
                </p>
                <p style={{ margin: 0, fontSize: '.82rem', color: '#9ca3af' }}>
                  ou cliquer pour sélectionner — Max 200 MB
                </p>
                <p style={{ margin: '.5rem 0 0', fontSize: '.73rem', color: '#c4b5fd', fontWeight: 600 }}>
                  Requis : NDVI · NDWI · MSI · LST · Precipitation · SoilMoisture · ET0
                </p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files[0]; if (f) doPredict(f); }} />
          </div>

          {error && (
            <div style={{ marginTop: '.75rem', padding: '.65rem 1rem',
              background: '#fef2f2', color: '#991b1b', borderRadius: 8,
              fontSize: '.83rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}
        </div>
      )}

      {predResult && (
        <div ref={resultRef}>
          <ResultCard result={predResult} onReset={reset} />
        </div>
      )}
    </div>
  );
}

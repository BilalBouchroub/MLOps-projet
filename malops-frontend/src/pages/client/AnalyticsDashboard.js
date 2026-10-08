import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, ScatterChart, Scatter, LineChart, Line,
  PieChart, Pie, Cell, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ZAxis,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart3, TrendingUp, Activity, AlertTriangle,
  FileDown, SlidersHorizontal, MapPin, RefreshCw,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const STORAGE_KEY = 'malops_client_prediction';
const MONTHS_FR   = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const CORR_VARS   = ['NDVI','NDWI','MSI','LST','Precipitation','SoilMoisture','ET0','cwsi'];

/* couleur CWSI */
function cwsiColor(v) {
  if (v < 0.2) return '#1a9850';
  if (v < 0.4) return '#a6d96a';
  if (v < 0.6) return '#fd8d3c';
  if (v < 0.8) return '#e31a1c';
  return '#800026';
}

/* ── KPI Card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, unit, icon: Icon, color, sub }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.4rem',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)', border: `1px solid ${color}30`,
      flex: 1, minWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.5rem' }}>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: '6px 7px' }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color }}>
        {value}<span style={{ fontSize: '.9rem', fontWeight: 600, marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: '.72rem', color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ── Carte corrélation ───────────────────────────────────────────────────── */
function CorrMatrix({ correlations }) {
  const vars = CORR_VARS.filter(v => correlations?.[v]);
  if (vars.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:220, color:'#9ca3af', fontSize:'.85rem' }}>Données insuffisantes</div>
  );

  const cellSize = Math.min(46, Math.floor(340 / vars.length));

  function corrColor(v) {
    if (v === null || v === undefined || isNaN(v)) return '#f3f4f6';
    const abs = Math.abs(v);
    if (v > 0) return `rgba(220,38,38,${0.15 + abs * 0.75})`;
    return `rgba(37,99,235,${0.15 + abs * 0.75})`;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '.7rem', margin: '0 auto' }}>
        <thead>
          <tr>
            <th style={{ width: cellSize, height: cellSize }} />
            {vars.map(v => (
              <th key={v} style={{ width: cellSize, height: cellSize,
                fontWeight: 700, color: '#374151', textAlign: 'center',
                fontSize: '.68rem', padding: '2px' }}>
                {v === 'cwsi' ? 'CWSI' : v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vars.map(row => (
            <tr key={row}>
              <td style={{ fontWeight: 700, color: '#374151', fontSize: '.68rem',
                paddingRight: 4, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {row === 'cwsi' ? 'CWSI' : row}
              </td>
              {vars.map(col => {
                const val = correlations?.[row]?.[col];
                return (
                  <td key={col} title={`${row} / ${col} = ${val?.toFixed(3) ?? 'N/A'}`}
                    style={{ width: cellSize, height: cellSize,
                      background: corrColor(val),
                      textAlign: 'center', fontWeight: 700,
                      color: Math.abs(val || 0) > 0.5 ? 'white' : '#374151',
                      border: '1px solid #e5e7eb', cursor: 'default' }}>
                    {val != null ? val.toFixed(2) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Légende corrélation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
        justifyContent: 'center', fontSize: '.7rem', color: '#6b7280' }}>
        <span style={{ width: 14, height: 14, background: 'rgba(37,99,235,0.8)',
          borderRadius: 2, display: 'inline-block' }} />
        Corrél. négative
        <span style={{ width: 14, height: 14, background: '#f3f4f6',
          border: '1px solid #e5e7eb', borderRadius: 2, display: 'inline-block', marginLeft: 6 }} />
        Nulle
        <span style={{ width: 14, height: 14, background: 'rgba(220,38,38,0.8)',
          borderRadius: 2, display: 'inline-block', marginLeft: 6 }} />
        Corrél. positive
      </div>
    </div>
  );
}

/* ── Composant chart wrapper ─────────────────────────────────────────────── */
function ChartCard({ title, icon: Icon, children, fullWidth }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,.07)', border: '1px solid #e5e7eb',
      gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1rem' }}>
        {Icon && <Icon size={15} color="#2d6a4f" />}
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: '#111827' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Dashboard principal ─────────────────────────────────────────────────── */
export default function AnalyticsDashboard() {
  const navigate   = useNavigate();
  const dashRef    = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [monthFilter, setMonthFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  /* Charger résultat depuis localStorage */
  const result = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
    catch { return null; }
  }, []);

  /* Filtrer scatter_sample selon les filtres */
  const filteredScatter = useMemo(() => {
    if (!result?.scatter_sample) return [];
    let d = result.scatter_sample;
    if (monthFilter !== 'all') {
      d = d.filter(r => Number(r.month) === Number(monthFilter));
    }
    if (regionFilter !== 'all') {
      d = d.filter(r => {
        const lat = Number(r.latitude);
        if (!lat) return true;
        if (regionFilter === 'nord')   return lat > 34;
        if (regionFilter === 'centre') return lat >= 31 && lat <= 34;
        if (regionFilter === 'sud')    return lat < 31;
        return true;
      });
    }
    return d;
  }, [result, monthFilter, regionFilter]);

  /* Filtrer monthly_indices */
  const filteredMonthly = useMemo(() => {
    if (!result?.monthly_indices) return [];
    if (monthFilter === 'all') return result.monthly_indices;
    return result.monthly_indices.filter(m => Number(m.month) === Number(monthFilter));
  }, [result, monthFilter]);

  /* KPIs depuis scatter filtré */
  const kpis = useMemo(() => {
    const d = filteredScatter.length > 0 ? filteredScatter : (result?.scatter_sample || []);
    const n = d.length || 1;
    const avgCWSI  = (d.reduce((s, r) => s + (Number(r.cwsi) || 0), 0) / n).toFixed(3);
    const avgNDVI  = (d.reduce((s, r) => s + (Number(r.NDVI) || 0), 0) / n).toFixed(3);
    const severe   = d.filter(r => Number(r.cwsi) > 0.6).length;
    const severePct = ((severe / n) * 100).toFixed(1);
    return { avgCWSI, avgNDVI, total: result?.analyzed_rows ?? n, severePct };
  }, [filteredScatter, result]);

  /* Mois disponibles pour le filtre */
  const availableMonths = useMemo(() => {
    if (!result?.monthly_indices) return [];
    return result.monthly_indices.map(m => m.month).sort((a, b) => a - b);
  }, [result]);

  /* Export PDF */
  const handleExport = async () => {
    if (!dashRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashRef.current, { scale: 1.2, useCORS: true });
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const ratio = canvas.height / canvas.width;
      const h = w * ratio;
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      let remaining = h;
      while (remaining > 0) {
        const sliceH = Math.min(pageH, remaining);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = (sliceH / h) * canvas.height;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, -(y / h) * canvas.height);
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, sliceH);
        remaining -= pageH;
        y += pageH;
        if (remaining > 0) pdf.addPage();
      }
      pdf.save(`malops-analytics-${result?.filename ?? 'rapport'}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  /* Scatter coloré — déclaré avant tout return conditionnel */
  const scatterByClass = useMemo(() => {
    const classes = { Faible: [], 'Modéré': [], 'Sévère': [] };
    filteredScatter.forEach(r => {
      const cl = String(r.stress_class);
      if (classes[cl]) classes[cl].push({ x: Number(r.NDVI), y: Number(r.cwsi), r: Number(r.Precipitation) || 5 });
    });
    return classes;
  }, [filteredScatter]);

  /* ── Pas de données ── */
  if (!result) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
        <h2 style={{ color: '#374151', marginBottom: '.5rem' }}>Aucune analyse disponible</h2>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
          Importez un fichier CSV dans l'espace Prédiction pour voir les analytics.
        </p>
        <button onClick={() => navigate('/client/prediction')}
          style={{ background: '#2d6a4f', color: 'white', border: 'none',
            borderRadius: 9, padding: '.65rem 1.5rem', fontWeight: 700,
            fontSize: '.9rem', cursor: 'pointer', display: 'inline-flex',
            alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} /> Aller à la Prédiction
        </button>
      </div>
    );
  }

  /* Couleurs pour les barres de distribution */
  const DIST_COLORS = ['#1a9850', '#a6d96a', '#fd8d3c', '#e31a1c', '#800026'];

  return (
    <div ref={dashRef} style={{ padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto',
      background: '#f8f9fa', minHeight: '100vh' }}>
      <style>{`
        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
        @media (max-width: 900px) { .chart-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
            Analytics Dashboard
          </h1>
          <p style={{ margin: '.25rem 0 0', color: '#6b7280', fontSize: '.85rem' }}>
            Fichier : <strong>{result.filename}</strong>
            {result.year && ` · Année ${result.year}`}
            {result.region && ` · ${result.region}`}
            {' · '}<span style={{ color: '#2d6a4f' }}>{result.analyzed_rows?.toLocaleString()} lignes analysées</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/client/prediction')}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: 'white', border: '1px solid #d1d5db', borderRadius: 8,
              padding: '.4rem .9rem', cursor: 'pointer', fontSize: '.82rem',
              fontWeight: 600, color: '#374151' }}>
            <RefreshCw size={14} /> Nouvelle analyse
          </button>
          <button onClick={handleExport} disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: '#2d6a4f', border: 'none', borderRadius: 8,
              padding: '.4rem .9rem', cursor: exporting ? 'wait' : 'pointer',
              fontSize: '.82rem', fontWeight: 700, color: 'white' }}>
            <FileDown size={14} /> {exporting ? 'Export…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div style={{ background: 'white', borderRadius: 10, padding: '.75rem 1.25rem',
        boxShadow: '0 1px 4px rgba(0,0,0,.07)', marginBottom: '1.25rem',
        display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6,
          fontWeight: 700, fontSize: '.83rem', color: '#374151' }}>
          <SlidersHorizontal size={15} color="#2d6a4f" /> Filtres :
        </span>

        {/* Filtre mois */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#6b7280' }}>Mois :</span>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '.3rem .6rem',
              fontSize: '.82rem', color: '#374151', cursor: 'pointer' }}>
            <option value="all">Tous</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{MONTHS_FR[m]}</option>
            ))}
          </select>
        </div>

        {/* Filtre région */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#6b7280' }}>Région :</span>
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '.3rem .6rem',
              fontSize: '.82rem', color: '#374151', cursor: 'pointer' }}>
            <option value="all">Toutes</option>
            <option value="nord">Nord (lat &gt; 34°)</option>
            <option value="centre">Centre (31–34°)</option>
            <option value="sud">Sud (lat &lt; 31°)</option>
          </select>
        </div>

        {(monthFilter !== 'all' || regionFilter !== 'all') && (
          <button onClick={() => { setMonthFilter('all'); setRegionFilter('all'); }}
            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7,
              padding: '.3rem .7rem', cursor: 'pointer', fontSize: '.8rem',
              color: '#dc2626', fontWeight: 600 }}>
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <KpiCard label="CWSI moyen"     value={kpis.avgCWSI} unit=""    icon={Activity}
          color="#2d6a4f" sub={`Seuil stress modéré : 0.4`} />
        <KpiCard label="NDVI moyen"     value={kpis.avgNDVI} unit=""    icon={TrendingUp}
          color="#0891b2" sub="Végétation (0 = sol nu, 1 = dense)" />
        <KpiCard label="Points analysés" value={kpis.total?.toLocaleString()} unit="" icon={BarChart3}
          color="#7c3aed" sub="Lignes dans le CSV" />
        <KpiCard label="Stress sévère"  value={kpis.severePct} unit="%" icon={AlertTriangle}
          color="#dc2626" sub="CWSI > 0.6" />
      </div>

      {/* ── Graphiques : ligne 1 ── */}
      <div className="chart-grid">
        {/* 1. Distribution CWSI */}
        <ChartCard title="Distribution du CWSI" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={result.cwsi_distribution || []}
              margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n, p) => [`${v} points (${p.payload.pct}%)`, 'Nb de points']} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {(result.cwsi_distribution || []).map((_, i) => (
                  <Cell key={i} fill={DIST_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {(result.cwsi_distribution || []).map((d, i) => (
              <span key={i} style={{ fontSize: '.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, background: DIST_COLORS[i],
                  borderRadius: 2, display: 'inline-block' }} />
                {d.range} : {d.pct}%
              </span>
            ))}
          </div>
        </ChartCard>

        {/* 2. Niveaux de stress (Pie) */}
        <ChartCard title="Répartition des niveaux de stress" icon={Activity}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Faible (CWSI < 0.4)',  value: result.faible_pct, color: '#52b788' },
                  { name: 'Modéré (0.4–0.6)',      value: result.modere_pct, color: '#fb8500' },
                  { name: 'Sévère (CWSI > 0.6)',   value: result.severe_pct, color: '#d62828' },
                ].filter(d => d.value > 0)}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                dataKey="value" paddingAngle={3}
                label={({ name, value }) => `${value}%`}
                labelLine={false}
              >
                {[result.faible_pct, result.modere_pct, result.severe_pct]
                  .filter(v => v > 0)
                  .map((_, i) => (
                    <Cell key={i} fill={['#52b788','#fb8500','#d62828'][i]} />
                  ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend formatter={(v) => <span style={{ fontSize: '.78rem' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Graphiques : ligne 2 ── */}
      <div className="chart-grid">
        {/* 3. Multi-Index Timeline */}
        <ChartCard title="Évolution mensuelle des indices" icon={TrendingUp} fullWidth>
          {filteredMonthly.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredMonthly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tickFormatter={m => MONTHS_FR[m] || m} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left"  domain={[-0.5, 1]} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={m => MONTHS_FR[m] || m}
                  formatter={(v, n) => [v?.toFixed(3), n]} />
                <Legend formatter={n => <span style={{ fontSize: '.76rem' }}>{n}</span>} />
                <ReferenceLine yAxisId="left" y={0.6} stroke="#dc2626" strokeDasharray="5 3"
                  label={{ value: 'Seuil sévère', position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
                <Line yAxisId="left"  dataKey="NDVI"  stroke="#16a34a" dot={false} strokeWidth={2} name="NDVI" />
                <Line yAxisId="left"  dataKey="NDWI"  stroke="#0284c7" dot={false} strokeWidth={2} name="NDWI" />
                <Line yAxisId="left"  dataKey="cwsi"  stroke="#dc2626" dot={false} strokeWidth={2.5} name="CWSI" />
                <Line yAxisId="left"  dataKey="SoilMoisture" stroke="#7c3aed" dot={false} strokeWidth={1.5} name="Sol" />
                <Line yAxisId="right" dataKey="Precipitation" stroke="#0891b2" dot={false} strokeDasharray="4 2" name="Précip." />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#9ca3af', fontSize: '.85rem' }}>
              Données insuffisantes pour la timeline (besoin de plusieurs mois)
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Graphiques : ligne 3 ── */}
      <div className="chart-grid">
        {/* 4. Précipitations vs CWSI */}
        <ChartCard title="Précipitations vs CWSI mensuel" icon={Activity}>
          {filteredMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={filteredMonthly} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tickFormatter={m => MONTHS_FR[m] || m} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={m => MONTHS_FR[m] || m}
                  formatter={(v, n) => [v?.toFixed(3), n]} />
                <Legend formatter={n => <span style={{ fontSize: '.76rem' }}>{n}</span>} />
                <Bar yAxisId="left" dataKey="Precipitation" fill="#0891b2" opacity={0.65}
                  radius={[4, 4, 0, 0]} name="Précipitations (mm)" />
                <Line yAxisId="right" dataKey="cwsi" stroke="#dc2626" strokeWidth={2.5}
                  dot={{ r: 4 }} name="CWSI moyen" />
                <ReferenceLine yAxisId="right" y={0.6} stroke="#dc262660" strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#9ca3af', fontSize: '.85rem' }}>
              Données mensuelles non disponibles
            </div>
          )}
        </ChartCard>

        {/* 5. Scatter NDVI vs CWSI */}
        <ChartCard title="NDVI vs CWSI (par classe de stress)" icon={TrendingUp}>
          {filteredScatter.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" dataKey="x" name="NDVI" domain={[-0.2, 1]}
                  tick={{ fontSize: 10 }} label={{ value: 'NDVI', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="CWSI" domain={[0, 1]}
                  tick={{ fontSize: 10 }} label={{ value: 'CWSI', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <ZAxis type="number" dataKey="r" range={[20, 60]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v, n) => [v?.toFixed(3), n]} />
                <Legend formatter={n => <span style={{ fontSize: '.76rem' }}>{n}</span>} />
                {[
                  { key: 'Faible',  color: '#52b788' },
                  { key: 'Modéré', color: '#fb8500' },
                  { key: 'Sévère', color: '#d62828' },
                ].map(({ key, color }) => scatterByClass[key]?.length > 0 && (
                  <Scatter key={key} name={key} data={scatterByClass[key]} fill={color} opacity={0.7} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#9ca3af', fontSize: '.85rem' }}>
              Aucune donnée disponible
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Corrélation ── */}
      <div className="chart-grid" style={{ marginBottom: '1.25rem' }}>
        <ChartCard title="Matrice de corrélation des indices" icon={BarChart3} fullWidth>
          <CorrMatrix correlations={result.correlations} />
          <p style={{ fontSize: '.72rem', color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
            Rouge = corrélation positive · Bleu = corrélation négative · Plus la couleur est intense, plus la relation est forte
          </p>
        </ChartCard>
      </div>

      {/* ── Carte géographique ── */}
      {result.geo_sample?.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem',
          boxShadow: '0 2px 8px rgba(0,0,0,.07)', border: '1px solid #e5e7eb',
          marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: '1rem' }}>
            <MapPin size={15} color="#2d6a4f" />
            <span style={{ fontWeight: 700, fontSize: '.88rem', color: '#111827' }}>
              Distribution géographique — {result.geo_sample.length} points
            </span>
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <MapContainer
              center={[
                result.geo_sample.reduce((s, p) => s + p.lat, 0) / result.geo_sample.length,
                result.geo_sample.reduce((s, p) => s + p.lon, 0) / result.geo_sample.length,
              ]}
              zoom={7} style={{ height: 420, width: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap" />
              {result.geo_sample.map((pt, i) => (
                <CircleMarker key={i} center={[pt.lat, pt.lon]} radius={5}
                  pathOptions={{ fillColor: cwsiColor(pt.cwsi), color: 'rgba(0,0,0,.2)',
                    weight: 0.5, fillOpacity: 0.8 }}>
                  <Popup>
                    <div style={{ fontSize: '.8rem', lineHeight: 1.5 }}>
                      <strong style={{ color: cwsiColor(pt.cwsi) }}>{pt.class}</strong><br />
                      CWSI : <strong>{pt.cwsi.toFixed(3)}</strong><br />
                      Lat {pt.lat} · Lon {pt.lon}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          {/* Légende carte */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: '.6rem',
            fontSize: '.74rem', fontWeight: 600 }}>
            {[
              ['< 0.2 Pas de stress',  '#1a9850'],
              ['0.2–0.4 Léger',        '#a6d96a'],
              ['0.4–0.6 Modéré',       '#fd8d3c'],
              ['0.6–0.8 Sévère',       '#e31a1c'],
              ['> 0.8 Extrême',        '#800026'],
            ].map(([label, color]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%',
                  background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tableau de données ── */}
      <DataTable data={filteredScatter} />
    </div>
  );
}

/* ── Tableau paginé ─────────────────────────────────────────────────────── */
function DataTable({ data }) {
  const [page,    setPage]    = useState(0);
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('cwsi');
  const [sortDir, setSortDir] = useState('desc');
  const pageSize = 10;

  const COLS = [
    { key: 'NDVI',         label: 'NDVI' },
    { key: 'NDWI',         label: 'NDWI' },
    { key: 'LST',          label: 'LST (°C)' },
    { key: 'Precipitation',label: 'Précip.' },
    { key: 'cwsi',         label: 'CWSI' },
    { key: 'stress_class', label: 'Classe' },
  ];

  const filtered = useMemo(() => {
    let d = data;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    d = [...d].sort((a, b) => {
      const av = Number(a[sortKey]) || 0, bv = Number(b[sortKey]) || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return d;
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const exportCSV = () => {
    const header = COLS.map(c => c.key).join(',');
    const rows = filtered.map(r => COLS.map(c => r[c.key] ?? '').join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'malops-data.csv'; a.click();
  };

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.1rem 1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: '#111827' }}>
          Données détaillées — {filtered.length} lignes
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Rechercher…"
            style={{ border: '1px solid #d1d5db', borderRadius: 7, padding: '.35rem .7rem',
              fontSize: '.82rem', width: 160 }} />
          <button onClick={exportCSV}
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7,
              padding: '.35rem .8rem', cursor: 'pointer', fontSize: '.82rem',
              color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FileDown size={13} /> CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  style={{ padding: '.5rem .9rem', background: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb', fontWeight: 700, color: '#374151',
                    textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer',
                    userSelect: 'none' }}>
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa',
                borderBottom: '1px solid #f3f4f6' }}>
                {COLS.map(col => {
                  const v = row[col.key];
                  const isClass = col.key === 'stress_class';
                  const color = isClass
                    ? (v === 'Sévère' ? '#dc2626' : v === 'Modéré' ? '#d97706' : '#16a34a')
                    : col.key === 'cwsi' ? cwsiColor(Number(v)) : '#374151';
                  return (
                    <td key={col.key} style={{ padding: '.45rem .9rem', color,
                      fontWeight: col.key === 'cwsi' || isClass ? 700 : 400 }}>
                      {typeof v === 'number' ? v.toFixed(3) : String(v ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 8, marginTop: '1rem' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '.3rem .7rem', borderRadius: 6, border: '1px solid #d1d5db',
              cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '.82rem',
              background: 'white', color: page === 0 ? '#d1d5db' : '#374151' }}>
            ← Préc.
          </button>
          <span style={{ fontSize: '.82rem', color: '#6b7280' }}>
            Page {page + 1} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{ padding: '.3rem .7rem', borderRadius: 6, border: '1px solid #d1d5db',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '.82rem',
              background: 'white', color: page >= totalPages - 1 ? '#d1d5db' : '#374151' }}>
            Suiv. →
          </button>
        </div>
      )}
    </div>
  );
}

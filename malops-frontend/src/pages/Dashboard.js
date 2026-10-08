import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiML, apiUsers } from '../api/axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ComposedChart,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from 'recharts';

const ACCENT = '#4f8ef7';
const TEXT = '#1a1a2e';
const MUTED = '#6b7280';

const STRESS_KEYS = [
  { key: 'pas de stress', label: 'Pas de stress', color: '#1a9850' },
  { key: 'stress léger', label: 'Stress léger', color: '#fee08b' },
  { key: 'stress modéré', label: 'Stress modéré', color: '#fd8d3c' },
  { key: 'stress sévère', label: 'Stress sévère', color: '#e31a1c' },
  { key: 'stress extrême', label: 'Stress extrême', color: '#800026' },
];

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function normalizeStress(label) {
  if (!label || typeof label !== 'string') return 'pas de stress';
  const s = label.trim().toLowerCase();
  if (s.includes('extrême') || s.includes('extreme')) return 'stress extrême';
  if (s.includes('sévère') || s.includes('severe')) return 'stress sévère';
  if (s.includes('modéré') || s.includes('modere')) return 'stress modéré';
  if (s.includes('léger') || s.includes('leger')) return 'stress léger';
  if (s.includes('pas') || s.includes('aucun')) return 'pas de stress';
  return 'pas de stress';
}

function stressDisplayLabel(key) {
  const f = STRESS_KEYS.find((x) => x.key === key);
  return f ? f.label : key;
}

function regionFromLat(lat) {
  const n = Number(lat);
  if (Number.isNaN(n)) return '—';
  if (n > 34) return 'Nord';
  if (n >= 31) return 'Centre';
  return 'Sud';
}

function cwsiVal(row) {
  const v = row.CWSI_predit ?? row.CWSI;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Précipitations (mm) — plusieurs clés possibles selon l’API */
function precipVal(row) {
  const v =
    row.Precipitation ??
    row.precipitation ??
    row.PRECIPITATION ??
    row.precip ??
    row.rain ??
    row.Rain;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function DonutGauge({ percent, color, size = 72 }) {
  const p = Math.min(100, Math.max(0, percent));
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#eef2ff" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text
        x="36"
        y="38"
        textAnchor="middle"
        fill={TEXT}
        fontSize="12"
        fontWeight="700"
        transform="rotate(90 36 36)"
        style={{ userSelect: 'none' }}
      >
        {Math.round(p)}%
      </text>
    </svg>
  );
}

function StressBadge({ label, stressKey }) {
  const cfg = STRESS_KEYS.find((s) => s.key === stressKey) || STRESS_KEYS[0];
  return (
    <span
      className="stress-badge"
      style={{
        background: `${cfg.color}26`,
        color: cfg.color,
        border: `1px solid ${cfg.color}55`,
      }}
    >
      {label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="dash-skeleton">
      <div className="sk-header" />
      <div className="sk-filters" />
      <div className="sk-metrics">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="sk-card" />
        ))}
      </div>
      <div className="sk-row2">
        <div className="sk-chart-lg" />
        <div className="sk-chart-sm" />
      </div>
      <div className="sk-row3">
        <div className="sk-table" />
        <div className="sk-chart-md" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [search, setSearch] = useState('');
  const [lineGranularity, setLineGranularity] = useState('monthly');
  const [hiddenPie, setHiddenPie] = useState(() => new Set());
  const [sortCol, setSortCol] = useState('year');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(10);
  const [myProject, setMyProject] = useState(null);

  const username = typeof localStorage !== 'undefined' ? localStorage.getItem('username') || 'Utilisateur' : 'Utilisateur';
  const todayFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      // 1. Charger le projet assigné
      let projectName = null;
      try {
        const r = await apiUsers.get('/projects/my-project');
        if (!cancel) { setMyProject(r.data); projectName = r.data?.clearml_project_name || null; }
      } catch {}

      // 2. Charger les prédictions filtrées par projet
      if (cancel) return;
      setLoading(true);
      setError(null);
      try {
        const params = projectName ? { project: projectName } : {};
        const res = await apiML.get('/data/predictions', { params });
        if (!cancel) {
          const body = res.data;
          const list = Array.isArray(body) ? body : body?.data || body?.results || [];
          setRaw(list);
        }
      } catch (e) {
        if (!cancel) setError(e?.message || 'Impossible de charger les données');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const filtered = useMemo(() => {
    return raw.filter((row) => {
      if (filterYear !== 'all' && Number(row.year) !== Number(filterYear)) return false;
      if (filterMonth !== 'all' && Number(row.month) !== Number(filterMonth)) return false;
      return true;
    });
  }, [raw, filterYear, filterMonth]);

  const maxPrecipRef = useMemo(() => {
    const sums = {};
    raw.forEach((r) => {
      const y = Number(r.year);
      const m = Number(r.month);
      const k = `${y}-${m}`;
      sums[k] = (sums[k] || 0) + precipVal(r);
    });
    const vals = Object.values(sums);
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [raw]);

  const metrics = useMemo(() => {
    const n = filtered.length;
    const cwsis = filtered.map(cwsiVal).filter((x) => x != null);
    const avgCwsi = cwsis.length ? cwsis.reduce((a, b) => a + b, 0) / cwsis.length : 0;
    let extreme = 0;
    filtered.forEach((r) => {
      if (normalizeStress(r.stress_label) === 'stress extrême') extreme += 1;
      else if (Number(r.stress_niveau) === 4) extreme += 1;
    });
    const pctExtreme = n ? (extreme / n) * 100 : 0;
    const sumPrecip = filtered.reduce((a, r) => a + precipVal(r), 0);

    const gaugeTotal = Math.min(100, (n / Math.max(raw.length || 1, 1)) * 100);
    const gaugeCwsi = Math.min(100, avgCwsi * 100);
    const gaugeExtreme = Math.min(100, pctExtreme * 2);
    const gaugePrecip = Math.min(100, (sumPrecip / maxPrecipRef) * 100);

    return {
      count: n,
      avgCwsi,
      pctExtreme,
      sumPrecip,
      gaugeTotal: raw.length ? gaugeTotal : 0,
      gaugeCwsi,
      gaugeExtreme,
      gaugePrecip,
    };
  }, [filtered, raw.length, maxPrecipRef]);

  const lineDataMultiYear = useMemo(() => {
    if (lineGranularity === 'weekly') {
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return {
          name: `Sem. ${i + 1}`,
          y2022: avgForYearMonth(filtered, 2022, m),
          y2023: avgForYearMonth(filtered, 2023, m),
          y2024: avgForYearMonth(filtered, 2024, m),
        };
      });
    }
    return MONTHS_SHORT.map((name, idx) => {
      const m = idx + 1;
      return {
        name,
        y2022: avgForYearMonth(filtered, 2022, m),
        y2023: avgForYearMonth(filtered, 2023, m),
        y2024: avgForYearMonth(filtered, 2024, m),
      };
    });
  }, [filtered, lineGranularity]);

  const lineDataYearly = useMemo(() => {
    return [2022, 2023, 2024].map((y) => {
      const rows = filtered.filter((r) => Number(r.year) === y);
      const vals = rows.map(cwsiVal).filter((x) => x != null);
      const cwsi = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { name: String(y), cwsi };
    });
  }, [filtered]);

  const pieSlices = useMemo(() => {
    const counts = {};
    STRESS_KEYS.forEach((s) => {
      counts[s.key] = 0;
    });
    filtered.forEach((r) => {
      const k = normalizeStress(r.stress_label);
      if (counts[k] != null) counts[k] += 1;
      else counts['pas de stress'] += 1;
    });
    const total = filtered.length || 1;
    return STRESS_KEYS.map((s) => ({
      name: s.label,
      key: s.key,
      value: counts[s.key],
      pct: (counts[s.key] / total) * 100,
      color: s.color,
    }));
  }, [filtered]);

  const pieDataActive = useMemo(
    () => pieSlices.filter((d) => !hiddenPie.has(d.key) && d.value > 0),
    [pieSlices, hiddenPie]
  );

  const pieCenterPct = useMemo(() => {
    if (!filtered.length) return 0;
    const stressé = filtered.filter((r) => normalizeStress(r.stress_label) !== 'pas de stress').length;
    return Math.round((stressé / filtered.length) * 100);
  }, [filtered]);

  /** Cumul mensuel des précipitations (mm) par année — barres groupées */
  const precipByMonthYear = useMemo(() => {
    return MONTHS_SHORT.map((name, idx) => {
      const m = idx + 1;
      return {
        name,
        '2022': sumPrecipYearMonth(filtered, 2022, m),
        '2023': sumPrecipYearMonth(filtered, 2023, m),
        '2024': sumPrecipYearMonth(filtered, 2024, m),
      };
    });
  }, [filtered]);

  /** ET₀ et humidité du sol : moyennes mensuelles (courbes) */
  const et0HumidityMonthly = useMemo(() => {
    return MONTHS_SHORT.map((name, idx) => {
      const m = idx + 1;
      const rows = filtered.filter((r) => Number(r.month) === m);
      const avg = (fn) => {
        const vals = rows.map(fn).filter((x) => Number.isFinite(x));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      return {
        name,
        ET0: avg((r) => Number(r.ET0)),
        'Humidité %': avg((r) => Number(r.SoilMoisture)) * 100,
      };
    });
  }, [filtered]);

  const ndviArea = useMemo(() => {
    return MONTHS_SHORT.map((name, idx) => {
      const m = idx + 1;
      return {
        name,
        y2022: avgFieldForYearMonth(filtered, 2022, m, 'NDVI'),
        y2023: avgFieldForYearMonth(filtered, 2023, m, 'NDVI'),
        y2024: avgFieldForYearMonth(filtered, 2024, m, 'NDVI'),
      };
    });
  }, [filtered]);

  const scatterData = useMemo(() => {
    return filtered
      .map((r) => {
        const lst = Number(r.LST);
        const c = cwsiVal(r);
        if (!Number.isFinite(lst) || c == null) return null;
        const k = normalizeStress(r.stress_label);
        const col = STRESS_KEYS.find((s) => s.key === k)?.color || ACCENT;
        return { x: lst, y: c, fill: col, stress: k };
      })
      .filter(Boolean)
      .slice(0, 800);
  }, [filtered]);

  const regionBars = useMemo(() => {
    const regs = ['Nord', 'Centre', 'Sud'];
    return regs.map((reg) => {
      const rows = filtered.filter((r) => regionFromLat(r.latitude) === reg);
      const vals = rows.map((r) => Number(r.SoilMoisture)).filter((x) => Number.isFinite(x));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { name: reg, humidité: Math.round(avg * 1000) / 10 };
    });
  }, [filtered]);

  const tableRows = useMemo(() => {
    return filtered.map((r, i) => ({
      id: i,
      year: r.year,
      month: r.month,
      region: regionFromLat(r.latitude),
      precip: precipVal(r),
      cwsi: cwsiVal(r),
      stress: stressDisplayLabel(normalizeStress(r.stress_label)),
      stressKey: normalizeStress(r.stress_label),
      raw: r,
    }));
  }, [filtered]);

  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tableRows;
    return tableRows.filter(
      (row) =>
        String(row.year).includes(q) ||
        MONTHS_FR[Number(row.month) - 1]?.toLowerCase().includes(q) ||
        row.region.toLowerCase().includes(q) ||
        String(row.cwsi ?? '').includes(q) ||
        String(row.precip ?? '').includes(q) ||
        row.stress.toLowerCase().includes(q)
    );
  }, [tableRows, search]);

  const sortedRows = useMemo(() => {
    const arr = [...searchedRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'year':
          cmp = Number(a.year) - Number(b.year);
          break;
        case 'month':
          cmp = Number(a.month) - Number(b.month);
          break;
        case 'region':
          cmp = a.region.localeCompare(b.region);
          break;
        case 'cwsi':
          cmp = (a.cwsi ?? 0) - (b.cwsi ?? 0);
          break;
        case 'precip':
          cmp = (a.precip ?? 0) - (b.precip ?? 0);
          break;
        case 'stress':
          cmp = a.stress.localeCompare(b.stress);
          break;
        default:
          cmp = Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month);
      }
      return cmp * dir;
    });
    return arr;
  }, [searchedRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterYear, filterMonth, search, pageSize]);

  const togglePie = useCallback((key) => {
    setHiddenPie((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onSort = (col) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const tooltipStyle = {
    background: TEXT,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <style>{STYLES}</style>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <style>{STYLES}</style>
        <div className="dash-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <style>{STYLES}</style>

      <header className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title">Dashboard MLOps</h1>
          <p className="dash-subtitle">{todayFr}</p>
          {myProject && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '0.35rem',
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
              padding: '0.25rem 0.75rem', fontSize: '.8rem',
            }}>
              <span style={{ fontWeight: 700, color: '#1d4ed8' }}>Projet :</span>
              <span style={{ color: '#1e40af' }}>{myProject.name}</span>
              {myProject.clearml_project_name && (
                <span style={{
                  color: '#1d4ed8', fontFamily: 'monospace', fontSize: '.74rem',
                  background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600,
                }}>
                  {myProject.clearml_project_name}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="dash-search-wrap">
          <input
            type="search"
            className="dash-search"
            placeholder="Rechercher dans le tableau…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Recherche tableau"
          />
          <button type="button" className="dash-search-btn" aria-label="Rechercher">
            🔍
          </button>
        </div>
        <div className="dash-user">
          <div className="dash-user-info">
            <span className="dash-user-name">{username}</span>
            <span className="dash-user-chevron">▾</span>
          </div>
          <div className="dash-avatar">{username.charAt(0).toUpperCase()}</div>
        </div>
      </header>

      <div className="dash-filters">
        <label>
          <span>Année</span>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="2022">2022</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
          </select>
        </label>
        <label>
          <span>Mois</span>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="all">Tous</option>
            {MONTHS_FR.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filtered.length ? (
        <div className="dash-empty">Aucune donnée pour ces filtres.</div>
      ) : (
        <>
          <section className="dash-metrics">
            <div className="metric-card metric-enter" style={{ animationDelay: '0s' }}>
              <div>
                <div className="metric-icon metric-icon-blue">📊</div>
                <div className="metric-value">{metrics.count.toLocaleString('fr-FR')}</div>
                <div className="metric-label">Total prédictions</div>
              </div>
              <DonutGauge percent={metrics.gaugeTotal} color={ACCENT} />
            </div>
            <div className="metric-card metric-enter" style={{ animationDelay: '0.08s' }}>
              <div>
                <div className="metric-icon metric-icon-green">🌿</div>
                <div className="metric-value">{metrics.avgCwsi.toFixed(3)}</div>
                <div className="metric-label">CWSI moyen global</div>
              </div>
              <DonutGauge percent={metrics.gaugeCwsi} color="#22c55e" />
            </div>
            <div className="metric-card metric-enter" style={{ animationDelay: '0.16s' }}>
              <div>
                <div className="metric-icon metric-icon-red">⚠️</div>
                <div className="metric-value">{metrics.pctExtreme.toFixed(1)} %</div>
                <div className="metric-label">Stress extrême</div>
              </div>
              <DonutGauge percent={metrics.gaugeExtreme} color="#f97316" />
            </div>
            <div className="metric-card metric-enter" style={{ animationDelay: '0.24s' }}>
              <div>
                <div className="metric-icon metric-icon-blue">💧</div>
                <div className="metric-value">{metrics.sumPrecip.toFixed(1)} mm</div>
                <div className="metric-label">Précipitations totales</div>
              </div>
              <DonutGauge percent={metrics.gaugePrecip} color={ACCENT} />
            </div>
          </section>

          <section className="dash-row2">
            <div className="dash-card dash-card-lg">
              <div className="dash-card-head">
                <h2>CWSI — rapport temporel</h2>
                <select
                  className="dash-mini-select"
                  value={lineGranularity}
                  onChange={(e) => setLineGranularity(e.target.value)}
                >
                  <option value="monthly">Mensuel</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>
              <div className="chart-box chart-tall">
                <ResponsiveContainer width="100%" height="100%">
                  {lineGranularity === 'yearly' ? (
                    <LineChart data={lineDataYearly} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v != null ? Number(v).toFixed(3) : '—', 'CWSI']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cwsi"
                        name="CWSI moyen"
                        stroke={ACCENT}
                        strokeWidth={3}
                        dot={{ r: 4, fill: ACCENT }}
                        connectNulls
                      />
                    </LineChart>
                  ) : (
                    <LineChart data={lineDataMultiYear} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1]} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v != null ? Number(v).toFixed(3) : '—', '']} />
                      <Legend />
                      <Line type="monotone" dataKey="y2022" name="2022" stroke="#4f8ef7" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="y2023" name="2023" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="y2024" name="2024" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dash-card dash-card-sm">
              <div className="dash-card-head">
                <h2>Distribution du stress</h2>
              </div>
              <div className="chart-box chart-donut donut-wrap">
                <div className="donut-center">
                  <strong>{pieCenterPct}%</strong>
                  <span>sous stress</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        pieDataActive.length
                          ? pieDataActive
                          : [{ name: 'Aucun segment', value: 1, pct: 0, key: 'empty', color: '#e5e7eb' }]
                      }
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {(pieDataActive.length ? pieDataActive : [{ key: 'empty', color: '#e5e7eb' }]).map((d) => (
                        <Cell key={d.key} fill={d.color} stroke="#fff" strokeWidth={1} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v, _n, p) => [`${v} (${(p?.payload?.pct ?? 0).toFixed(1)}%)`, p?.payload?.name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pie-legend">
                {STRESS_KEYS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`pie-legend-item ${hiddenPie.has(s.key) ? 'off' : ''}`}
                    onClick={() => togglePie(s.key)}
                  >
                    <span className="dot" style={{ background: s.color }} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="dash-row3">
            <div className="dash-card dash-card-table">
              <div className="dash-card-head">
                <h2>Prédictions récentes</h2>
                <button type="button" className="link-more" onClick={() => setPageSize((s) => (s >= 50 ? 10 : s + 10))}>
                  Voir plus
                </button>
              </div>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => onSort('year')}>
                        Année {sortCol === 'year' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="sortable" onClick={() => onSort('month')}>
                        Mois {sortCol === 'month' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="sortable" onClick={() => onSort('region')}>
                        Région {sortCol === 'region' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="sortable" onClick={() => onSort('cwsi')}>
                        CWSI {sortCol === 'cwsi' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="sortable" onClick={() => onSort('precip')}>
                        Précip. (mm) {sortCol === 'precip' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="sortable" onClick={() => onSort('stress')}>
                        Stress {sortCol === 'stress' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr key={`${row.id}-${row.year}-${row.month}`}>
                        <td>{row.year}</td>
                        <td>{MONTHS_FR[Number(row.month) - 1] || row.month}</td>
                        <td>{row.region}</td>
                        <td>{row.cwsi != null ? row.cwsi.toFixed(3) : '—'}</td>
                        <td>{row.precip != null ? row.precip.toFixed(1) : '—'}</td>
                        <td>{row.stress}</td>
                        <td>
                          <StressBadge label={row.stress} stressKey={row.stressKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-pager">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </button>
              </div>
            </div>

            <div className="dash-card dash-card-bars">
              <div className="dash-card-head">
                <h2>Précipitations &amp; analytique</h2>
              </div>
              <p className="chart-caption">Cumul des précipitations (mm) par mois et par année</p>
              <div className="chart-box" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={precipByMonthYear} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: MUTED, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [`${Number(v).toFixed(1)} mm`, '']}
                    />
                    <Legend />
                    <Bar dataKey="2022" name="2022" fill="#4f8ef7" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="2023" name="2023" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="2024" name="2024" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-caption chart-caption-spaced">ET₀ et humidité du sol (moyennes mensuelles)</p>
              <div className="chart-box" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={et0HumidityMonthly} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="et0"
                      orientation="left"
                      tick={{ fill: MUTED, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'ET₀', angle: -90, position: 'insideLeft', fill: MUTED, fontSize: 10 }}
                    />
                    <YAxis
                      yAxisId="hum"
                      orientation="right"
                      tick={{ fill: MUTED, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                      label={{ value: '%', angle: 90, position: 'insideRight', fill: MUTED, fontSize: 10 }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line
                      yAxisId="et0"
                      type="monotone"
                      dataKey="ET0"
                      name="ET₀"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="hum"
                      type="monotone"
                      dataKey="Humidité %"
                      name="Humidité sol %"
                      stroke="#fb923c"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="dash-row4">
            <div className="dash-card">
              <div className="dash-card-head">
                <h2>NDVI moyen par mois</h2>
              </div>
              <div className="chart-box chart-mid">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ndviArea} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ndviG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: MUTED, fontSize: 10 }} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="y2022" name="2022" stroke="#4f8ef7" fillOpacity={1} fill="url(#ndviG)" />
                    <Area type="monotone" dataKey="y2023" name="2023" stroke="#8b5cf6" fillOpacity={0.2} fill="#8b5cf6" />
                    <Area type="monotone" dataKey="y2024" name="2024" stroke="#06b6d4" fillOpacity={0.2} fill="#06b6d4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-card-head">
                <h2>LST vs CWSI</h2>
              </div>
              <div className="chart-box chart-mid">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" />
                    <XAxis type="number" dataKey="x" name="LST" unit=" °C" tick={{ fill: MUTED, fontSize: 10 }} />
                    <YAxis type="number" dataKey="y" name="CWSI" tick={{ fill: MUTED, fontSize: 10 }} domain={[0, 1]} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter
                      name="Observations"
                      data={scatterData}
                      shape={(props) => {
                        const { cx, cy, payload } = props;
                        return <circle cx={cx} cy={cy} r={5} fill={payload?.fill || ACCENT} stroke="#fff" strokeWidth={0.5} />;
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="dash-card">
              <div className="dash-card-head">
                <h2>Humidité du sol par région</h2>
              </div>
              <div className="chart-box chart-mid">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={regionBars} margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf4" horizontal={false} />
                    <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fill: MUTED, fontSize: 11 }} width={48} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} %`, 'Humidité']} />
                    <Bar dataKey="humidité" radius={[0, 6, 6, 0]}>
                      {regionBars.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#60a5fa' : i === 1 ? '#818cf8' : '#a78bfa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function sumPrecipYearMonth(rows, year, month) {
  return rows
    .filter((r) => Number(r.year) === year && Number(r.month) === month)
    .reduce((acc, r) => acc + precipVal(r), 0);
}

function avgForYearMonth(rows, year, month) {
  const sub = rows.filter((r) => Number(r.year) === year && Number(r.month) === month);
  const vals = sub.map(cwsiVal).filter((x) => x != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function avgFieldForYearMonth(rows, year, month, field) {
  const sub = rows.filter((r) => Number(r.year) === year && Number(r.month) === month);
  const vals = sub.map((r) => Number(r[field])).filter((x) => Number.isFinite(x));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const STYLES = `
.dashboard-page {
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  background: linear-gradient(165deg, #f0f4ff 0%, #fdf2f8 45%, #ffffff 100%);
  padding: 24px 28px 48px;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: ${TEXT};
}
.dash-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.dash-title { margin: 0; font-size: 1.65rem; font-weight: 800; color: ${TEXT}; }
.dash-subtitle { margin: 4px 0 0; font-size: 0.9rem; color: ${MUTED}; text-transform: capitalize; }
.dash-search-wrap {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(79, 142, 247, 0.12);
}
.dash-search {
  flex: 1;
  border: none;
  padding: 12px 16px;
  font-size: 14px;
  background: #fff;
  color: ${TEXT};
  outline: none;
}
.dash-search-btn {
  width: 48px;
  border: none;
  background: ${ACCENT};
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}
.dash-user { display: flex; align-items: center; gap: 12px; }
.dash-user-info { display: flex; flex-direction: column; align-items: flex-end; }
.dash-user-name { font-weight: 600; font-size: 14px; }
.dash-user-chevron { font-size: 10px; color: ${MUTED}; }
.dash-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, ${ACCENT}, #8b5cf6);
  color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center;
}
.dash-filters {
  display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;
}
.dash-filters label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: ${MUTED}; font-weight: 600; }
.dash-filters select {
  padding: 10px 14px; border-radius: 10px; border: 1px solid #e5e7eb;
  background: #fff; color: ${TEXT}; min-width: 160px; font-size: 14px;
}
.dash-empty, .dash-error {
  background: #fff; border-radius: 16px; padding: 40px; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: ${MUTED};
}
.dash-error { color: #dc2626; }
.dash-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
  margin-bottom: 22px;
}
.metric-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.metric-icon {
  width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  font-size: 20px; margin-bottom: 10px;
}
.metric-icon-blue { background: rgba(79, 142, 247, 0.15); }
.metric-icon-green { background: rgba(34, 197, 94, 0.15); }
.metric-icon-red { background: rgba(249, 115, 22, 0.15); }
.metric-value { font-size: 1.5rem; font-weight: 800; color: ${TEXT}; }
.metric-label { font-size: 13px; color: ${MUTED}; margin-top: 4px; }
.metric-enter {
  animation: metricIn 0.55s ease backwards;
}
@keyframes metricIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.dash-row2 {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: 18px;
  margin-bottom: 22px;
}
@media (max-width: 1024px) {
  .dash-row2 { grid-template-columns: 1fr; }
}
.dash-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}
.dash-card-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.dash-card-head h2 { margin: 0; font-size: 1.05rem; font-weight: 700; color: ${TEXT}; }
.chart-caption { margin: 0 0 8px; font-size: 12px; color: ${MUTED}; }
.chart-caption-spaced { margin-top: 16px; }
.dash-mini-select {
  padding: 8px 12px; border-radius: 10px; border: 1px solid #e5e7eb;
  background: #f8fafc; font-size: 13px; color: ${TEXT}; cursor: pointer;
}
.chart-box { width: 100%; }
.chart-tall { height: 320px; }
.chart-mid { height: 260px; }
.chart-donut { height: 280px; }
.donut-wrap { position: relative; }
.donut-center {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  text-align: center; pointer-events: none; z-index: 2;
}
.donut-center strong { display: block; font-size: 1.35rem; font-weight: 800; color: ${TEXT}; }
.donut-center span { font-size: 11px; color: ${MUTED}; }
.stress-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.dash-row3 {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 22px;
}
@media (max-width: 1024px) {
  .dash-row3 { grid-template-columns: 1fr; }
}
.link-more {
  border: none; background: transparent; color: ${ACCENT}; font-weight: 600; cursor: pointer; font-size: 13px;
}
.table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #f1f5f9; }
.dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dash-table th {
  text-align: left; padding: 12px 14px; background: #f8fafc; color: ${MUTED}; font-weight: 700;
  border-bottom: 1px solid #e5e7eb;
}
.dash-table th.sortable { cursor: pointer; user-select: none; }
.dash-table th.sortable:hover { color: ${ACCENT}; }
.dash-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: ${TEXT}; }
.dash-table tbody tr:hover { background: #f8fafc; }
.badge {
  display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}
.table-pager {
  display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 12px; font-size: 13px; color: ${MUTED};
}
.table-pager button {
  padding: 6px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
}
.table-pager button:disabled { opacity: 0.4; cursor: not-allowed; }
.dash-row4 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 18px;
}
.pie-legend {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px;
}
.pie-legend-item {
  display: inline-flex; align-items: center; gap: 6px; border: none; background: #f8fafc;
  padding: 6px 10px; border-radius: 999px; font-size: 11px; cursor: pointer; color: ${TEXT};
}
.pie-legend-item.off { opacity: 0.45; text-decoration: line-through; }
.pie-legend-item .dot { width: 8px; height: 8px; border-radius: 50%; }
.dash-skeleton .sk-header { height: 64px; background: #e8ecf4; border-radius: 16px; margin-bottom: 16px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-filters { height: 48px; width: 40%; background: #e8ecf4; border-radius: 12px; margin-bottom: 20px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.dash-skeleton .sk-card { height: 120px; background: #e8ecf4; border-radius: 16px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-row2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin-bottom: 20px; }
.dash-skeleton .sk-chart-lg { height: 340px; background: #e8ecf4; border-radius: 16px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-chart-sm { height: 340px; background: #e8ecf4; border-radius: 16px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-row3 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
.dash-skeleton .sk-table { height: 360px; background: #e8ecf4; border-radius: 16px; animation: pulse 1.2s ease infinite; }
.dash-skeleton .sk-chart-md { height: 360px; background: #e8ecf4; border-radius: 16px; animation: pulse 1.2s ease infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@media (max-width: 900px) {
  .dash-skeleton .sk-metrics { grid-template-columns: repeat(2, 1fr); }
  .dash-skeleton .sk-row2, .dash-skeleton .sk-row3 { grid-template-columns: 1fr; }
}
`;

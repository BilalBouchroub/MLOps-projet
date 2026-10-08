/**
 * Module autonome — aucun import depuis le reste du projet.
 * API : GET http://localhost:8000/data/predictions + Bearer localStorage['token']
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

const API_URL = 'http://localhost:8000/data/predictions';

const ACCENT = '#f5a623';
const BG_PAGE = '#0a0a0a';
const BG_CARD = '#1a1a1a';

const STRESS_PALETTE = {
  'pas de stress': '#1a9850',
  'stress léger': '#fee08b',
  'stress modéré': '#fd8d3c',
  'stress sévère': '#e31a1c',
  'stress extrême': '#800026',
};

const STRESS_ICONS = {
  'pas de stress': '☀️',
  'stress léger': '🌤️',
  'stress modéré': '⛅',
  'stress sévère': '🌧️',
  'stress extrême': '⛈️',
};

const MONTHS_FR = [
  { v: 1, label: 'Janvier' },
  { v: 2, label: 'Février' },
  { v: 3, label: 'Mars' },
  { v: 4, label: 'Avril' },
  { v: 5, label: 'Mai' },
  { v: 6, label: 'Juin' },
  { v: 7, label: 'Juillet' },
  { v: 8, label: 'Août' },
  { v: 9, label: 'Septembre' },
  { v: 10, label: 'Octobre' },
  { v: 11, label: 'Novembre' },
  { v: 12, label: 'Décembre' },
];

const YEARS = [2022, 2023, 2024];

const REGIONS = [
  { id: 'all', label: 'Toutes les régions', test: () => true },
  { id: 'nord', label: 'Nord Maroc (lat > 34)', test: (lat) => lat > 34 },
  { id: 'centre', label: 'Centre Maroc (31–34)', test: (lat) => lat >= 31 && lat <= 34 },
  { id: 'sud', label: 'Sud Maroc (lat < 31)', test: (lat) => lat < 31 },
];

function normalizeStressLabel(label) {
  if (!label || typeof label !== 'string') return 'pas de stress';
  const s = label.trim().toLowerCase();
  if (s.includes('extrême') || s.includes('extreme')) return 'stress extrême';
  if (s.includes('sévère') || s.includes('severe')) return 'stress sévère';
  if (s.includes('modéré') || s.includes('modere')) return 'stress modéré';
  if (s.includes('léger') || s.includes('leger')) return 'stress léger';
  if (s.includes('pas') || s.includes('aucun') || s.includes('no stress')) return 'pas de stress';
  return 'pas de stress';
}

function colorForStress(label, apiColor) {
  if (apiColor && typeof apiColor === 'string' && apiColor.startsWith('#')) return apiColor;
  const key = normalizeStressLabel(label);
  return STRESS_PALETTE[key] || STRESS_PALETTE['pas de stress'];
}

function iconForStress(label) {
  const key = normalizeStressLabel(label);
  return STRESS_ICONS[key] || '☀️';
}

function regionMatch(regionId, lat) {
  const latNum = Number(lat);
  if (Number.isNaN(latNum)) return regionId === 'all';
  const def = REGIONS.find((r) => r.id === regionId);
  return def ? def.test(latNum) : true;
}

function parseDay(row) {
  if (row.day != null && !Number.isNaN(Number(row.day))) return Number(row.day);
  if (row.date) {
    const d = new Date(row.date);
    if (!Number.isNaN(d.getTime())) return d.getDate();
  }
  if (row.timestamp) {
    const d = new Date(row.timestamp);
    if (!Number.isNaN(d.getTime())) return d.getDate();
  }
  return null;
}

function buildLstSegments(avgLst) {
  const base = Number(avgLst) || 0;
  return [
    { name: 'Matin', lst: Math.round((base * 0.92 + Number.EPSILON) * 10) / 10 },
    { name: 'Après-midi', lst: Math.round((base * 1.06 + Number.EPSILON) * 10) / 10 },
    { name: 'Soir', lst: Math.round((base * 0.98 + Number.EPSILON) * 10) / 10 },
    { name: 'Nuit', lst: Math.round((base * 0.88 + Number.EPSILON) * 10) / 10 },
  ];
}

function dominantStressStats(rows) {
  const counts = {};
  rows.forEach((r) => {
    const k = normalizeStressLabel(r.stress_label);
    counts[k] = (counts[k] || 0) + 1;
  });
  const entries = Object.entries(counts);
  if (!entries.length) return { label: '—', pct: 0, color: STRESS_PALETTE['pas de stress'] };
  entries.sort((a, b) => b[1] - a[1]);
  const [label, n] = entries[0];
  const pct = Math.round((n / rows.length) * 1000) / 10;
  return { label, pct, color: STRESS_PALETTE[label] || ACCENT };
}

function SemiGauge({ value, strokeColor }) {
  const v = Math.min(1, Math.max(0, Number(value) || 0));
  const r = 52;
  const cx = 60;
  const cy = 58;
  const arcLen = Math.PI * r;
  const dash = v * arcLen;
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
  const fgPath = bgPath;
  return (
    <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden>
      <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" strokeLinecap="round" />
      <path
        d={fgPath}
        fill="none"
        stroke={strokeColor || ACCENT}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${arcLen}`}
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text x="60" y="62" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600">
        {v.toFixed(2)}
      </text>
    </svg>
  );
}

const glass = {
  background: 'rgba(255,255,255,0.05)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
};

export default function Weather() {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regionId, setRegionId] = useState('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    let cancelled = false;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    setLoading(true);
    setError(null);
    fetch(API_URL, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (!cancelled) {
          const list = Array.isArray(body) ? body : body?.results || body?.data || [];
          setRaw(list);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return raw.filter((row) => {
      const y = Number(row.year);
      const m = Number(row.month);
      if (y !== Number(year) || m !== Number(month)) return false;
      return regionMatch(regionId, row.latitude);
    });
  }, [raw, year, month, regionId]);

  const stats = useMemo(() => {
    if (!filtered.length) {
      return {
        avgLst: 0,
        avgCwsi: 0,
        minLst: 0,
        maxLst: 0,
        sumPrecip: 0,
        avgEt0: 0,
        avgSoil: 0,
        mainStress: '—',
        mainIcon: '☀️',
        stressColor: ACCENT,
        dominantPct: 0,
        representativeLabel: 'pas de stress',
        precipBars: [],
      };
    }
    const lsts = filtered.map((r) => Number(r.LST)).filter((n) => !Number.isNaN(n));
    const cwsis = filtered.map((r) => Number(r.CWSI_predit)).filter((n) => !Number.isNaN(n));
    const precs = filtered.map((r) => Number(r.Precipitation)).filter((n) => !Number.isNaN(n));
    const et0s = filtered.map((r) => Number(r.ET0)).filter((n) => !Number.isNaN(n));
    const soils = filtered.map((r) => Number(r.SoilMoisture)).filter((n) => !Number.isNaN(n));

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const avgLst = avg(lsts);
    const avgCwsi = avg(cwsis);
    const minLst = lsts.length ? Math.min(...lsts) : 0;
    const maxLst = lsts.length ? Math.max(...lsts) : 0;
    const sumPrecip = precs.reduce((a, b) => a + b, 0);
    const avgEt0 = avg(et0s);
    const avgSoil = avg(soils);

    const mid = Math.floor(filtered.length / 2);
    const rep = filtered[mid] || filtered[0];
    const representativeLabel = normalizeStressLabel(rep.stress_label);

    const dom = dominantStressStats(filtered);

    const precipBars = [0, 1, 2, 3, 4, 5].map((i) => ({
      name: `${i + 1}`,
      v: Math.max(0, (sumPrecip / 6) * (0.6 + (i % 3) * 0.15)),
    }));

    return {
      avgLst,
      avgCwsi,
      minLst,
      maxLst,
      sumPrecip,
      avgEt0,
      avgSoil,
      mainStress: dom.label,
      mainIcon: iconForStress(dom.label),
      stressColor: dom.color,
      dominantPct: dom.pct,
      representativeLabel,
      precipBars,
    };
  }, [filtered]);

  const lstLineData = useMemo(() => buildLstSegments(stats.avgLst), [stats.avgLst]);

  const weekCards = useMemo(() => {
    const labels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const now = new Date();
    const ref = new Date(year, month - 1, 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    const byDay = {};
    filtered.forEach((row) => {
      const d = parseDay(row);
      if (d == null) return;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(row);
    });

    const start = new Date(ref);
    const dow = start.getDay();
    start.setDate(start.getDate() - dow);

    return labels.map((abbr, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const dayNum = d.getDate();
      const rows = byDay[dayNum] || [];
      const cwsi = rows.length
        ? rows.reduce((s, r) => s + Number(r.CWSI_predit || 0), 0) / rows.length
        : stats.avgCwsi;
      const lbl = rows.length ? normalizeStressLabel(rows[0].stress_label) : normalizeStressLabel(filtered[0]?.stress_label);
      const highlight = isCurrentMonth && d.getTime() === today.getTime();
      return {
        abbr,
        dayNum,
        cwsi: Number.isFinite(cwsi) ? cwsi : 0,
        icon: iconForStress(lbl),
        highlight,
      };
    });
  }, [filtered, year, month, stats.avgCwsi]);

  const soilNote = useMemo(() => {
    const s = stats.avgSoil;
    if (s >= 60) return 'Sol bien hydraté';
    if (s >= 35) return 'Humidité modérée';
    return 'Sol sec';
  }, [stats.avgSoil]);

  const monthTitle = MONTHS_FR.find((m) => m.v === month)?.label || '';
  const subDateStr = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const gaugeColor = colorForStress(stats.representativeLabel, filtered[0]?.stress_couleur);

  if (loading) {
    return (
      <div style={{ ...pageWrap, alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#aaa' }}>Chargement des prédictions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...pageWrap, alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#e31a1c' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={layoutRow}>
        {/* Colonne gauche */}
        <aside style={{ ...col, width: '30%', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...glass, background: BG_CARD, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <label style={labelStyle}>Région</label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                style={selectStyle}
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label style={labelStyle}>Année</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <label style={labelStyle}>Mois</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
                {MONTHS_FR.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 42, lineHeight: 1 }}>{iconForStress(stats.representativeLabel)}</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', marginTop: 8 }}>
                {filtered.length ? `${stats.avgLst.toFixed(1)}°C` : '—'}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>LST moyenne</div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 36,
                  fontWeight: 700,
                  color: ACCENT,
                }}
              >
                CWSI {filtered.length ? stats.avgCwsi.toFixed(3) : '—'}
              </div>
              <div style={{ fontSize: 14, color: '#d1d5db', marginTop: 8 }}>
                {stats.representativeLabel.charAt(0).toUpperCase() + stats.representativeLabel.slice(1)}
              </div>
            </div>
          </div>

          <div style={{ ...glass, background: BG_CARD, padding: 16, flex: 1, minHeight: 220 }}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8 }}>Température</div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={lstLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lst"
                    stroke={ACCENT}
                    strokeWidth={2}
                    dot={{ fill: ACCENT, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            style={{
              ...glass,
              borderRadius: 16,
              overflow: 'hidden',
              minHeight: 140,
              position: 'relative',
              backgroundImage:
                'linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.85) 100%), url(https://images.unsplash.com/photo-1539768942893-daf53e448371?w=800&q=80)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div style={{ padding: 20, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', maxWidth: '90%' }}>
                Explorez la carte du stress hydrique au Maroc
              </div>
              <a
                href="/map"
                style={{
                  display: 'inline-block',
                  marginTop: 14,
                  padding: '10px 20px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  textDecoration: 'none',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                Voir la carte
              </a>
            </div>
          </div>
        </aside>

        {/* Colonne droite */}
        <main style={{ ...col, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <header
            style={{
              ...glass,
              background: BG_CARD,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>
                {monthTitle} {year}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', textTransform: 'capitalize' }}>{subDateStr}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, opacity: 0.85 }} aria-hidden>
                🔔
              </span>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f5a623, #c77b00)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0a0a0a',
                  fontWeight: 700,
                }}
              >
                M
              </div>
            </div>
          </header>

          <div style={{ ...glass, background: BG_CARD, padding: 16 }}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 12 }}>Semaine</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {weekCards.map((w, i) => (
                <div
                  key={i}
                  style={{
                    flex: '1 1 12%',
                    minWidth: 72,
                    maxWidth: 120,
                    ...glass,
                    padding: '12px 8px',
                    textAlign: 'center',
                    border: w.highlight ? `2px solid ${ACCENT}` : glass.border,
                    boxShadow: w.highlight ? `0 0 0 1px ${ACCENT}33` : 'none',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{w.abbr}</div>
                  <div style={{ fontSize: 22, margin: '6px 0' }}>{w.icon}</div>
                  <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>{w.cwsi.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>Aperçu du mois</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14,
              }}
            >
              <MetricCard title="Précipitations" glass={glass} bg={BG_CARD}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                  {filtered.length ? `${stats.sumPrecip.toFixed(1)} mm` : '—'}
                </div>
                <div style={{ height: 100, marginTop: 8 }}>
                  <ResponsiveContainer>
                    <BarChart data={stats.precipBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Bar dataKey="v" radius={[6, 6, 0, 0]} fill={ACCENT} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </MetricCard>

              <MetricCard title="Indice CWSI" glass={glass} bg={BG_CARD}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
                  <SemiGauge value={stats.avgCwsi} strokeColor={gaugeColor} />
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Échelle 0 → 1</div>
              </MetricCard>

              <MetricCard title="Évapotranspiration (ET₀)" glass={glass} bg={BG_CARD}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}>
                  {filtered.length ? stats.avgEt0.toFixed(2) : '—'}
                </div>
                <div style={{ marginTop: 12, fontSize: 22, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span>☀️</span>
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>Référence FAO</span>
                  <span>💧</span>
                </div>
              </MetricCard>

              <MetricCard title="Humidité du sol" glass={glass} bg={BG_CARD}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  {filtered.length ? `${stats.avgSoil.toFixed(1)} %` : '—'}
                </div>
                <div style={{ marginTop: 8, fontSize: 22 }}>💧</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{soilNote}</div>
              </MetricCard>

              <MetricCard title="LST min / max" glass={glass} bg={BG_CARD}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                  {filtered.length ? `${stats.minLst.toFixed(1)}° / ${stats.maxLst.toFixed(1)}°` : '—'}
                </div>
                <div style={{ marginTop: 10, fontSize: 26 }}>🌡️</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Sur la période filtrée</div>
              </MetricCard>

              <MetricCard title="Stress dominant" glass={glass} bg={BG_CARD}>
                <div style={{ fontSize: 18, fontWeight: 700, color: stats.stressColor }}>
                  {filtered.length ? stats.mainStress : '—'}
                </div>
                <div style={{ marginTop: 8, fontSize: 28 }}>{stats.mainIcon}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
                  {filtered.length ? `${stats.dominantPct}% du mois` : '—'}
                </div>
              </MetricCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, children, glass: g, bg }) {
  return (
    <div style={{ ...g, background: bg, padding: 16, minHeight: 160 }}>
      <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

const pageWrap = {
  minHeight: '100vh',
  background: BG_PAGE,
  color: '#fff',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  padding: 20,
  boxSizing: 'border-box',
};

const layoutRow = {
  display: 'flex',
  gap: 20,
  alignItems: 'stretch',
  maxWidth: 1400,
  margin: '0 auto',
  flexWrap: 'wrap',
};

const col = {
  boxSizing: 'border-box',
};

const labelStyle = { fontSize: 12, color: '#9ca3af' };

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(0,0,0,0.35)',
  color: '#fff',
  fontSize: 14,
};

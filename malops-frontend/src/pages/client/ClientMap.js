import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { apiUsers } from '../../api/axios';
import { Upload, Loader2, MapPin, RefreshCw, Info, CheckCircle2, Globe } from 'lucide-react';

/* ── fix icônes Leaflet ─────────────────────────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

/* ── Palette stress communes ────────────────────────────────────────────── */
const STRESS_COLORS = {
  0: { fill: '#22c55e', label: 'Normal',   border: '#16a34a' },
  1: { fill: '#facc15', label: 'Faible',   border: '#ca8a04' },
  2: { fill: '#f97316', label: 'Modéré',   border: '#ea580c' },
  3: { fill: '#ef4444', label: 'Élevé',    border: '#dc2626' },
};

const CWSI_COLORS = [
  { max: 0.2,  fill: '#22c55e', label: 'Pas de stress (< 0.2)',   border: '#16a34a' },
  { max: 0.4,  fill: '#a3e635', label: 'Stress léger (0.2–0.4)',  border: '#65a30d' },
  { max: 0.6,  fill: '#f97316', label: 'Stress modéré (0.4–0.6)', border: '#ea580c' },
  { max: 0.8,  fill: '#ef4444', label: 'Stress sévère (0.6–0.8)', border: '#dc2626' },
  { max: 99,   fill: '#7f1d1d', label: 'Stress extrême (> 0.8)',  border: '#450a0a' },
];

function cwsiToColor(cwsi) {
  for (const c of CWSI_COLORS) {
    if (cwsi < c.max) return c;
  }
  return CWSI_COLORS[CWSI_COLORS.length - 1];
}

/* ── Palette décorative (première ouverture, aucune donnée) ─────────────── */
const DECORATIVE_PALETTE = [
  { fill: '#6366f1', border: '#4338ca' }, // indigo
  { fill: '#0ea5e9', border: '#0284c7' }, // sky
  { fill: '#10b981', border: '#059669' }, // emerald
  { fill: '#f59e0b', border: '#d97706' }, // amber
  { fill: '#8b5cf6', border: '#7c3aed' }, // violet
  { fill: '#ec4899', border: '#db2777' }, // pink
  { fill: '#14b8a6', border: '#0d9488' }, // teal
  { fill: '#f97316', border: '#ea580c' }, // orange
  { fill: '#84cc16', border: '#65a30d' }, // lime
  { fill: '#06b6d4', border: '#0891b2' }, // cyan
  { fill: '#a855f7', border: '#9333ea' }, // purple
  { fill: '#fb7185', border: '#e11d48' }, // rose
];

function decorativeColor(name) {
  let h = 0;
  for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DECORATIVE_PALETTE[h % DECORATIVE_PALETTE.length];
}

/* ── Palette choroplèthe régions (0–1 normalisé) ────────────────────────── */
const CHOROPLETH_LEVELS = [
  { max: 0.25, fill: '#2ecc71', label: 'Faible (0–25%)',     border: '#27ae60' },
  { max: 0.50, fill: '#f1c40f', label: 'Modéré (25–50%)',    border: '#d4ac0d' },
  { max: 0.75, fill: '#e67e22', label: 'Élevé (50–75%)',     border: '#ca6f1e' },
  { max: 1.01, fill: '#e74c3c', label: 'Critique (75–100%)', border: '#c0392b' },
];

function getChoroplethColor(value, isPercent) {
  const normalized = isPercent ? value / 100 : value;
  for (const level of CHOROPLETH_LEVELS) {
    if (normalized < level.max) return level;
  }
  return CHOROPLETH_LEVELS[CHOROPLETH_LEVELS.length - 1];
}

/* ── Normalisation des noms de régions ──────────────────────────────────── */
function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const REGION_ALIASES = {
  'casablanca settat':           'Casablanca-Settat',
  'casa settat':                 'Casablanca-Settat',
  'marrakech safi':              'Marrakech-Safi',
  'tanger tetouan al hoceima':   'Tangier-Tetouan-Al Hoceima',
  'tangier tetouan al hoceima':  'Tangier-Tetouan-Al Hoceima',
  'tanger tetouan':              'Tangier-Tetouan-Al Hoceima',
  'rabat sale kenitra':          'Rabat-Salé-Kenitra',
  'rabat sale':                  'Rabat-Salé-Kenitra',
  'fez meknes':                  'Fez-Meknes',
  'fes meknes':                  'Fez-Meknes',
  'beni mellal khenifra':        'Béni Mellal-Khénifra',
  'souss massa':                 'Souss-Massa',
  'draa tafilalet':              'Drâa-Tafilalet',
  'guelmim oued noun':           'Guelmim-Oued Noun',
  'laayoune sakia el hamra':     'Laâyoune-Sakia El Hamra',
  'dakhla oued ed dahab':        'Dakhla-Oued Ed-Dahab',
  'oriental':                    'Oriental',
};

function matchRegionName(csvName, geoLookup) {
  const n = normalizeStr(csvName);
  if (geoLookup[n]) return geoLookup[n];
  if (REGION_ALIASES[n]) return REGION_ALIASES[n];
  for (const [key, canonical] of Object.entries(geoLookup)) {
    if (key.includes(n) || n.includes(key)) return canonical;
  }
  return null;
}

/* ── Parsing CSV côté client ────────────────────────────────────────────── */
function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

function parseCsvForRegions(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 3) return null;

  const header = parseCsvLine(lines[0]);

  /* Détection colonne région : insensible à la casse ET aux accents */
  const REGION_KEYS = ['region', 'regions', 'nom_region', 'region_name', 'zone_region'];
  const regionIdx = header.findIndex(h => {
    const n = normalizeStr(h);
    return REGION_KEYS.some(k => n === k || n.startsWith('region'));
  });
  if (regionIdx === -1) return null;

  const stressPriority = ['stress_hydrique', 'water_stress', 'cwsi', 'indice_stress', 'stress'];
  let stressIdx = -1;
  for (const key of stressPriority) {
    stressIdx = header.findIndex(h => normalizeStr(h).includes(key));
    if (stressIdx !== -1) break;
  }
  if (stressIdx === -1) return null;

  const acc = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const region = cols[regionIdx];
    const val = parseFloat(cols[stressIdx]);
    if (!region || isNaN(val)) continue;
    if (!acc[region]) acc[region] = { sum: 0, n: 0 };
    acc[region].sum += val;
    acc[region].n++;
  }

  if (Object.keys(acc).length < 2) return null;

  const regions = {};
  for (const [name, { sum, n }] of Object.entries(acc)) {
    regions[name] = sum / n;
  }
  return { stressColumn: header[stressIdx], regions };
}

/* ── FitBounds ──────────────────────────────────────────────────────────── */
function FitBounds({ geojson }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson) return;
    try {
      const layer = L.geoJSON(geojson);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch {}
  }, [geojson, map]);
  return null;
}

/* ── Légende ────────────────────────────────────────────────────────────── */
function Legend({ mode, choroplethView }) {
  let items;
  if (choroplethView) {
    items = [
      ...CHOROPLETH_LEVELS,
      { fill: '#bdc3c7', label: 'Données manquantes', border: '#95a5a6' },
    ];
  } else {
    items = mode === 'cwsi' ? CWSI_COLORS : Object.values(STRESS_COLORS);
  }
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: 12, zIndex: 1000,
      background: 'white', borderRadius: 8, padding: '10px 14px',
      boxShadow: '0 2px 12px rgba(0,0,0,.15)', minWidth: 190,
    }}>
      <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#374151', marginBottom: 6 }}>
        Niveau de stress hydrique
      </div>
      {items.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: c.fill,
            border: `1px solid ${c.border}`, flexShrink: 0 }}/>
          <span style={{ fontSize: '.75rem', color: '#374151' }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Composant principal ────────────────────────────────────────────────── */
export default function ClientMap() {

  /* ── États communes (existants) ── */
  const [geojson,           setGeojson]           = useState(null);
  const [geojsonError,      setGeojsonError]       = useState(false);
  const [stressMap,         setStressMap]          = useState({});
  const [mode,              setMode]               = useState('default');
  const [uploading,         setUploading]          = useState(false);
  const [predicting,        setPredicting]         = useState(false);
  const [result,            setResult]             = useState(null);
  const [error,             setError]              = useState('');
  const [tooltip,           setTooltip]            = useState(null);
  const [selectedMonth,     setSelectedMonth]      = useState(null);
  const [breakdownByMonth,  setBreakdownByMonth]   = useState({});
  const [breakdownAll,      setBreakdownAll]       = useState([]);

  /* ── États choroplèthe ── */
  const [rawRegionData,        setRawRegionData]       = useState(null);
  const [regionGeojson,        setRegionGeojson]       = useState(null);
  const [regionStressMap,      setRegionStressMap]     = useState({});
  const [regionStressMapAnnual,setRegionStressMapAnnual] = useState({});
  const [hasChoroplethData,    setHasChoroplethData]   = useState(false);
  const [choroplethView,       setChoroplethView]      = useState(true);
  const [regionTooltip,        setRegionTooltip]       = useState(null);

  const fileRef = useRef(null);
  const mapRef  = useRef(null);
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  /* Détruire proprement la carte Leaflet au démontage pour éviter l'erreur
     _leaflet_pos sur les animations de zoom qui se terminent après unmount */
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  /* Charger GeoJSON communes */
  useEffect(() => {
    fetch('/eljadida-communes.geojson')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setGeojson)
      .catch(() => setGeojsonError(true));
  }, []);

  /* Charger GeoJSON régions Maroc au montage — toujours disponible */
  useEffect(() => {
    fetch('/maroc-regions.geojson')
      .then(r => { if (!r.ok) throw new Error('maroc-regions.geojson 404'); return r.json(); })
      .then(setRegionGeojson)
      .catch(console.error);
  }, []);

  /* Construire regionStressMap dès que les deux sources sont disponibles */
  useEffect(() => {
    if (!rawRegionData || !regionGeojson) return;

    const lookup = {};
    for (const f of regionGeojson.features) {
      lookup[normalizeStr(f.properties.name)] = f.properties.name;
    }

    const values = Object.values(rawRegionData.regions);
    const maxVal = Math.max(...values);
    const isPercent = maxVal > 1;

    const newMap = {};
    for (const [csvName, meanVal] of Object.entries(rawRegionData.regions)) {
      const canonical = matchRegionName(csvName, lookup);
      if (canonical) {
        newMap[canonical] = {
          value:        meanVal,
          displayValue: isPercent ? meanVal.toFixed(1) : (meanVal * 100).toFixed(1),
          color:        getChoroplethColor(meanVal, isPercent),
        };
      }
    }

    if (Object.keys(newMap).length > 0) {
      setRegionStressMap(newMap);
      setRegionStressMapAnnual(newMap);
      setHasChoroplethData(true);
      setChoroplethView(true);
    }
  }, [rawRegionData, regionGeojson]);

  /* Style polygones communes */
  const styleFeature = useCallback((feature) => {
    const name = feature?.properties?.commune || '';
    if (mode === 'cwsi' && stressMap[name]) {
      const { color } = stressMap[name];
      return { fillColor: color.fill, color: color.border, weight: 1.5,
               fillOpacity: 0.75, opacity: 1 };
    }
    const s = feature?.properties?.stress_hydrique ?? 0;
    const c = STRESS_COLORS[Math.min(s, 3)] || STRESS_COLORS[0];
    return { fillColor: c.fill, color: c.border, weight: 1,
             fillOpacity: 0.55, opacity: 1 };
  }, [mode, stressMap]);

  /* Style polygones régions */
  const styleRegion = useCallback((feature) => {
    const name = feature?.properties?.name || '';
    const data = regionStressMap[name];
    if (data) {
      return { fillColor: data.color.fill, color: data.color.border,
               weight: 1.5, fillOpacity: 0.75, opacity: 1 };
    }
    /* Mode décoratif : couleur unique par région, aucune donnée chargée */
    const dec = decorativeColor(name);
    return { fillColor: dec.fill, color: dec.border,
             weight: 2, fillOpacity: 0.6, opacity: 1 };
  }, [regionStressMap]);

  /* Interactions communes */
  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties || {};
    const name  = props.commune || '?';
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 3, fillOpacity: 0.9 });
        const stress = stressMap[name];
        setTooltip({
          commune: name,
          cwsi:    stress?.cwsi?.toFixed(3) ?? '—',
          niveau:  stress ? cwsiToColor(stress.cwsi).label : props.niveau_stress || '—',
          ndvi:    props.NDVI ? Math.round(props.NDVI) : '—',
          lst:     props.LST  ? props.LST.toFixed(1) : '—',
        });
      },
      mouseout: (e) => {
        e.target.setStyle(styleFeature(feature));
        setTooltip(null);
      },
    });
  }, [stressMap, styleFeature]);

  /* Interactions régions */
  const onEachRegion = useCallback((feature, layer) => {
    const name = feature.properties?.name || '?';
    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 3, fillOpacity: 0.9 });
        const data = regionStressMap[name];
        setRegionTooltip({
          region: name,
          value:  data?.displayValue ?? null,
          label:  data?.color?.label ?? 'Données manquantes',
          color:  data?.color?.fill  ?? '#bdc3c7',
        });
      },
      mouseout: (e) => {
        e.target.setStyle(styleRegion(feature));
        setRegionTooltip(null);
      },
    });
  }, [regionStressMap, styleRegion]);

  /* Construire stressMap communes depuis breakdown */
  const buildStressMap = useCallback((breakdown) => {
    if (!breakdown || breakdown.length === 0) return;
    const map = {};
    for (const b of breakdown) {
      const cwsi = b.mean_cwsi ?? 0;
      map[b.name] = { cwsi, color: cwsiToColor(cwsi) };
    }
    setStressMap(map);
    setMode('cwsi');
  }, []);

  /* Construire regionStressMap depuis un breakdown (pour le filtre mois en vue Maroc) */
  const buildRegionMapFromBreakdown = useCallback((breakdown) => {
    if (!breakdown || breakdown.length === 0 || !regionGeojson) return null;
    const lookup = {};
    for (const f of regionGeojson.features) {
      lookup[normalizeStr(f.properties.name)] = f.properties.name;
    }
    const acc = {};
    for (const b of breakdown) {
      if (!b.name || b.mean_cwsi === undefined) continue;
      const canonical = matchRegionName(b.name, lookup);
      if (!canonical) continue;
      if (!acc[canonical]) acc[canonical] = { sum: 0, n: 0 };
      acc[canonical].sum += b.mean_cwsi;
      acc[canonical].n++;
    }
    if (Object.keys(acc).length === 0) return null;
    const newMap = {};
    for (const [canonical, { sum, n }] of Object.entries(acc)) {
      const meanVal = sum / n;
      newMap[canonical] = {
        value:        meanVal,
        displayValue: (meanVal * 100).toFixed(1),
        color:        getChoroplethColor(meanVal, false),
      };
    }
    return newMap;
  }, [regionGeojson]);

  /* Changement de mois */
  const handleMonthChange = useCallback((month) => {
    setSelectedMonth(month);
    if (month === null) {
      buildStressMap(breakdownAll);
      if (Object.keys(regionStressMapAnnual).length > 0) {
        setRegionStressMap(regionStressMapAnnual);
      }
    } else {
      const bd = breakdownByMonth[month] || [];
      /* Mise à jour vue communes */
      if (bd.length > 0) buildStressMap(bd);
      else buildStressMap(breakdownAll);
      /* Mise à jour vue Maroc régions */
      const monthRegionMap = bd.length > 0 ? buildRegionMapFromBreakdown(bd) : null;
      if (monthRegionMap && Object.keys(monthRegionMap).length > 0) {
        setRegionStressMap(monthRegionMap);
      } else if (Object.keys(regionStressMapAnnual).length > 0) {
        setRegionStressMap(regionStressMapAnnual);
      }
    }
  }, [breakdownAll, breakdownByMonth, buildStressMap, buildRegionMapFromBreakdown, regionStressMapAnnual]);

  /* Upload + prédiction */
  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Veuillez sélectionner un fichier CSV.');
      return;
    }
    setError('');
    setUploading(true);
    setResult(null);
    setSelectedMonth(null);
    setBreakdownByMonth({});
    setBreakdownAll([]);

    /* Reset choroplèthe */
    setHasChoroplethData(false);
    setChoroplethView(true);
    setRegionStressMap({});
    setRegionStressMapAnnual({});
    setRawRegionData(null);
    setRegionTooltip(null);

    /* Détection région côté client */
    let parsedRegions = null;
    try {
      const text = await file.text();
      parsedRegions = parseCsvForRegions(text);
      if (parsedRegions) setRawRegionData(parsedRegions);
    } catch {}

    /* Appel API existant */
    const fd = new FormData();
    fd.append('file', file);
    try {
      setPredicting(true);
      const r = await apiUsers.post('/datasets/predict-upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = r.data;
      setResult(data);

      const bdByMonth = data.breakdown_by_month || {};
      setBreakdownByMonth(bdByMonth);

      const breakdown = data.breakdown || [];
      setBreakdownAll(breakdown);
      if (breakdown.length > 0) {
        buildStressMap(breakdown);

        /* Si le parsing client n'a pas trouvé de colonne stress/cwsi dans le CSV,
           utiliser les résultats API (breakdown) pour colorier la carte Maroc */
        if (!parsedRegions && regionGeojson && breakdown.length >= 2) {
          const lookup = {};
          for (const f of regionGeojson.features) {
            lookup[normalizeStr(f.properties.name)] = f.properties.name;
          }
          const apiRegions = {};
          for (const b of breakdown) {
            if (!b.name || b.mean_cwsi === undefined) continue;
            const canonical = matchRegionName(b.name, lookup);
            if (canonical) apiRegions[canonical] = b.mean_cwsi;
          }
          if (Object.keys(apiRegions).length >= 2) {
            setRawRegionData({ stressColumn: 'CWSI', regions: apiRegions });
          }
        }
      } else if ((data.geo_sample || []).length > 0) {
        const acc = {};
        for (const pt of data.geo_sample) {
          const zone = pt.zone || pt.commune || pt.region;
          if (!zone) continue;
          if (!acc[zone]) acc[zone] = { sum: 0, n: 0 };
          acc[zone].sum += pt.cwsi ?? 0;
          acc[zone].n   += 1;
        }
        const map = {};
        for (const [name, v] of Object.entries(acc)) {
          const cwsi = v.sum / v.n;
          map[name] = { cwsi, color: cwsiToColor(cwsi) };
        }
        if (Object.keys(map).length > 0) {
          setStressMap(map);
          setMode('cwsi');
        }
      } else if (data.mean_cwsi !== undefined) {
        const color = cwsiToColor(data.mean_cwsi);
        if (geojson) {
          const map = {};
          for (const f of geojson.features) {
            const name = f.properties?.commune;
            if (name) map[name] = { cwsi: data.mean_cwsi, color };
          }
          setStressMap(map);
          setMode('cwsi');
        }
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.userMessage || 'Erreur lors de la prédiction.');
    } finally {
      setUploading(false);
      setPredicting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson, buildStressMap, regionGeojson]);

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStressMap({});
    setMode('default');
    setResult(null);
    setError('');
    setSelectedMonth(null);
    setBreakdownByMonth({});
    setBreakdownAll([]);
    setHasChoroplethData(false);
    setChoroplethView(true);
    setRegionStressMap({});
    setRegionStressMapAnnual({});
    setRawRegionData(null);
    setRegionTooltip(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Barre supérieure ── */}
      <div style={{
        padding: '12px 20px', background: 'white', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {choroplethView
            ? <Globe size={18} color="#2d6a4f"/>
            : <MapPin size={18} color="#2d6a4f"/>}
          <span style={{ fontWeight: 700, fontSize: '.95rem', color: '#111827' }}>
            {choroplethView
              ? 'Carte Choroplèthe — Maroc par région'
              : 'Carte Stress Hydrique — El Jadida'}
          </span>
        </div>

        {/* Zone upload */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 14px', border: '1.5px dashed #2d6a4f',
            borderRadius: 8, cursor: 'pointer', background: '#f0fdf4',
            transition: 'all .2s', flex: 1, maxWidth: 360,
          }}>
          {uploading || predicting
            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#2d6a4f' }}/>
            : <Upload size={16} color="#2d6a4f"/>}
          <span style={{ fontSize: '.85rem', color: '#166534', fontWeight: 600 }}>
            {uploading ? 'Upload…' : predicting ? 'Prédiction…'
              : 'Importer un CSV pour colorier les communes'}
          </span>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }}/>
        </div>

        {/* Toggle choroplèthe — visible dès que le GeoJSON Maroc est chargé */}
        {regionGeojson && (
          <button
            onClick={() => setChoroplethView(v => !v)}
            title={choroplethView ? 'Revenir à la vue El Jadida' : 'Afficher la carte Maroc par région'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              background:  choroplethView ? '#2d6a4f' : 'white',
              border:      `1px solid ${choroplethView ? '#2d6a4f' : '#d1d5db'}`,
              borderRadius: 6, cursor: 'pointer', fontSize: '.82rem',
              color:       choroplethView ? 'white' : '#374151',
              fontWeight: 600, transition: 'all .2s',
            }}>
            <Globe size={13}/>
            {choroplethView ? 'Vue El Jadida' : 'Vue Maroc'}
          </button>
        )}

        {(mode === 'cwsi' || Object.keys(regionStressMap).length > 0) && (
          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', background: 'white', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: 'pointer', fontSize: '.82rem', color: '#374151',
            fontWeight: 600,
          }}>
            <RefreshCw size={13}/>Réinitialiser
          </button>
        )}

        {error && (
          <span style={{ fontSize: '.82rem', color: '#991b1b', fontWeight: 600 }}>
            ❌ {error}
          </span>
        )}

        {/* Résumé résultats */}
        {choroplethView && Object.keys(regionStressMap).length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <CheckCircle2 size={15} color="#16a34a"/>
            <span style={{ fontSize: '.82rem', color: '#166534', fontWeight: 600 }}>
              {Object.keys(regionStressMap).length} régions colorées
              {rawRegionData?.stressColumn ? ` · ${rawRegionData.stressColumn}` : ''}
            </span>
          </div>
        )}
        {!choroplethView && result && mode === 'cwsi' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <CheckCircle2 size={15} color="#16a34a"/>
            <span style={{ fontSize: '.82rem', color: '#166534', fontWeight: 600 }}>
              {Object.keys(stressMap).length} communes colorées ·
              CWSI moyen : {result.mean_cwsi?.toFixed(3)}
            </span>
          </div>
        )}
      </div>

      {/* ── Filtre mois (vue communes ET vue Maroc régions) ── */}
      {result && Object.keys(breakdownByMonth).length > 0 && (
        <div style={{
          padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#374151', flexShrink: 0 }}>
            Mois :
          </span>
          <button
            onClick={() => handleMonthChange(null)}
            style={{
              padding: '4px 10px', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
              border: '1.5px solid',
              borderColor: selectedMonth === null ? '#2d6a4f' : '#d1d5db',
              background:  selectedMonth === null ? '#2d6a4f' : 'white',
              color:       selectedMonth === null ? 'white'   : '#374151',
              cursor: 'pointer',
            }}>
            Annuel
          </button>
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const hasData = !!breakdownByMonth[m];
            const active  = selectedMonth === m;
            return (
              <button
                key={m}
                disabled={!hasData}
                onClick={() => handleMonthChange(m)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: '.78rem', fontWeight: 600,
                  border: '1.5px solid',
                  borderColor: active ? '#2d6a4f' : hasData ? '#d1d5db' : '#f3f4f6',
                  background:  active ? '#2d6a4f' : hasData ? 'white'   : '#f9fafb',
                  color:       active ? 'white'   : hasData ? '#374151' : '#d1d5db',
                  cursor:      hasData ? 'pointer' : 'not-allowed',
                }}>
                {label}
              </button>
            );
          })}
          {selectedMonth && (
            <span style={{ fontSize: '.78rem', color: '#6b7280', marginLeft: 4 }}>
              — {MONTHS[selectedMonth - 1]} {result.year || ''}
            </span>
          )}
        </div>
      )}

      {/* ── Corps : carte + panneau résultats ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Carte */}
        <div style={{ flex: 1, position: 'relative' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

          {geojsonError && !choroplethView && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 9, display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: '#fef2f2',
              flexDirection: 'column', gap: 12,
            }}>
              <Info size={32} color="#dc2626"/>
              <p style={{ color: '#991b1b', fontWeight: 600, textAlign: 'center', maxWidth: 400 }}>
                Fichier <code>eljadida-communes.geojson</code> introuvable.<br/>
                Lancez : <code>python3 extract_geojson.py /chemin/vers/carte.html</code>
              </p>
            </div>
          )}

          <MapContainer
            ref={mapRef}
            center={[32.9, -8.5]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}>

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {choroplethView && regionGeojson ? (
              <>
                <FitBounds geojson={regionGeojson}/>
                <GeoJSON
                  key={`regions-${selectedMonth ?? 'all'}-${Object.keys(regionStressMap).length}`}
                  data={regionGeojson}
                  style={styleRegion}
                  onEachFeature={onEachRegion}
                />
              </>
            ) : (
              geojson && (
                <>
                  <FitBounds geojson={geojson}/>
                  <GeoJSON
                    key={`${mode}-${JSON.stringify(Object.keys(stressMap))}`}
                    data={geojson}
                    style={styleFeature}
                    onEachFeature={onEachFeature}
                  />
                </>
              )
            )}
          </MapContainer>

          {/* Légende stress — masquée en mode décoratif */}
          {!(choroplethView && Object.keys(regionStressMap).length === 0) && (
            <Legend mode={mode} choroplethView={choroplethView}/>
          )}

          {/* Overlay décoratif — invitation à importer */}
          {choroplethView && Object.keys(regionStressMap).length === 0 && (
            <div style={{
              position: 'absolute', bottom: 28, left: 12, zIndex: 1000,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
              borderRadius: 10, padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,.12)',
              border: '1px solid rgba(99,102,241,.2)',
              maxWidth: 230,
            }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#4338ca', marginBottom: 5 }}>
                🗺️ Carte du Maroc
              </div>
              <div style={{ fontSize: '.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                Importez un CSV pour visualiser le stress hydrique par région.
              </div>
            </div>
          )}

          {/* Tooltip régions */}
          {choroplethView && regionTooltip && (
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1000,
              background: 'white', borderRadius: 10, padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,.15)', minWidth: 220,
              borderLeft: `3px solid ${regionTooltip.color}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#111827',
                marginBottom: 8 }}>{regionTooltip.region}</div>
              {[
                { label: 'Niveau de stress', val: regionTooltip.label },
                { label: rawRegionData?.stressColumn || 'Valeur', val: regionTooltip.value ? `${regionTooltip.value}%` : '—' },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '.8rem', padding: '3px 0', borderBottom: '1px solid #f3f4f6',
                }}>
                  <span style={{ color: '#6b7280' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{row.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tooltip communes */}
          {!choroplethView && tooltip && (
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 1000,
              background: 'white', borderRadius: 10, padding: '12px 16px',
              boxShadow: '0 4px 20px rgba(0,0,0,.15)', minWidth: 200,
              borderLeft: '3px solid #2d6a4f',
            }}>
              <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#111827',
                marginBottom: 8 }}>{tooltip.commune}</div>
              {[
                { label: 'CWSI moyen',    val: tooltip.cwsi },
                { label: 'Niveau stress', val: tooltip.niveau },
                { label: 'NDVI',          val: tooltip.ndvi },
                { label: 'Temp. (°C)',    val: tooltip.lst },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '.8rem', padding: '3px 0', borderBottom: '1px solid #f3f4f6',
                }}>
                  <span style={{ color: '#6b7280' }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{row.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panneau résultats — vue régions */}
        {choroplethView && Object.keys(regionStressMap).length > 0 && (
          <div style={{
            width: 280, background: 'white', borderLeft: '1px solid #e5e7eb',
            overflowY: 'auto', padding: '16px 14px', flexShrink: 0,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '.9rem', color: '#111827', fontWeight: 700 }}>
              Stress par région
            </h3>
            {Object.entries(regionStressMap)
              .sort(([, a], [, b]) => b.value - a.value)
              .map(([name, { displayValue, color }]) => (
                <div key={name} style={{
                  borderRadius: 7, padding: '8px 10px', marginBottom: 6,
                  background: '#fafafa', border: '1px solid #e5e7eb',
                  borderLeft: `3px solid ${color.fill}`,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 3,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '.78rem', color: '#111827' }}>
                      {name}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '.78rem', color: color.fill,
                      fontFamily: 'monospace' }}>
                      {displayValue}%
                    </span>
                  </div>
                  <div style={{ fontSize: '.7rem', color: '#6b7280' }}>{color.label}</div>
                </div>
              ))}
          </div>
        )}

        {/* Panneau résultats — vue communes */}
        {!choroplethView && result && (
          <div style={{
            width: 280, background: 'white', borderLeft: '1px solid #e5e7eb',
            overflowY: 'auto', padding: '16px 14px', flexShrink: 0,
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '.9rem', color: '#111827', fontWeight: 700 }}>
              Résultats par commune
            </h3>

            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px',
              marginBottom: 12, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '.78rem', color: '#166534', fontWeight: 700,
                marginBottom: 4 }}>Résumé global</div>
              {[
                { l: 'CWSI moyen',  v: result.mean_cwsi?.toFixed(3) },
                { l: '✅ Faible',   v: `${result.faible_pct}%` },
                { l: '⚡ Modéré',  v: `${result.modere_pct}%` },
                { l: '⚠️ Sévère', v: `${result.severe_pct}%` },
                { l: 'Lignes',      v: result.analyzed_rows?.toLocaleString() },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: '.78rem', padding: '2px 0' }}>
                  <span style={{ color: '#374151' }}>{r.l}</span>
                  <span style={{ fontWeight: 700 }}>{r.v}</span>
                </div>
              ))}
            </div>

            {(result.breakdown || [])
              .sort((a, b) => b.mean_cwsi - a.mean_cwsi)
              .map(b => {
                const c = cwsiToColor(b.mean_cwsi);
                return (
                  <div key={b.name} style={{
                    borderRadius: 7, padding: '8px 10px', marginBottom: 6,
                    background: '#fafafa', border: '1px solid #e5e7eb',
                    borderLeft: `3px solid ${c.fill}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#111827' }}>
                        {b.name}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '.8rem', color: c.fill,
                        fontFamily: 'monospace' }}>
                        {b.mean_cwsi.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, fontSize: '.7rem' }}>
                      {[
                        { l: '✅', v: `${b.faible_pct}%` },
                        { l: '⚡', v: `${b.modere_pct}%` },
                        { l: '⚠️', v: `${b.severe_pct}%` },
                      ].map(r => (
                        <span key={r.l} style={{ color: '#6b7280' }}>{r.l} {r.v}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

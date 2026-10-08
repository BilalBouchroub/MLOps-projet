import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
  LayerGroup,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { apiML, apiUsers } from '../api/axios';
import './Map.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const YEARS = [2022, 2023, 2024];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const STRESS_CLASSES = [
  { label: 'Pas de stress', color: '#1a9850', max: 0.2 },
  { label: 'Stress léger', color: '#fee08b', max: 0.4 },
  { label: 'Stress modéré', color: '#fd8d3c', max: 0.6 },
  { label: 'Stress sévère', color: '#e31a1c', max: 0.8 },
  { label: 'Stress extrême', color: '#800026', max: 1.01 },
];

const LAYER_MODES = [
  { id: 'stress', label: 'Stress (CWSI)' },
  { id: 'lst', label: 'Température (LST)' },
  { id: 'precip', label: 'Précipitations' },
  { id: 'ndvi', label: 'NDVI' },
];

function cwsiVal(row) {
  const v = row.CWSI_predit ?? row.CWSI ?? row.cwsi;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function precipVal(row) {
  const v = row.Precipitation ?? row.precipitation ?? row.precip ?? row.PRECIPITATION ?? row.rain ?? row.Rain;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hexStressFromCwsi(cwsi) {
  if (cwsi == null || Number.isNaN(cwsi)) return '#6b7280';
  if (cwsi < 0.2) return '#1a9850';
  if (cwsi < 0.4) return '#fee08b';
  if (cwsi < 0.6) return '#fd8d3c';
  if (cwsi < 0.8) return '#e31a1c';
  return '#800026';
}

function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16);
  const b = parseInt(c2.slice(1), 16);
  const r1 = (a >> 16) & 255;
  const g1 = (a >> 8) & 255;
  const b1 = a & 255;
  const r2 = (b >> 16) & 255;
  const g2 = (b >> 8) & 255;
  const b2 = b & 255;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function colorForLST(lst) {
  if (!Number.isFinite(lst)) return '#6b7280';
  const t = Math.min(1, Math.max(0, (lst + 5) / 55));
  return lerpColor('#3b82f6', '#ef4444', t);
}

function colorForPrecip(mm) {
  if (!Number.isFinite(mm)) return '#6b7280';
  const t = Math.min(1, Math.max(0, mm / 150));
  return lerpColor('#1e293b', '#38bdf8', t);
}

function colorForNDVI(ndvi) {
  if (!Number.isFinite(ndvi)) return '#6b7280';
  const t = Math.min(1, Math.max(0, (ndvi + 1) / 2));
  return lerpColor('#92400e', '#22c55e', t);
}

function colorForPoint(row, layerMode) {
  switch (layerMode) {
    case 'lst':
      return colorForLST(Number(row.LST));
    case 'precip':
      return colorForPrecip(precipVal(row));
    case 'ndvi':
      return colorForNDVI(Number(row.NDVI));
    default:
      return hexStressFromCwsi(cwsiVal(row));
  }
}

function normalizeApiRow(r) {
  const lat = Number(r.latitude ?? r.lat);
  const lng = Number(r.longitude ?? r.lng ?? r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    ...r,
    latitude: lat,
    longitude: lng,
    _source: 'api',
  };
}

function pickHeader(headers, aliases) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'Fichier vide ou une seule ligne.' };
  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ''));
  const iLat = pickHeader(headers, ['latitude', 'lat']);
  const iLng = pickHeader(headers, ['longitude', 'lng', 'lon', 'long']);
  if (iLat < 0 || iLng < 0) {
    return { rows: [], error: 'Colonnes latitude / longitude introuvables dans le CSV.' };
  }
  const idx = (name) => pickHeader(headers, [name]);

  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    const lat = Number(cells[iLat]);
    const lng = Number(cells[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const get = (names) => {
      const i = pickHeader(headers, names);
      if (i < 0) return undefined;
      const v = cells[i];
      if (v === '' || v === undefined) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    };

    const row = {
      latitude: lat,
      longitude: lng,
      year: get(['year', 'annee', 'année']) ?? new Date().getFullYear(),
      month: get(['month', 'mois']) ?? 1,
      NDVI: get(['ndvi']),
      NDWI: get(['ndwi']),
      MSI: get(['msi']),
      LST: get(['lst', 'LST']),
      Precipitation: get(['precipitation', 'precip', 'rain', 'pluie']),
      SoilMoisture: get(['soilmoisture', 'soil_moisture', 'humidite']),
      ET0: get(['et0', 'ET0']),
      CWSI_predit: get(['cwsi_predit', 'CWSI_predit', 'cwsi', 'CWSI']),
      stress_label: (() => {
        const is = idx('stress_label');
        const ist = idx('stress');
        if (is >= 0 && cells[is]) return cells[is];
        if (ist >= 0 && cells[ist]) return cells[ist];
        return '';
      })(),
      _source: 'csv',
    };
    rows.push(row);
  }
  return { rows, error: rows.length ? null : 'Aucune ligne valide.' };
}

function samplePoints(arr, maxN) {
  if (arr.length <= maxN) return arr;
  const step = Math.ceil(arr.length / maxN);
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 8);
      return;
    }
    const b = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
    if (b.isValid()) map.fitBounds(b.pad(0.08), { maxZoom: 10 });
  }, [map, points]);
  return null;
}

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function posEq(a, b) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

export default function Map() {
  const [tab, setTab] = useState('carte');
  const [apiRows, setApiRows] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvMsg, setCsvMsg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [yearFilter, setYearFilter] = useState('all');
  const [monthIndex, setMonthIndex] = useState(0);
  const [layerMode, setLayerMode] = useState('stress');
  const [zoneBlend, setZoneBlend] = useState(true);
  const [playing, setPlaying]     = useState(false);
  const [myProject, setMyProject] = useState(null);

  const [clickedPos, setClickedPos] = useState(null);
  const [features, setFeatures] = useState({
    NDVI: 0.5,
    NDWI: 0.1,
    MSI: 2.0,
    LST: 35.0,
    Precipitation: 50,
    SoilMoisture: 0.3,
    ET0: 5.0,
  });
  const [predYear, setPredYear] = useState(2024);
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(false);

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
      try {
        const params = projectName ? { project: projectName } : {};
        const res = await apiML.get('/data/predictions', { params });
        if (!cancel) {
          const body = res.data;
          const list = Array.isArray(body) ? body : body?.data || body?.results || [];
          setApiRows(list.map(normalizeApiRow).filter(Boolean));
          setLoadError(null);
        }
      } catch (e) {
        if (!cancel) setLoadError(e?.message || 'API indisponible');
      }
    })();
    return () => { cancel = true; };
  }, []);

  const monthFilterActive = monthIndex > 0;

  const mapPoints = useMemo(() => {
    const merged = [...apiRows, ...csvRows];
    return merged.filter((r) => {
      if (yearFilter !== 'all' && Number(r.year) !== Number(yearFilter)) return false;
      if (monthFilterActive && Number(r.month) !== monthIndex) return false;
      return true;
    });
  }, [apiRows, csvRows, yearFilter, monthIndex, monthFilterActive]);

  const displayPoints = useMemo(() => samplePoints(mapPoints, 2800), [mapPoints]);

  const onCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { rows, error } = parseCSV(String(reader.result || ''));
      if (error) {
        setCsvRows([]);
        setCsvMsg(`Erreur : ${error}`);
        return;
      }
      setCsvRows(rows);
      setCsvMsg(`${rows.length} point(s) importé(s) depuis le CSV.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleFeatureChange = (e) => {
    setFeatures((f) => ({ ...f, [e.target.name]: parseFloat(e.target.value) || 0 }));
  };

  const handlePredict = async (ev) => {
    ev.preventDefault();
    if (!clickedPos) {
      alert('Cliquez sur la carte pour choisir une position.');
      return;
    }
    setPredLoading(true);
    try {
      const payload = { ...features, year: predYear, latitude: clickedPos[0], longitude: clickedPos[1] };
      const response = await apiML.post('/predict', payload);
      setPrediction({
        ...response.data,
        position: [...clickedPos],
        year: predYear,
      });
    } catch (err) {
      alert('Erreur : ' + (err.response?.data?.detail || err.message));
    } finally {
      setPredLoading(false);
    }
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setMonthIndex((m) => (m >= 12 ? 0 : m + 1));
    }, 900);
    return () => clearInterval(id);
  }, [playing]);

  const legendContent = useMemo(() => {
    if (layerMode === 'stress') {
      return (
        <>
          <h4>Légende — stress hydrique</h4>
          {STRESS_CLASSES.map((s) => (
            <div className="map-MLOps-legend-item" key={s.label}>
              <span className="map-MLOps-legend-swatch" style={{ background: s.color }} />
              <span>
                {s.label} (&lt; {s.max === 1.01 ? '1' : s.max})
              </span>
            </div>
          ))}
        </>
      );
    }
    if (layerMode === 'lst') {
      return (
        <>
          <h4>Légende — LST (°C)</h4>
          <div className="map-MLOps-legend-gradient" style={{ background: 'linear-gradient(90deg,#3b82f6,#ef4444)' }} />
          <p className="map-MLOps-hint" style={{ margin: 0 }}>
            Bleu = plus froid · Rouge = plus chaud
          </p>
        </>
      );
    }
    if (layerMode === 'precip') {
      return (
        <>
          <h4>Légende — précipitations (mm)</h4>
          <div className="map-MLOps-legend-gradient" style={{ background: 'linear-gradient(90deg,#1e293b,#38bdf8)' }} />
          <p className="map-MLOps-hint" style={{ margin: 0 }}>
            Plus foncé = sec · Bleu = humide (échelle ~0–150 mm)
          </p>
        </>
      );
    }
    return (
      <>
        <h4>Légende — NDVI</h4>
        <div className="map-MLOps-legend-gradient" style={{ background: 'linear-gradient(90deg,#92400e,#22c55e)' }} />
        <p className="map-MLOps-hint" style={{ margin: 0 }}>
          Marron = faible végétation · Vert = forte végétation
        </p>
      </>
    );
  }, [layerMode]);

  // Fond de carte qui change selon la variable sélectionnée
  const baseLayerConfig = useMemo(() => {
    switch (layerMode) {
      case 'lst':
        return {
          key: 'lst',
          url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OSM',
        };
      case 'precip':
        return {
          key: 'precip',
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors, SRTM',
        };
      case 'ndvi':
        return {
          key: 'ndvi',
          url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OSM',
        };
      case 'stress':
      default:
        return {
          key: 'stress',
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OSM',
        };
    }
  }, [layerMode]);

  const radius = zoneBlend ? 16 : 7;
  const fillOpacity = zoneBlend ? 0.42 : 0.85;

  return (
    <div className="map-MLOps">
      <aside className="map-MLOps-sidebar">
        <div className="map-MLOps-sidebar-header">
          <h2>MLOps — Carte</h2>
          <p className="tagline">Stress hydrique au Maroc · couches satellite &amp; séries temporelles</p>
          {myProject && (
            <div style={{
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 7, padding: '0.4rem 0.75rem', marginTop: '0.5rem',
              fontSize: '.78rem', color: 'rgba(255,255,255,0.95)',
            }}>
              <span style={{ fontWeight: 700 }}>Projet : </span>{myProject.name}
              {myProject.clearml_project_name && (
                <span style={{ opacity: 0.8 }}> · {myProject.clearml_project_name}</span>
              )}
            </div>
          )}
        </div>
        <div className="map-MLOps-tabs">
          <button type="button" className={tab === 'carte' ? 'active' : ''} onClick={() => setTab('carte')}>
            Carte &amp; données
          </button>
          <button type="button" className={tab === 'prediction' ? 'active' : ''} onClick={() => setTab('prediction')}>
            Prédiction ponctuelle
          </button>
        </div>
        <div className="map-MLOps-scroll">
          {tab === 'carte' && (
            <>
              <p className="map-MLOps-section-title">Source &amp; temps</p>
              <div className="map-MLOps-field">
                <label>Année affichée</label>
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  <option value="all">Toutes les années</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                <p className="map-MLOps-hint">Filtre les points API + CSV. La frise en bas règle le mois.</p>
              </div>
              <div className="map-MLOps-field">
                <label>Importer un CSV (points)</label>
                <input type="file" accept=".csv,text/csv" onChange={onCSV} />
                <p className="map-MLOps-hint">
                  Colonnes attendues : <strong>latitude</strong>, <strong>longitude</strong> (ou lat/lon). Optionnel : year, month,
                  LST, Precipitation, NDVI, CWSI_predit…
                </p>
                {csvMsg && <div className="map-MLOps-csv-status">{csvMsg}</div>}
              </div>
              {loadError && (
                <div className="map-MLOps-info-banner" style={{ borderColor: 'rgba(239,68,68,0.5)' }}>
                  Données API : {loadError}
                </div>
              )}
              <p className="map-MLOps-section-title">Affichage sur la carte</p>
              <div className="map-MLOps-layer-chips">
                {LAYER_MODES.map((m) => (
                  <button key={m.id} type="button" className={layerMode === m.id ? 'on' : ''} onClick={() => setLayerMode(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="map-MLOps-toggle">
                <input type="checkbox" checked={zoneBlend} onChange={(e) => setZoneBlend(e.target.checked)} />
                Mode « zones » (halos semi-transparents, type carte radar)
              </label>
              <p className="map-MLOps-hint">
                Les couleurs s’adaptent à la couche : stress CWSI, chaleur LST, pluie, végétation NDVI. Vert = peu / pas de
                stress lorsque la couche « Stress » est active.
              </p>
            </>
          )}
          {tab === 'prediction' && (
            <>
              {!clickedPos && <div className="map-MLOps-info-banner">Cliquez sur la carte pour placer le point à prédire.</div>}
              <form className="prediction-form" onSubmit={handlePredict}>
                <div className="form-group">
                  <label>Année de la prédiction</label>
                  <select value={predYear} onChange={(e) => setPredYear(Number(e.target.value))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>NDVI (-1 à 1)</label>
                  <input type="number" step="0.01" min="-1" max="1" name="NDVI" value={features.NDVI} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>NDWI (-1 à 1)</label>
                  <input type="number" step="0.01" min="-1" max="1" name="NDWI" value={features.NDWI} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>MSI (0 à 10)</label>
                  <input type="number" step="0.1" min="0" max="10" name="MSI" value={features.MSI} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>LST (°C)</label>
                  <input type="number" step="0.1" min="-10" max="70" name="LST" value={features.LST} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>Précipitations (mm)</label>
                  <input type="number" step="1" min="0" max="500" name="Precipitation" value={features.Precipitation} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>Humidité du sol (0–1)</label>
                  <input type="number" step="0.01" min="0" max="1" name="SoilMoisture" value={features.SoilMoisture} onChange={handleFeatureChange} required />
                </div>
                <div className="form-group">
                  <label>ET₀</label>
                  <input type="number" step="0.1" min="0" max="20" name="ET0" value={features.ET0} onChange={handleFeatureChange} required />
                </div>
                <button type="submit" className="btn-primary" disabled={predLoading || !clickedPos}>
                  {predLoading ? 'Calcul…' : 'Lancer la prédiction'}
                </button>
              </form>
              {prediction && (
                <div className="prediction-result" style={{ borderTop: `4px solid ${hexStressFromCwsi(prediction.cwsi ?? prediction.CWSI_predit)}` }}>
                  <h3>Résultat</h3>
                  <p>
                    <strong>CWSI :</strong> {Number(prediction.cwsi ?? prediction.CWSI_predit ?? 0).toFixed(3)}
                  </p>
                  <p>
                    <strong>Classe :</strong>{' '}
                    <span className="stress-badge" style={{ backgroundColor: hexStressFromCwsi(prediction.cwsi ?? prediction.CWSI_predit) }}>
                      {prediction.stress_class || prediction.stress_label || '—'}
                    </span>
                  </p>
                  <small style={{ color: 'var(--map-muted)' }}>
                    Année : {prediction.year} · {prediction.model_used ? `Modèle : ${prediction.model_used}` : ''}
                  </small>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <div className={`map-MLOps-main mode-${layerMode}`}>
        <MapContainer center={[31.7, -7.09]} zoom={6} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer key={baseLayerConfig.key} attribution={baseLayerConfig.attribution} url={baseLayerConfig.url} />

          <FitBounds points={displayPoints.length ? displayPoints : [{ latitude: 31.7, longitude: -7.09 }]} />
          <MapClickHandler onClick={setClickedPos} />
          <LayerGroup>
            {displayPoints.map((row, i) => {
              const fill = colorForPoint(row, layerMode);
              return (
                <CircleMarker
                  key={`${row._source}-${i}-${row.latitude}-${row.longitude}-${row.year}-${row.month}`}
                  center={[row.latitude, row.longitude]}
                  radius={radius}
                  pathOptions={{
                    fillColor: fill,
                    fillOpacity,
                    color: fill,
                    weight: zoneBlend ? 0 : 1,
                    opacity: zoneBlend ? 0.35 : 0.95,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180, fontSize: 12 }}>
                      <strong>
                        {row.year} · {MONTHS_FR[Math.min(12, Math.max(1, Number(row.month) || 1)) - 1]}
                      </strong>
                      <br />
                      Lat {row.latitude.toFixed(4)}, Lon {row.longitude.toFixed(4)}
                      <hr style={{ margin: '6px 0' }} />
                      CWSI : {cwsiVal(row) != null ? cwsiVal(row).toFixed(3) : '—'}
                      <br />
                      LST : {Number.isFinite(Number(row.LST)) ? `${Number(row.LST).toFixed(1)} °C` : '—'}
                      <br />
                      Précip. : {precipVal(row).toFixed(1)} mm
                      <br />
                      NDVI : {Number.isFinite(Number(row.NDVI)) ? Number(row.NDVI).toFixed(3) : '—'}
                      <br />
                      {row.stress_label && (
                        <>
                          Stress : {row.stress_label}
                          <br />
                        </>
                      )}
                      <small style={{ opacity: 0.75 }}>Source : {row._source === 'csv' ? 'CSV' : 'API'}</small>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </LayerGroup>
          {clickedPos && (
            <CircleMarker
              center={clickedPos}
              radius={10}
              pathOptions={{
                color: '#4f8ef7',
                fillColor: '#4f8ef7',
                fillOpacity: 0.35,
                weight: 3,
              }}
            >
              {prediction && posEq(prediction.position, clickedPos) && (
                <Popup>
                  <strong>Prédiction</strong>
                  <br />
                  CWSI {Number(prediction.cwsi ?? prediction.CWSI_predit ?? 0).toFixed(3)}
                  <br />
                  {prediction.stress_class || prediction.stress_label}
                </Popup>
              )}
            </CircleMarker>
          )}
        </MapContainer>

        <div className="map-MLOps-topbar">
          <div className="map-MLOps-chip">
            <span>
              <strong>{displayPoints.length}</strong> points affichés
            </span>
            {mapPoints.length > displayPoints.length && (
              <span style={{ color: 'var(--map-muted)', fontSize: 11 }}>(échantillon sur {mapPoints.length})</span>
            )}
          </div>
          <div className="map-MLOps-chip">
            Couche : <strong>{LAYER_MODES.find((l) => l.id === layerMode)?.label}</strong>
          </div>
        </div>

        <div className="map-MLOps-timeline">
          <div className="map-MLOps-timeline-inner">
            <label>
              <span>Mois (frise temporelle)</span>
              <span>{monthIndex === 0 ? 'Tous les mois' : MONTHS_FR[monthIndex - 1]}</span>
            </label>
            <input type="range" min={0} max={12} value={monthIndex} onChange={(e) => setMonthIndex(Number(e.target.value))} />
            <div className="map-MLOps-timeline-actions">
              <button type="button" onClick={() => setPlaying((p) => !p)}>
                {playing ? 'Pause' : 'Lecture'}
              </button>
              <button type="button" onClick={() => setMonthIndex(0)}>
                Tous les mois
              </button>
            </div>
          </div>
        </div>

        <div className="map-MLOps-legend">{legendContent}</div>
      </div>
    </div>
  );
}
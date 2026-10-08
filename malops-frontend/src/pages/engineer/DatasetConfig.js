import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUsers } from '../../api/axios';
import { Play, Save, Trash2, Download, RefreshCw, Loader2, CheckCircle2, XCircle,
  Upload, TrendingUp, BarChart3, Info, MapPin, Database } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ACCENT = '#2d6a4f';

/* ── Shared primitives ─────────────────────────────────────────────────── */
function Card({ title, children, color = ACCENT }) {
  return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb',
      borderLeft:`3px solid ${color}`, marginBottom:'1rem', overflow:'hidden' }}>
      {title && (
        <div style={{ padding:'.6rem 1rem', background:'#fafafa', borderBottom:'1px solid #f3f4f6',
          fontWeight:700, fontSize:'.85rem', color:'#111827' }}>{title}</div>
      )}
      <div style={{ padding:'1rem' }}>{children}</div>
    </div>
  );
}

function Slider({ label, value, min, max, step=1, unit='', onChange }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ marginBottom:'.9rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontWeight:600, fontSize:'.83rem', color:'#374151' }}>{label}</span>
        <span style={{ fontWeight:700, fontSize:'.83rem', color:ACCENT }}>{value}{unit}</span>
      </div>
      <div style={{ position:'relative', height:6, background:'#e5e7eb', borderRadius:20 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:20,
          width:`${pct}%`, background:`linear-gradient(90deg,${ACCENT},#40916c)` }}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position:'absolute', top:-5, left:0, width:'100%', height:16, opacity:0, cursor:'pointer' }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem', color:'#9ca3af', marginTop:2 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function RunStatusBanner({ status, logs, onClose }) {
  if (!status || status === 'idle') return null;
  const isRunning = status === 'running';
  const color = isRunning ? '#1e40af' : status === 'completed' ? '#15803d' : '#991b1b';
  const bg    = isRunning ? '#eff6ff' : status === 'completed' ? '#f0fdf4' : '#fef2f2';
  return (
    <div style={{ background:bg, border:`1px solid ${color}30`, borderRadius:9,
      padding:'.75rem 1rem', marginBottom:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:logs.length?'.5rem':0 }}>
        {isRunning && <Loader2 size={15} style={{ animation:'spin 1s linear infinite', color }}/>}
        {status==='completed' && <CheckCircle2 size={15} color={color}/>}
        {status==='failed'    && <XCircle size={15} color={color}/>}
        <span style={{ fontWeight:700, fontSize:'.85rem', color, flex:1 }}>
          {isRunning ? 'Pipeline en cours d\'exécution…' : status==='completed' ? '✅ Pipeline terminé' : '❌ Échec du pipeline'}
        </span>
        {!isRunning && <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>}
      </div>
      {logs.length > 0 && (
        <div style={{ fontFamily:'monospace', fontSize:'.73rem', color:'#374151',
          background:'rgba(0,0,0,.04)', borderRadius:6, padding:'.5rem .75rem',
          maxHeight:80, overflowY:'auto', lineHeight:1.6 }}>
          {logs.slice(-5).map((l,i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

/* ── Breakdown helpers ──────────────────────────────────────────────────── */
function detectBreakdownType(uploadInfo) {
  if (uploadInfo?.breakdown_type) return uploadInfo.breakdown_type;
  if (uploadInfo?.preview?.length > 0) {
    const cols = Object.keys(uploadInfo.preview[0]);
    if (cols.includes('commune')) return 'commune';
    if (cols.includes('region')) return 'region';
  }
  return 'global';
}

function BreakdownTable({ breakdown, breakdownType }) {
  if (!breakdown?.length) return null;
  const label  = breakdownType === 'commune' ? 'Commune' : 'Région';
  const color  = breakdownType === 'commune' ? '#7c3aed' : '#0891b2';
  const sorted = [...breakdown].sort((a, b) => b.mean_cwsi - a.mean_cwsi);

  return (
    <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e7eb',
      boxShadow:'0 2px 8px rgba(0,0,0,.07)', marginTop:'1rem', overflow:'hidden' }}>
      <div style={{ padding:'.75rem 1.25rem',
        background: breakdownType==='commune' ? '#faf5ff' : '#f0f9ff',
        borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8 }}>
        <MapPin size={15} color={color}/>
        <span style={{ fontWeight:700, fontSize:'.9rem',
          color: breakdownType==='commune' ? '#4c1d95' : '#0c4a6e' }}>
          Détail par {label} — {sorted.length} {label.toLowerCase()}{sorted.length > 1 ? 's' : ''}
        </span>
        <span style={{ fontSize:'.75rem', color:'#9ca3af', marginLeft:'auto' }}>
          Trié par stress décroissant
        </span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
          <thead>
            <tr>
              {[label, 'CWSI moyen', 'Verdict', 'Faible %', 'Modéré %', 'Sévère %'].map(h => (
                <th key={h} style={{ padding:'.5rem .9rem', background:'#f9fafb',
                  borderBottom:'2px solid #e5e7eb', fontWeight:700, color:'#374151',
                  textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ background:i%2===0?'white':'#fafafa',
                borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'.5rem .9rem', fontWeight:700, color:'#111827',
                  whiteSpace:'nowrap' }}>{row.name}</td>
                <td style={{ padding:'.5rem .9rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:64, height:6, background:'#e5e7eb',
                      borderRadius:20, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ height:'100%', borderRadius:20,
                        width:`${Math.min(row.mean_cwsi * 100, 100)}%`,
                        background:row.verdict_color }}/>
                    </div>
                    <span style={{ fontWeight:800, color:row.verdict_color,
                      fontFamily:'monospace', fontSize:'.85rem' }}>
                      {row.mean_cwsi?.toFixed(3)}
                    </span>
                  </div>
                </td>
                <td style={{ padding:'.5rem .9rem' }}>
                  <span style={{ padding:'.18rem .65rem', borderRadius:20, fontSize:'.73rem',
                    fontWeight:700, whiteSpace:'nowrap',
                    background:`${row.verdict_color}18`, color:row.verdict_color,
                    border:`1px solid ${row.verdict_color}40` }}>
                    {row.verdict}
                  </span>
                </td>
                <td style={{ padding:'.5rem .9rem', color:'#16a34a', fontWeight:700 }}>
                  {row.faible_pct}%
                </td>
                <td style={{ padding:'.5rem .9rem', color:'#d97706', fontWeight:700 }}>
                  {row.modere_pct}%
                </td>
                <td style={{ padding:'.5rem .9rem', color:'#dc2626', fontWeight:700 }}>
                  {row.severe_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Upload zone ───────────────────────────────────────────────────────── */
function UploadZone({ onUploadDone, clearmlProject }) {
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [error,      setError]      = useState('');
  const [year,       setYear]       = useState('');
  const fileRef = useRef(null);

  const doUpload = async (file) => {
    setError(''); setUploading(true); setUploadInfo(null);
    const fd = new FormData();
    fd.append('file', file);
    if (year) fd.append('year', year);
    if (clearmlProject) fd.append('clearml_project', clearmlProject);
    try {
      const r = await apiUsers.post('/datasets/upload', fd);
      setUploadInfo(r.data);
      onUploadDone(r.data);
    } catch(e) {
      setError(e.response?.data?.detail || e.userMessage || 'Erreur lors de l\'import');
    } finally { setUploading(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) doUpload(file);
  };

  const REQUIRED = ['NDVI','NDWI','MSI','LST','Precipitation','SoilMoisture','ET0'];

  return (
    <div>
      {/* Year input only */}
      <div style={{ marginBottom:'.9rem', maxWidth:280 }}>
        <label style={{ fontWeight:600, fontSize:'.83rem', color:'#374151', display:'block', marginBottom:5 }}>
          Année du fichier <span style={{ color:'#9ca3af', fontWeight:400 }}>(optionnel)</span>
        </label>
        <input
          type="number" value={year} placeholder="ex: 2025" min={1980} max={2030}
          onChange={e => setYear(e.target.value)}
          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8,
            padding:'.4rem .65rem', fontSize:'.9rem', fontWeight:700, color:ACCENT }}
        />
        <div style={{ fontSize:'.7rem', color:'#9ca3af', marginTop:4 }}>
          Auto-détectée si colonne "year" présente dans le fichier
        </div>
      </div>

      {/* Required columns info */}
      <div style={{ fontSize:'.73rem', color:'#6b7280', background:'#f9fafb', borderRadius:7,
        padding:'.45rem .75rem', marginBottom:'.75rem', border:'1px solid #e5e7eb' }}>
        Colonnes requises : <strong>{REQUIRED.join(', ')}</strong>.
        LST en Kelvin×10 (format brut GEE) sera converti automatiquement.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border:`2px dashed ${dragging ? '#2d6a4f' : '#d1d5db'}`,
          borderRadius:12, padding:'1.75rem', textAlign:'center', cursor:'pointer',
          background: dragging ? '#f0fdf4' : '#fafafa',
          transition:'all .2s',
        }}>
        {uploading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <Loader2 size={28} style={{ animation:'spin 1s linear infinite', color:ACCENT }}/>
            <span style={{ color:'#374151', fontWeight:600 }}>Import en cours…</span>
          </div>
        ) : (
          <>
            <Upload size={28} color={ACCENT}/>
            <p style={{ margin:'.5rem 0 .2rem', fontWeight:700, color:'#374151' }}>
              Glisser-déposer votre fichier CSV
            </p>
            <p style={{ fontSize:'.72rem', color:'#9ca3af', margin:'.25rem 0 0' }}>
              ou cliquer pour sélectionner — Max 200 MB
            </p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv"
          style={{ display:'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) doUpload(f); }}/>
      </div>

      {error && (
        <div style={{ marginTop:'.75rem', padding:'.6rem 1rem', background:'#fef2f2',
          color:'#991b1b', borderRadius:7, fontSize:'.83rem', fontWeight:600 }}>
          ❌ {error}
        </div>
      )}

      {/* Upload result */}
      {uploadInfo && (
        <div style={{ marginTop:'.75rem', background:'#f0fdf4', border:'1px solid #86efac',
          borderRadius:9, padding:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'.6rem' }}>
            <CheckCircle2 size={16} color="#16a34a"/>
            <span style={{ fontWeight:700, color:'#15803d', fontSize:'.9rem' }}>
              {uploadInfo.message}
            </span>
          </div>
          <div style={{ display:'flex', gap:'1.5rem', fontSize:'.8rem', color:'#374151',
            flexWrap:'wrap', marginBottom:'.6rem' }}>
            <span>📄 <strong>{uploadInfo.filename}</strong></span>
            <span>📊 <strong>{uploadInfo.rows?.toLocaleString()}</strong> lignes</span>
            <span>💾 Nulls : <strong>{uploadInfo.null_pct}%</strong></span>
            {uploadInfo.year && <span>📅 Année : <strong>{uploadInfo.year}</strong></span>}
            {uploadInfo.region && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                <MapPin size={12} color="#7c3aed"/>
                <strong style={{ color:'#6d28d9' }}>{uploadInfo.region}</strong>
              </span>
            )}
          </div>
          {(() => {
            const bt = detectBreakdownType(uploadInfo);
            if (bt === 'global') return null;
            return (
              <div style={{ display:'inline-flex', alignItems:'center', gap:5,
                padding:'.25rem .75rem', borderRadius:20, fontSize:'.75rem', fontWeight:700,
                background: bt==='commune' ? '#f5f3ff' : '#e0f2fe',
                color: bt==='commune' ? '#6d28d9' : '#0369a1',
                border: `1px solid ${bt==='commune' ? '#c4b5fd' : '#7dd3fc'}`,
                marginBottom:'.5rem',
              }}>
                <MapPin size={11}/>
                {bt==='commune'
                  ? 'Découpage par commune détecté — Doukkala'
                  : 'Découpage par région détecté — Maroc entier'}
              </div>
            );
          })()}
          {uploadInfo.missing_required?.length > 0 && (
            <div style={{ color:'#b91c1c', fontSize:'.78rem', background:'#fee2e2',
              padding:'.4rem .75rem', borderRadius:6 }}>
              ⚠️ Colonnes manquantes pour la prédiction : {uploadInfo.missing_required.join(', ')}
            </div>
          )}
          {uploadInfo.preview?.length > 0 && (
            <div style={{ marginTop:'.6rem', overflowX:'auto' }}>
              <div style={{ fontSize:'.72rem', color:'#6b7280', fontWeight:600, marginBottom:3 }}>
                Aperçu (5 premières lignes)
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.72rem' }}>
                <thead>
                  <tr>{Object.keys(uploadInfo.preview[0]).map(h =>
                    <th key={h} style={{ padding:'.25rem .5rem', background:'#f3f4f6',
                      borderBottom:'1px solid #e5e7eb', textAlign:'left', fontWeight:700, color:'#374151' }}>
                      {h}
                    </th>)}
                  </tr>
                </thead>
                <tbody>
                  {uploadInfo.preview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} style={{ padding:'.2rem .5rem', borderBottom:'1px solid #f3f4f6',
                          fontFamily:'monospace', color:'#374151', whiteSpace:'nowrap' }}>
                          {String(v).substring(0, 12)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Prediction results ─────────────────────────────────────────────────── */
function PredictionResults({ result, onClose }) {
  const { faible_pct, modere_pct, severe_pct, mean_cwsi, verdict,
    verdict_color, filename, year, analyzed_rows, monthly,
    model_version, model_name, r2_test, lst_conversion_applied, region } = result;

  const pieData = [
    { name:'Faible',  value: faible_pct, color:'#16a34a' },
    { name:'Modéré',  value: modere_pct, color:'#d97706' },
    { name:'Sévère',  value: severe_pct, color:'#dc2626' },
  ].filter(d => d.value > 0);

  return (
    <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e7eb',
      boxShadow:'0 4px 20px rgba(0,0,0,.1)', overflow:'hidden', marginBottom:'1.5rem' }}>

      {/* Header */}
      <div style={{ padding:'1rem 1.25rem', background:'linear-gradient(135deg,#3b0764,#4c1d95)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:'white', fontWeight:700, fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
            <BarChart3 size={18} color="#c4b5fd"/>
            Résultats de prédiction — {filename}
          </div>
          <div style={{ color:'#ddd6fe', fontSize:'.75rem', marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {region && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4,
                background:'rgba(255,255,255,.15)', padding:'.15rem .55rem', borderRadius:20,
                fontWeight:700, fontSize:'.72rem' }}>
                <MapPin size={11}/>
                {region}
              </span>
            )}
            <span>{analyzed_rows?.toLocaleString()} lignes analysées</span>
            {year && <span>· Année {year}</span>}
            <span>· Modèle {model_name} {model_version} (R²={r2_test?.toFixed(4)})</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none',
          borderRadius:6, padding:'.35rem .7rem', cursor:'pointer', color:'white', fontWeight:600 }}>
          ✕
        </button>
      </div>

      {lst_conversion_applied && (
        <div style={{ padding:'.5rem 1.25rem', background:'#fef3c7', fontSize:'.75rem',
          color:'#92400e', display:'flex', alignItems:'center', gap:6 }}>
          <Info size={13}/>
          LST converti automatiquement (Kelvin×10 → °C) — format brut Google Earth Engine détecté.
        </div>
      )}

      <div style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'auto 1fr', gap:'1.5rem' }}>
        {/* Left: verdict + donut */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', minWidth:200 }}>
          {/* Verdict */}
          <div style={{
            padding:'.6rem 1.25rem', borderRadius:20, fontWeight:800, fontSize:'.95rem',
            background:`${verdict_color}18`, color:verdict_color, border:`2px solid ${verdict_color}`,
            textAlign:'center',
          }}>
            {verdict}
          </div>

          {/* CWSI gauge */}
          <div style={{ position:'relative', width:140, height:140 }}>
            <svg width={140} height={140} style={{ transform:'rotate(-90deg)' }}>
              <circle cx={70} cy={70} r={56} fill="none" stroke="#e5e7eb" strokeWidth={12}/>
              <circle cx={70} cy={70} r={56} fill="none" stroke={verdict_color} strokeWidth={12}
                strokeDasharray={`${mean_cwsi * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                strokeLinecap="round"/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:'1.5rem', fontWeight:800, color:verdict_color, lineHeight:1 }}>
                {mean_cwsi?.toFixed(3)}
              </span>
              <span style={{ fontSize:'.65rem', color:'#9ca3af', fontWeight:600, marginTop:2 }}>CWSI moyen</span>
            </div>
          </div>

          {/* Donut chart */}
          <div>
            <div style={{ fontSize:'.73rem', color:'#6b7280', textAlign:'center', marginBottom:4, fontWeight:600 }}>
              Distribution du stress
            </div>
            <ResponsiveContainer width={180} height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={50}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
              {pieData.map(d => (
                <span key={d.name} style={{ display:'inline-flex', alignItems:'center', gap:4,
                  fontSize:'.68rem', fontWeight:700 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:d.color, display:'inline-block' }}/>
                  {d.name}: {d.value}%
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: stats + monthly chart */}
        <div>
          {/* Stress bars */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontWeight:700, fontSize:'.82rem', color:'#374151', marginBottom:'.5rem' }}>
              Répartition par classe de stress
            </div>
            {[
              { label:'✅ Faible (CWSI < 0.4)',  pct:faible_pct, color:'#16a34a' },
              { label:'⚡ Modéré (0.4 – 0.6)',   pct:modere_pct, color:'#d97706' },
              { label:'⚠️ Sévère (CWSI > 0.6)',  pct:severe_pct, color:'#dc2626' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom:'.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem',
                  fontWeight:600, color:'#374151', marginBottom:3 }}>
                  <span>{row.label}</span>
                  <span style={{ color:row.color }}>{row.pct}%</span>
                </div>
                <div style={{ height:8, background:'#e5e7eb', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:20, background:row.color,
                    width:`${row.pct}%`, transition:'width .5s ease' }}/>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly chart */}
          {monthly?.length > 0 && (
            <div>
              <div style={{ fontWeight:700, fontSize:'.82rem', color:'#374151', marginBottom:'.5rem' }}>
                Évolution mensuelle du CWSI
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={monthly} margin={{ top:0, right:10, bottom:0, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                  <XAxis dataKey="month" tick={{ fontSize:10 }}
                    tickFormatter={m => ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'][m]||m}/>
                  <YAxis domain={[0,1]} tick={{ fontSize:10 }}/>
                  <Tooltip formatter={(v,n) => [v.toFixed(4), n==='mean_cwsi'?'CWSI moyen':'%']}/>
                  <Bar dataKey="mean_cwsi" fill="#6366f1" radius={[3,3,0,0]}>
                    {monthly.map((m,i) => (
                      <Cell key={i} fill={m.mean_cwsi > 0.6 ? '#dc2626' : m.mean_cwsi > 0.4 ? '#d97706' : '#16a34a'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */
export default function DatasetConfig() {
  // Upload + prediction state
  const [uploadedFile,    setUploadedFile]    = useState(null);   // last upload result
  const [predicting,      setPredicting]      = useState(false);
  const [predResult,      setPredResult]      = useState(null);
  const [predError,       setPredError]       = useState('');

  // Config state
  const [yearStart,    setYearStart]    = useState(1990);
  const [yearEnd,      setYearEnd]      = useState(2026);
  const [regionNord,   setRegionNord]   = useState(true);
  const [regionCentre, setRegionCentre] = useState(true);
  const [regionSud,    setRegionSud]    = useState(true);
  const [nullMax,      setNullMax]      = useState(20);
  const [minRows,      setMinRows]      = useState(1000);
  const [outputFormat, setOutputFormat] = useState('merged');

  // Data
  const [datasets,    setDatasets]    = useState([]);   // training files (/datasets/available)
  const [predFiles,   setPredFiles]   = useState([]);   // prediction files (/datasets)
  const [loadingDs,   setLoadingDs]   = useState(true);
  const [loadingPred, setLoadingPred] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [running,     setRunning]     = useState(false);
  const [runStatus,   setRunStatus]   = useState(null);
  const [runLogs,     setRunLogs]     = useState([]);
  const [msg,         setMsg]         = useState('');
  const [myProject,   setMyProject]   = useState(null);
  const pollRef      = useRef(null);
  const predResultRef = useRef(null);

  const currentUsername = sessionStorage.getItem('username');

  const IS_TRAINING  = (f) => /^Maroc_ENV_Features_/i.test(f.filename);
  const IS_MY_FILE   = (f) => !IS_TRAINING(f) && f.uploaded_by === currentUsername;

  const fetchDatasets = useCallback(async () => {
    setLoadingDs(true);
    setLoadingPred(true);
    try {
      const r = await apiUsers.get('/datasets');
      const all = r.data?.datasets || [];
      setDatasets(all.filter(IS_TRAINING));
      setPredFiles(all.filter(f => !IS_TRAINING(f) && f.uploaded_by === sessionStorage.getItem('username')));
    } catch {}
    finally { setLoadingDs(false); setLoadingPred(false); }
  }, []);

  const fetchPredFiles = useCallback(async () => {
    setLoadingPred(true);
    try {
      const r = await apiUsers.get('/datasets');
      const all = r.data?.datasets || [];
      setPredFiles(all.filter(f => !IS_TRAINING(f) && f.uploaded_by === sessionStorage.getItem('username')));
    } catch {}
    finally { setLoadingPred(false); }
  }, []);

  // Load config + datasets + assigned project
  useEffect(() => {
    fetchDatasets();
    fetchPredFiles();
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
    apiUsers.get('/datasets/config').then(r => {
      const c = r.data.config || {};
      if (c.start_year)      setYearStart(c.start_year);
      if (c.end_year)        setYearEnd(c.end_year);
      if (c.region_nord      !== undefined) setRegionNord(c.region_nord);
      if (c.region_centre    !== undefined) setRegionCentre(c.region_centre);
      if (c.region_sud       !== undefined) setRegionSud(c.region_sud);
      if (c.nulls_max        !== undefined) setNullMax(c.nulls_max);
      if (c.min_rows         !== undefined) setMinRows(c.min_rows);
    }).catch(() => {});
  }, [fetchDatasets, fetchPredFiles]);

  // Poll run status
  const pollStatus = useCallback(async () => {
    try {
      const r = await apiUsers.get('/pipelines/dataset/run-status');
      setRunStatus(r.data.status);
      setRunLogs(r.data.logs || []);
      if (r.data.status !== 'running') {
        clearInterval(pollRef.current);
        setRunning(false);
        if (r.data.status === 'completed') fetchDatasets();
      }
    } catch {}
  }, [fetchDatasets]);

  const isTrainingFile = (f) => /^Maroc_ENV_Features_.*\.csv$/i.test(f.filename);

  // Fichiers d'entraînement seulement (Maroc_ENV_Features_*)
  const trainingDatasets = datasets.filter(isTrainingFile);

  // Fichiers importés pour la prédiction (tout le reste)
  const predictionDatasets = datasets.filter(f => !isTrainingFile(f));

  // Filter training files client-side based on current settings
  const filteredFiles = trainingDatasets.filter(f => {
    const yr = parseInt(f.year, 10);
    if (!f.year) return false;
    if (yr < yearStart || yr > yearEnd) return false;
    if (f.null_pct > nullMax) return false;
    if (f.rows && f.rows < minRows) return false;
    return true;
  });

  const allFiles = trainingDatasets.filter(f => {
    const yr = parseInt(f.year, 10);
    return f.year && yr >= yearStart && yr <= yearEnd;
  });

  const totalRows = filteredFiles.reduce((s, f) => s + (f.rows || 0), 0);

  const buildConfig = () => ({
    start_year: yearStart, end_year: yearEnd,
    region_nord: regionNord, region_centre: regionCentre, region_sud: regionSud,
    nulls_max: nullMax, min_rows: minRows,
    regions: [
      ...(regionNord   ? ['nord']   : []),
      ...(regionCentre ? ['centre'] : []),
      ...(regionSud    ? ['sud']    : []),
    ],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiUsers.put('/datasets/config', { config: buildConfig() });
      setMsg('✅ Configuration sauvegardée.');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg(`❌ ${e.userMessage || 'Erreur'}`); }
    finally { setSaving(false); }
  };

  const handleRun = async () => {
    setRunning(true); setRunStatus('running'); setRunLogs([]);
    try {
      await apiUsers.post('/pipelines/run', {
        mode: 'custom', pipelines: ['dataset'],
        configs: { dataset: buildConfig() },
        clearml_project: myProject?.clearml_project_name || null,
      });
      clearInterval(pollRef.current);
      pollRef.current = setInterval(pollStatus, 2000);
    } catch(e) {
      setRunning(false); setRunStatus('failed');
      setRunLogs([e.userMessage || 'Erreur lancement']);
    }
  };

  const handlePredict = async (filename, region) => {
    setPredicting(true); setPredResult(null); setPredError('');
    try {
      const r = await apiUsers.post(`/datasets/${encodeURIComponent(filename)}/predict`);
      const result = { ...r.data, region: region || null };
      setPredResult(result);
      setTimeout(() => predResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch(e) {
      setPredError(e.response?.data?.detail || e.userMessage || 'Erreur prédiction');
    } finally { setPredicting(false); }
  };


  const handleDelete = async (fname) => {
    if (!window.confirm(`Supprimer définitivement "${fname}" ?`)) return;
    try {
      await apiUsers.delete(`/datasets/${encodeURIComponent(fname)}`);
      setMsg(`✅ "${fname}" supprimé.`);
      fetchPredFiles();
    } catch (e) {
      setMsg(`❌ ${e.response?.data?.detail || 'Erreur lors de la suppression.'}`);
    }
    setTimeout(() => setMsg(''), 4000);
  };

  const handleDownload = (fname) => {
    const token = sessionStorage.getItem('token');
    const url = `http://localhost:8001/datasets/${encodeURIComponent(fname)}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Erreur serveur');
        return r.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.setAttribute('download', fname);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => setMsg('❌ Erreur lors du téléchargement.'));
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>

      {/* Projet assigné */}
      {myProject ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          padding: '0.5rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '.84rem',
        }}>
          <span style={{ fontWeight: 700, color: '#166534' }}>Projet :</span>
          <span style={{ color: '#166534' }}>{myProject.name}</span>
          {myProject.clearml_project_name && (
            <>
              <span style={{ color: '#9ca3af' }}>·</span>
              <span style={{
                color: '#065f46', fontWeight: 600, fontFamily: 'monospace', fontSize: '.78rem',
                background: '#dcfce7', padding: '0.1rem 0.45rem', borderRadius: 4,
              }}>
                ClearML : {myProject.clearml_project_name}
              </span>
            </>
          )}
        </div>
      ) : (
        <div style={{
          background: '#fef3c7', border: '1px solid #fde047', borderRadius: 8,
          padding: '0.65rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '.84rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: '#92400e' }}>
              Aucun projet ClearML assigné à votre compte.
            </span>
            <span style={{ color: '#b45309', marginLeft: 6 }}>
              Contactez un administrateur pour vous assigner un projet — l'import de fichiers nécessite un projet actif.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1>Dataset Configuration</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            {datasets.length} fichiers entraînement · {predFiles.length} fichiers importés
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            display:'flex', alignItems:'center', gap:5, padding:'.45rem 1rem',
            background:'white', border:`1.5px solid ${ACCENT}`, borderRadius:7,
            cursor:'pointer', fontWeight:700, fontSize:'.85rem', color:ACCENT,
            opacity:saving?.6:1,
          }}>
            <Save size={14}/>{saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          <button onClick={handleRun} disabled={running} style={{
            display:'flex', alignItems:'center', gap:5, padding:'.45rem 1.1rem',
            background:ACCENT, color:'white', border:'none', borderRadius:7,
            cursor:'pointer', fontWeight:700, fontSize:'.85rem', opacity:running?.6:1,
          }}>
            {running ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Play size={14}/>}
            {running ? 'Exécution…' : 'Create Dataset'}
          </button>
        </div>
      </div>

      {msg && <div style={{ marginBottom:'1rem', padding:'.6rem 1rem', borderRadius:8,
        background:msg.includes('✅')?'#f0fdf4':'#fef2f2',
        color:msg.includes('✅')?'#166534':'#991b1b',
        fontSize:'.85rem', fontWeight:600 }}>{msg}</div>}

      <RunStatusBanner status={runStatus} logs={runLogs} onClose={() => setRunStatus(null)}/>

      {/* ── Workflow info banner ── */}
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:12,
        marginBottom:'1.5rem',
      }}>
        <div style={{
          background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10,
          padding:'.85rem 1.1rem', display:'flex', gap:12, alignItems:'flex-start',
        }}>
          <Database size={20} color="#0369a1" style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            <div style={{ fontWeight:700, fontSize:'.85rem', color:'#0c4a6e', marginBottom:3 }}>
              Données d'entraînement — arrière-plan
            </div>
            <div style={{ fontSize:'.76rem', color:'#0369a1', lineHeight:1.5 }}>
              Les données <strong>Train / Validation / Test</strong> sont déjà configurées et gérées automatiquement par le pipeline. Aucune action requise de votre part pour l'entraînement du modèle.
            </div>
          </div>
        </div>
        <div style={{
          background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:10,
          padding:'.85rem 1.1rem', display:'flex', gap:12, alignItems:'flex-start',
        }}>
          <MapPin size={20} color="#7c3aed" style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            <div style={{ fontWeight:700, fontSize:'.85rem', color:'#4c1d95', marginBottom:3 }}>
              Fichiers de prédiction — votre rôle
            </div>
            <div style={{ fontSize:'.76rem', color:'#6d28d9', lineHeight:1.5 }}>
              Importez ici des fichiers CSV pour <strong>une région spécifique</strong> (ex: El Jadida). Le modèle calculera le stress hydrique pour chaque point de cette région.
            </div>
          </div>
        </div>
      </div>

      {/* ── Import & Predict section ── */}
      <div className="card" style={{ marginBottom:'1.5rem', borderTop:`3px solid #7c3aed` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:'1rem', paddingBottom:'.75rem', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <MapPin size={18} color="#7c3aed"/>
            <h3 style={{ margin:0, color:'#5b21b6', fontSize:'.95rem' }}>
              Importer un fichier de prédiction — Sélectionner la région
            </h3>
          </div>
          <span style={{ fontSize:'.73rem', color:'#9ca3af', background:'#f5f3ff',
            padding:'.2rem .6rem', borderRadius:20, fontWeight:600 }}>
            Modèle RandomForest v8 · R²=0.9734
          </span>
        </div>

        {!myProject && (
          <div style={{
            padding:'1.25rem', background:'#fef3c7', borderRadius:8,
            border:'1px solid #fde047', display:'flex', alignItems:'center', gap:10,
            fontSize:'.85rem', color:'#92400e', fontWeight:600, marginBottom:'1rem',
          }}>
            🔒 Import désactivé — vous devez avoir un projet ClearML assigné. Contactez un administrateur.
          </div>
        )}

        <div style={{ opacity: myProject ? 1 : 0.4, pointerEvents: myProject ? 'auto' : 'none' }}>
        <UploadZone
          clearmlProject={myProject?.clearml_project_name}
          onUploadDone={(info) => {
            setUploadedFile(info);
            // Ajouter immédiatement le fichier dans la liste (uniquement pour l'utilisateur courant)
            setPredFiles(prev => {
              const exists = prev.some(f => f.filename === info.filename);
              if (exists) return prev;
              return [...prev, {
                filename:      info.filename,
                rows:          info.rows,
                null_pct:      info.null_pct,
                year:          info.year || null,
                region:        info.region || null,
                status:        'RAW',
                last_modified: new Date().toISOString(),
                uploaded_by:   sessionStorage.getItem('username'),
              }];
            });
            fetchPredFiles();
            setPredResult(null);
            setPredError('');
          }}
        />

        {/* Predict button — appears after successful upload */}
        {uploadedFile && !predResult && (
          <div style={{
            marginTop:'1rem', padding:'1rem', borderRadius:10,
            background: uploadedFile.can_predict === false ? '#fef9c3' : '#faf5ff',
            border: `1.5px solid ${uploadedFile.can_predict === false ? '#fde047' : '#c4b5fd'}`,
          }}>
            {uploadedFile.can_predict === false ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'#92400e', fontSize:'.84rem', fontWeight:600 }}>
                <Info size={15}/>
                Ce fichier ne contient pas toutes les colonnes requises pour la prédiction.
                Colonnes manquantes : <strong>{uploadedFile.missing_required?.join(', ')}</strong>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
                <button
                  onClick={() => handlePredict(uploadedFile.filename, uploadedFile.region)}
                  disabled={predicting}
                  style={{
                    display:'flex', alignItems:'center', gap:8, padding:'.6rem 1.6rem',
                    background: predicting ? '#7c3aed99' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    color:'white', border:'none', borderRadius:8,
                    cursor: predicting ? 'not-allowed' : 'pointer',
                    fontWeight:700, fontSize:'.92rem',
                    boxShadow: predicting ? 'none' : '0 2px 8px rgba(124,58,237,.35)',
                    transition:'all .2s',
                  }}>
                  {predicting
                    ? <Loader2 size={17} style={{ animation:'spin 1s linear infinite' }}/>
                    : <TrendingUp size={17}/>}
                  {predicting
                    ? 'Analyse en cours…'
                    : uploadedFile.region
                      ? `Prédire pour ${uploadedFile.region}`
                      : 'Prédire le stress hydrique'}
                </button>
                <div style={{ fontSize:'.8rem', color:'#6b7280', lineHeight:1.5 }}>
                  <div>
                    <strong>{uploadedFile.rows?.toLocaleString()}</strong> lignes à analyser
                    {uploadedFile.year && <> · Année <strong>{uploadedFile.year}</strong></>}
                  </div>
                  {uploadedFile.region && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, color:'#6d28d9', fontWeight:600 }}>
                      <MapPin size={11}/>Région : {uploadedFile.region}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {predError && (
          <div style={{ marginTop:'.75rem', padding:'.6rem 1rem', background:'#fef2f2',
            color:'#991b1b', borderRadius:7, fontSize:'.83rem', fontWeight:600 }}>
            ❌ {predError}
          </div>
        )}

        {/* Prediction results — inline dans la carte */}
        {predResult && (
          <div ref={predResultRef} style={{ marginTop:'1.25rem' }}>
            <PredictionResults
              result={predResult}
              onClose={() => { setPredResult(null); setPredError(''); }}
            />
            <BreakdownTable
              breakdown={predResult.breakdown}
              breakdownType={predResult.breakdown_type}
            />
          </div>
        )}
        </div>{/* end upload wrapper */}
      </div>

      {/* Two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'1.5rem' }}>

        {/* LEFT: Settings */}
        <div>
          <Card title="📅 Period Selection" color="#0891b2">
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:'.5rem' }}>
              <div style={{ flex:1 }}>
                <label style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', display:'block', marginBottom:4 }}>Start Year</label>
                <input type="number" value={yearStart} min={1980} max={yearEnd-1}
                  onChange={e => setYearStart(parseInt(e.target.value,10)||1990)}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:7,
                    padding:'.4rem .65rem', fontSize:'.9rem', fontWeight:700, color:ACCENT }}/>
              </div>
              <div style={{ paddingTop:20, color:'#9ca3af', fontWeight:700 }}>→</div>
              <div style={{ flex:1 }}>
                <label style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', display:'block', marginBottom:4 }}>End Year</label>
                <input type="number" value={yearEnd} min={yearStart+1} max={2030}
                  onChange={e => setYearEnd(parseInt(e.target.value,10)||2026)}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:7,
                    padding:'.4rem .65rem', fontSize:'.9rem', fontWeight:700, color:ACCENT }}/>
              </div>
            </div>
            <div style={{ fontSize:'.73rem', color:'#9ca3af', textAlign:'center' }}>
              {yearEnd - yearStart} années · {allFiles.length} fichiers dans la période
            </div>
          </Card>

          <Card title="🗺️ Regions" color="#0891b2">
            {[
              { key:'nord',   label:'Nord Maroc',   sub:'latitude > 34°N', val:regionNord,   set:setRegionNord },
              { key:'centre', label:'Centre Maroc',  sub:'31° – 34°N',      val:regionCentre, set:setRegionCentre },
              { key:'sud',    label:'Sud Maroc',     sub:'latitude < 31°N', val:regionSud,    set:setRegionSud },
            ].map(r => (
              <label key={r.key} style={{
                display:'flex', alignItems:'center', gap:10, padding:'.5rem .65rem',
                borderRadius:8, cursor:'pointer', marginBottom:'.4rem',
                background:r.val ? '#e0f2fe' : '#f9fafb',
                border:`1px solid ${r.val ? '#7dd3fc' : '#e5e7eb'}`,
              }}>
                <input type="checkbox" checked={r.val} onChange={e => r.set(e.target.checked)}
                  style={{ accentColor:'#0891b2', width:16, height:16 }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.85rem' }}>{r.label}</div>
                  <div style={{ fontSize:'.71rem', color:'#6b7280' }}>{r.sub}</div>
                </div>
              </label>
            ))}
          </Card>

          <Card title="🔍 Quality Filters" color={ACCENT}>
            <Slider label="Max Nulls" value={nullMax} min={0} max={50} step={1} unit="%"
              onChange={setNullMax}/>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:'.25rem' }}>
              <label style={{ fontWeight:600, fontSize:'.83rem', color:'#374151', minWidth:80 }}>Min Rows</label>
              <input type="number" value={minRows} min={0} max={100000} step={100}
                onChange={e => setMinRows(parseInt(e.target.value,10)||0)}
                style={{ width:110, border:'1px solid #d1d5db', borderRadius:7,
                  padding:'.35rem .6rem', fontSize:'.88rem', fontWeight:700, color:ACCENT, textAlign:'center' }}/>
              <span style={{ fontSize:'.78rem', color:'#9ca3af' }}>lignes minimum</span>
            </div>
          </Card>

          <Card title="📦 Output Format" color={ACCENT}>
            {[
              { v:'merged',    label:'Single merged file',   hint:'Concatène tous les CSV en un seul fichier' },
              { v:'separate',  label:'Keep separate files',  hint:'Conserve un fichier par année' },
            ].map(f => (
              <label key={f.v} style={{
                display:'flex', alignItems:'center', gap:10, padding:'.55rem .75rem',
                borderRadius:8, cursor:'pointer', marginBottom:'.4rem',
                background:outputFormat===f.v?'#f0fdf4':'white',
                border:`1.5px solid ${outputFormat===f.v?ACCENT:'#e5e7eb'}`,
              }}>
                <input type="radio" value={f.v} checked={outputFormat===f.v}
                  onChange={() => setOutputFormat(f.v)}
                  style={{ accentColor:ACCENT, width:16, height:16 }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.85rem' }}>{f.label}</div>
                  <div style={{ fontSize:'.71rem', color:'#6b7280' }}>{f.hint}</div>
                </div>
              </label>
            ))}
          </Card>
        </div>

        {/* RIGHT: Files Preview */}
        <div>
          <Card title={`📋 MALOPS_Hydric_Stress_Dataset — ${datasets.length} fichiers`} color="#0891b2">
            <div style={{ fontSize:'.73rem', color:'#0369a1', background:'#e0f2fe',
              padding:'.35rem .75rem', borderRadius:6, marginBottom:'.75rem', fontWeight:600 }}>
              Projet ClearML : MALOPS · Fichiers Maroc_ENV_Features_*
            </div>
            {loadingDs ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>
                <Loader2 size={20} style={{ animation:'spin 1s linear infinite' }}/>
              </div>
            ) : datasets.length === 0 ? (
              <p style={{ color:'#9ca3af', textAlign:'center', padding:'1rem' }}>
                Aucun fichier Maroc_ENV_Features_*.csv trouvé.
              </p>
            ) : (
              <div style={{ maxHeight:480, overflowY:'auto', display:'flex', flexDirection:'column', gap:'.4rem' }}>
                {datasets.map(f => (
                  <div key={f.filename} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'.5rem .75rem',
                    borderRadius:8, background:'#f0fdf4', border:'1px solid #86efac',
                  }}>
                    <span style={{ fontSize:'1rem' }}>☑</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'.82rem', color:'#111827',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {f.filename}
                      </div>
                      <div style={{ fontSize:'.7rem', color:'#6b7280' }}>
                        {f.rows ? `${(f.rows/1000).toFixed(0)}K lignes` : '—'}
                        {f.size_bytes ? ` · ${(f.size_bytes/1024/1024).toFixed(1)} MB` : ''}
                        {f.year ? ` · ${f.year}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop:'.75rem', padding:'.5rem .75rem', background:'#f9fafb',
              borderRadius:7, fontSize:'.8rem', color:'#374151', fontWeight:600,
              border:'1px solid #e5e7eb' }}>
              Total : <strong>{datasets.length}</strong> fichiers
            </div>
          </Card>
        </div>
      </div>

      {/* Fichiers importés pour la prédiction */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <MapPin size={16} color="#7c3aed"/>
            <h3 style={{ margin:0, color:'#4c1d95' }}>Fichiers importés pour la prédiction</h3>
            <span style={{ fontSize:'.73rem', color:'#6d28d9', background:'#f5f3ff',
              padding:'.2rem .6rem', borderRadius:20, fontWeight:600 }}>
              {predFiles.length} fichier{predFiles.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={fetchPredFiles} style={{ display:'flex', alignItems:'center', gap:5,
            padding:'.35rem .75rem', background:'white', border:'1px solid #e5e7eb',
            borderRadius:6, cursor:'pointer', fontSize:'.8rem', color:'#374151', fontWeight:600 }}>
            <RefreshCw size={12}/>Rafraîchir
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>{['Nom du fichier','Région','Année','Lignes','Nulls %','Statut','Importé le','Actions'].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loadingPred ? (
                <tr><td colSpan={8} style={{ textAlign:'center', color:'#9ca3af', padding:'1.5rem' }}>Chargement…</td></tr>
              ) : predFiles.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign:'center', padding:'2rem' }}>
                    <div style={{ color:'#9ca3af', marginBottom:'.4rem' }}>Aucun fichier importé pour l'instant.</div>
                    <div style={{ fontSize:'.78rem', color:'#c4b5fd' }}>
                      Utilisez la section ci-dessus pour importer un fichier CSV en sélectionnant une région.
                    </div>
                  </td>
                </tr>
              ) : predFiles.map(d => (
                <tr key={d.filename}>
                  <td style={{ fontWeight:600, fontSize:'.82rem', maxWidth:200,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {d.filename}
                  </td>
                  <td>
                    {d.region ? (
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        padding:'.18rem .55rem', borderRadius:20, fontSize:'.73rem', fontWeight:700,
                        background:'#f5f3ff', color:'#6d28d9', border:'1px solid #e9d5ff',
                      }}>
                        <MapPin size={10}/>
                        {d.region}
                      </span>
                    ) : (
                      <span style={{ color:'#9ca3af', fontSize:'.78rem' }}>—</span>
                    )}
                  </td>
                  <td>{d.year || '—'}</td>
                  <td>{d.rows ? `${(d.rows/1000).toFixed(0)}K` : '—'}</td>
                  <td>
                    <span style={{ color: d.null_pct > 50 ? '#991b1b' : d.null_pct > 20 ? '#92400e' : '#166534',
                      fontWeight:700 }}>
                      {d.null_pct}%
                    </span>
                  </td>
                  <td>
                    <span style={{ padding:'.18rem .55rem', borderRadius:20, fontSize:'.73rem', fontWeight:700,
                      background:d.status==='VALIDATED'?'#d1fae5':'#fef3c7',
                      color:d.status==='VALIDATED'?'#065f46':'#92400e' }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ fontSize:'.78rem', color:'#9ca3af' }}>
                    {d.last_modified ? new Date(d.last_modified).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => handleDelete(d.filename)} style={{
                        display:'flex', alignItems:'center', gap:3, padding:'.25rem .55rem',
                        background:'#fee2e2', color:'#991b1b', border:'none', borderRadius:5,
                        cursor:'pointer', fontSize:'.75rem', fontWeight:600 }}
                        title="Supprimer">
                        <Trash2 size={11}/>
                      </button>
                      <button style={{ display:'flex', alignItems:'center', gap:3, padding:'.25rem .55rem',
                        background:'#dbeafe', color:'#1e40af', border:'none', borderRadius:5,
                        cursor:'pointer', fontSize:'.75rem', fontWeight:600 }}
                        onClick={() => handleDownload(d.filename)}
                        title="Télécharger">
                        <Download size={11}/>
                      </button>
                      <button style={{ display:'flex', alignItems:'center', gap:3, padding:'.25rem .55rem',
                        background:'#f5f3ff', color:'#6d28d9', border:'none', borderRadius:5,
                        cursor:'pointer', fontSize:'.75rem', fontWeight:600 }}
                        onClick={() => { setPredResult(null); setPredError(''); setUploadedFile({ ...d, can_predict: true }); window.scrollTo({top:0,behavior:'smooth'}); handlePredict(d.filename, d.region); }}
                        title="Lancer la prédiction">
                        <TrendingUp size={11}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUsers } from '../../api/axios';
import { Play, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const ACCENT = '#2d6a4f';

function Card({ title, color = ACCENT, children }) {
  return (
    <div style={{ background:'white', borderRadius:10, border:'1px solid #e5e7eb',
      borderLeft:`3px solid ${color}`, marginBottom:'1rem', overflow:'hidden' }}>
      {title && (
        <div style={{ padding:'.6rem 1rem', background:'#fafafa',
          borderBottom:'1px solid #f3f4f6', fontWeight:700, fontSize:'.85rem' }}>{title}</div>
      )}
      <div style={{ padding:'1rem' }}>{children}</div>
    </div>
  );
}

function Slider({ label, hint, value, min, max, step=0.01, onChange }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ marginBottom:'.9rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <div>
          <span style={{ fontWeight:600, fontSize:'.83rem', color:'#374151' }}>{label}</span>
          {hint && <span style={{ fontSize:'.71rem', color:'#9ca3af', marginLeft:6 }}>{hint}</span>}
        </div>
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value)||min)}
          style={{ width:75, border:'1px solid #d1d5db', borderRadius:6, padding:'.2rem .4rem',
            fontWeight:700, fontSize:'.83rem', color:ACCENT, textAlign:'center' }}/>
      </div>
      <div style={{ position:'relative', height:6, background:'#e5e7eb', borderRadius:20 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:20,
          width:`${pct}%`, background:`linear-gradient(90deg,${ACCENT},#40916c)` }}/>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position:'absolute', top:-5, left:0, width:'100%', height:16, opacity:0, cursor:'pointer' }}/>
      </div>
    </div>
  );
}

function RunBanner({ status, logs, onClose }) {
  if (!status || status === 'idle') return null;
  const isRunning = status === 'running';
  const color = isRunning ? '#1e40af' : status==='completed' ? '#15803d' : '#991b1b';
  const bg    = isRunning ? '#eff6ff' : status==='completed' ? '#f0fdf4' : '#fef2f2';
  return (
    <div style={{ background:bg, border:`1px solid ${color}30`, borderRadius:9,
      padding:'.75rem 1rem', marginBottom:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {isRunning && <Loader2 size={15} style={{ animation:'spin 1s linear infinite', color }}/>}
        {status==='completed' && <CheckCircle2 size={15} color={color}/>}
        {status==='failed'    && <XCircle size={15} color={color}/>}
        <span style={{ fontWeight:700, fontSize:'.85rem', color, flex:1 }}>
          {isRunning ? 'Validation en cours…' : status==='completed' ? '✅ Validation terminée' : '❌ Échec'}
        </span>
        {!isRunning && <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>}
      </div>
      {logs.length > 0 && (
        <div style={{ fontFamily:'monospace', fontSize:'.73rem', color:'#374151', background:'rgba(0,0,0,.04)',
          borderRadius:6, padding:'.4rem .65rem', maxHeight:70, overflowY:'auto', lineHeight:1.6, marginTop:6 }}>
          {logs.slice(-4).map((l,i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

const ALL_FEATURES = [
  { key:'feat_ndvi',   label:'NDVI' },
  { key:'feat_ndwi',   label:'NDWI' },
  { key:'feat_msi',    label:'MSI'  },
  { key:'feat_lst',    label:'LST'  },
  { key:'feat_precip', label:'Precipitation' },
  { key:'feat_soil',   label:'SoilMoisture' },
  { key:'feat_et0',    label:'ET0'  },
];

export default function ValidationConfig() {
  // Feature selection
  const [features, setFeatures] = useState({
    feat_ndvi:true, feat_ndwi:true, feat_msi:true, feat_lst:true,
    feat_precip:true, feat_soil:true, feat_et0:false,
  });
  const [strictTypes, setStrictTypes] = useState(true);

  // Drift
  const [psiThreshold, setPsiThreshold] = useState(0.1);
  const [ksPvalue,     setKsPvalue]     = useState(0.05);
  const [baseline,     setBaseline]     = useState('last_validated');

  // Outliers
  const [outlierMethod,    setOutlierMethod]    = useState('IQR');
  const [outlierThreshold, setOutlierThreshold] = useState(3.0);
  const [outlierAction,    setOutlierAction]    = useState('flag');

  // Run state
  const [running,   setRunning]   = useState(false);
  const [runStatus, setRunStatus] = useState(null);
  const [runLogs,   setRunLogs]   = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');
  const [myProject, setMyProject] = useState(null);
  const pollRef = useRef(null);

  // Load saved config + assigned project
  useEffect(() => {
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
    apiUsers.get('/validation/config').then(r => {
      const c = r.data.config || {};
      if (c.feat_ndvi   !== undefined) setFeatures(f => ({ ...f, ...Object.fromEntries(
        Object.keys(f).map(k => [k, c[k] !== undefined ? c[k] : f[k]])
      )}));
      if (c.psi_threshold !== undefined) setPsiThreshold(c.psi_threshold);
      if (c.ks_pvalue     !== undefined) setKsPvalue(c.ks_pvalue);
      if (c.outlier_method    ) setOutlierMethod(c.outlier_method);
      if (c.outlier_threshold !== undefined) setOutlierThreshold(c.outlier_threshold);
      if (c.autofix !== undefined) setOutlierAction(c.autofix ? 'impute' : 'flag');
    }).catch(() => {});
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const r = await apiUsers.get('/pipelines/validation/run-status');
      setRunStatus(r.data.status);
      setRunLogs(r.data.logs || []);
      if (r.data.status !== 'running') {
        clearInterval(pollRef.current);
        setRunning(false);
      }
    } catch {}
  }, []);

  const buildConfig = () => ({
    ...features,
    strict_types: strictTypes,
    psi_threshold: psiThreshold,
    ks_pvalue: ksPvalue,
    baseline,
    outlier_method: outlierMethod,
    outlier_threshold: outlierThreshold,
    autofix: outlierAction === 'impute',
    required_features: ALL_FEATURES.filter(f => features[f.key]).map(f => f.label),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiUsers.put('/validation/config', { config: buildConfig() });
      setMsg('✅ Configuration sauvegardée.');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg(`❌ ${e.userMessage||'Erreur'}`); }
    finally { setSaving(false); }
  };

  const handleRun = async () => {
    setRunning(true); setRunStatus('running'); setRunLogs([]);
    try {
      await apiUsers.post('/pipelines/run', {
        mode: 'custom', pipelines: ['validation'],
        configs: { validation: buildConfig() },
        clearml_project: myProject?.clearml_project_name || null,
      });
      clearInterval(pollRef.current);
      pollRef.current = setInterval(pollStatus, 2000);
    } catch(e) {
      setRunning(false); setRunStatus('failed');
      setRunLogs([e.userMessage||'Erreur lancement']);
    }
  };

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>

      {myProject && (
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
      )}

      <div className="admin-page-header">
        <div>
          <h1>Validation Configuration</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            {ALL_FEATURES.filter(f => features[f.key]).length} features sélectionnées
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            display:'flex', alignItems:'center', gap:5, padding:'.45rem 1rem',
            background:'white', border:`1.5px solid ${ACCENT}`, borderRadius:7,
            cursor:'pointer', fontWeight:700, fontSize:'.85rem', color:ACCENT,
            opacity:saving?.6:1 }}>
            <Save size={14}/>{saving?'Sauvegarde…':'Sauvegarder'}
          </button>
          <button onClick={handleRun} disabled={running} style={{
            display:'flex', alignItems:'center', gap:5, padding:'.45rem 1.1rem',
            background:ACCENT, color:'white', border:'none', borderRadius:7,
            cursor:'pointer', fontWeight:700, fontSize:'.85rem', opacity:running?.6:1 }}>
            {running?<Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/>:<Play size={14}/>}
            {running?'Exécution…':'Run Validation'}
          </button>
        </div>
      </div>

      {msg && <div style={{ marginBottom:'1rem', padding:'.6rem 1rem', borderRadius:8, fontSize:'.85rem',
        fontWeight:600, background:msg.includes('✅')?'#f0fdf4':'#fef2f2',
        color:msg.includes('✅')?'#166534':'#991b1b' }}>{msg}</div>}
      <RunBanner status={runStatus} logs={runLogs} onClose={() => setRunStatus(null)}/>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
        {/* LEFT column */}
        <div>
          {/* Schema Validation */}
          <Card title="✅ Schema Validation" color="#0891b2">
            <div style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', marginBottom:'.6rem' }}>
              Required Features
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'.35rem', marginBottom:'1rem' }}>
              {ALL_FEATURES.map(f => (
                <label key={f.key} style={{
                  display:'flex', alignItems:'center', gap:5, padding:'.3rem .5rem',
                  borderRadius:7, cursor:'pointer', border:`1px solid ${features[f.key]?'#7dd3fc':'#e5e7eb'}`,
                  background:features[f.key]?'#e0f2fe':'#f9fafb',
                  fontSize:'.78rem', fontWeight:features[f.key]?700:500,
                  color:features[f.key]?'#0369a1':'#6b7280',
                }}>
                  <input type="checkbox" checked={!!features[f.key]}
                    onChange={e => setFeatures(v => ({ ...v, [f.key]:e.target.checked }))}
                    style={{ accentColor:'#0891b2' }}/>
                  {f.label}
                </label>
              ))}
            </div>

            <div style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', marginBottom:'.5rem' }}>
              Data Types Enforcement
            </div>
            {[
              { v:true,  label:'☑ Strict',  hint:'Rejette les types invalides' },
              { v:false, label:'○ Coerce',  hint:'Auto-convertit si possible' },
            ].map(t => (
              <label key={String(t.v)} style={{
                display:'flex', alignItems:'center', gap:8, padding:'.45rem .65rem', cursor:'pointer',
                borderRadius:7, marginBottom:'.35rem',
                background:strictTypes===t.v?'#f0fdf4':'white',
                border:`1px solid ${strictTypes===t.v?ACCENT:'#e5e7eb'}`,
              }}>
                <input type="radio" checked={strictTypes===t.v} onChange={() => setStrictTypes(t.v)}
                  style={{ accentColor:ACCENT }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.83rem' }}>{t.label}</div>
                  <div style={{ fontSize:'.71rem', color:'#9ca3af' }}>{t.hint}</div>
                </div>
              </label>
            ))}
          </Card>

          {/* Drift Detection */}
          <Card title="📊 Drift Detection" color="#7c3aed">
            <Slider label="PSI Threshold" hint="Population Stability Index"
              value={psiThreshold} min={0.02} max={0.5} step={0.01}
              onChange={setPsiThreshold}/>
            <Slider label="KS-Test p-value" hint="Niveau de significativité"
              value={ksPvalue} min={0.01} max={0.2} step={0.005}
              onChange={setKsPvalue}/>
            <div style={{ marginTop:'.5rem' }}>
              <label style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', display:'block', marginBottom:4 }}>
                Baseline Dataset
              </label>
              <select value={baseline} onChange={e => setBaseline(e.target.value)}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:7,
                  padding:'.4rem .65rem', fontSize:'.85rem', color:'#374151', background:'white' }}>
                <option value="last_validated">Last validated dataset</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="2022">Maroc_ENV_Features_2022.csv</option>
                <option value="2023">Maroc_ENV_Features_2023.csv</option>
              </select>
            </div>
          </Card>
        </div>

        {/* RIGHT column */}
        <div>
          {/* Outlier Detection */}
          <Card title="🔎 Outlier Detection" color="#d97706">
            <div style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', marginBottom:'.5rem' }}>Method</div>
            {[
              { v:'IQR',     label:'IQR (Interquartile Range)', hint:'Robuste aux distributions asymétriques' },
              { v:'zscore',  label:'Z-Score',                   hint:'Basé sur l\'écart-type' },
              { v:'isolation_forest', label:'Isolation Forest', hint:'Machine Learning — meilleur pour haute dimensionnalité' },
            ].map(m => (
              <label key={m.v} style={{
                display:'flex', alignItems:'center', gap:8, padding:'.45rem .65rem', cursor:'pointer',
                borderRadius:7, marginBottom:'.35rem',
                background:outlierMethod===m.v?'#fef3c7':'white',
                border:`1px solid ${outlierMethod===m.v?'#d97706':'#e5e7eb'}`,
              }}>
                <input type="radio" checked={outlierMethod===m.v} onChange={() => setOutlierMethod(m.v)}
                  style={{ accentColor:'#d97706' }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.83rem' }}>{m.label}</div>
                  <div style={{ fontSize:'.71rem', color:'#9ca3af' }}>{m.hint}</div>
                </div>
              </label>
            ))}

            <div style={{ marginTop:'.75rem' }}>
              <Slider label="Threshold" hint={outlierMethod==='zscore'?'Nb de σ':'Facteur IQR'}
                value={outlierThreshold} min={1} max={5} step={0.1}
                onChange={setOutlierThreshold}/>
            </div>

            <div style={{ fontWeight:600, fontSize:'.82rem', color:'#374151', marginBottom:'.5rem', marginTop:'.25rem' }}>
              Action on Outliers
            </div>
            {[
              { v:'flag',   label:'Flag only',           hint:'Marque sans modifier' },
              { v:'remove', label:'Remove automatically', hint:'Supprime les lignes aberrantes' },
              { v:'impute', label:'Impute with median',   hint:'Remplace par la médiane de la feature' },
            ].map(a => (
              <label key={a.v} style={{
                display:'flex', alignItems:'center', gap:8, padding:'.4rem .65rem', cursor:'pointer',
                borderRadius:7, marginBottom:'.3rem',
                background:outlierAction===a.v?'#fff7ed':'white',
                border:`1px solid ${outlierAction===a.v?'#d97706':'#e5e7eb'}`,
              }}>
                <input type="radio" checked={outlierAction===a.v} onChange={() => setOutlierAction(a.v)}
                  style={{ accentColor:'#d97706' }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.83rem' }}>{a.label}</div>
                  <div style={{ fontSize:'.71rem', color:'#9ca3af' }}>{a.hint}</div>
                </div>
              </label>
            ))}
          </Card>

          {/* Summary */}
          <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'1rem' }}>
            <div style={{ fontWeight:700, fontSize:'.85rem', color:ACCENT, marginBottom:'.5rem' }}>
              📋 Résumé de la configuration
            </div>
            {[
              ['Features', `${ALL_FEATURES.filter(f=>features[f.key]).length}/7 requises`],
              ['Type check', strictTypes ? 'Strict' : 'Coerce'],
              ['PSI seuil', psiThreshold],
              ['KS p-value', ksPvalue],
              ['Outliers', `${outlierMethod} · seuil ${outlierThreshold} · action: ${outlierAction}`],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem',
                padding:'.3rem 0', borderBottom:'1px solid #d1fae5' }}>
                <span style={{ color:'#374151', fontWeight:600 }}>{k}</span>
                <span style={{ color:ACCENT, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

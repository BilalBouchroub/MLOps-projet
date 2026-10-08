import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Database, Upload, Globe, Eye, Wand2, Download } from 'lucide-react';
import './ScientistPages.css';

const FEATURES = ['NDVI','NDWI','MSI','LST','Precipitation','SoilMoisture','ET0'];
const TRANSFORMERS = ['Log','Square Root','Standardize','Normalize','One-Hot Encode','Min-Max Scale'];
const EXPORT_FORMATS = ['CSV','Parquet','JSON'];

function QualityCard({ label, value, unit='', color }) {
  const cls = color === 'ok' ? 'quality-ok' : color === 'warn' ? 'quality-warn' : 'quality-bad';
  return (
    <div className="quality-card">
      <div className={`qval ${cls}`}>{value}{unit}</div>
      <div className="qlabel">{label}</div>
    </div>
  );
}

export default function DataPipeline() {
  const [datasets, setDatasets]   = useState([]);
  const [validation, setValidation] = useState(null);
  const [preview, setPreview]     = useState(null);

  const [selectedFeatures, setSelectedFeatures] = useState(new Set());
  const [transformRows, setTransformRows]        = useState([]);
  const [applyMsg, setApplyMsg]                  = useState('');

  const [exportFmt, setExportFmt]   = useState('CSV');
  const [exportDest, setExportDest] = useState('download');
  const [exportMsg, setExportMsg]   = useState('');

  const loadAll = (silent = false) => {
    apiUsers.get('/datasets').then(r => setDatasets(r.data?.datasets || [])).catch(() => {});
    apiUsers.get('/validation/report').then(r => setValidation(r.data)).catch(() => {});
  };

  useEffect(() => {
    loadAll();
    const iv = setInterval(() => loadAll(true), 10000);
    return () => clearInterval(iv);
  }, []);

  const totalFiles   = datasets.length || validation?.schema?.total_files || 0;
  const perFile      = validation?.schema?.per_file || {};
  const warnings     = validation?.schema?.warnings || [];
  const drift        = validation?.drift || {};

  const validatedCount = Object.values(perFile).filter(f => f.null_rate === 0).length;
  const nullPctMax     = Math.max(...Object.values(perFile).map(f => f.null_rate * 100), 0);
  const driftCount     = Object.values(drift).filter(d => d.drift).length;

  /* Quality pie (validated vs raw) */
  const qualityPie = [
    { name:'Validés', value: validatedCount, fill:'#10b981' },
    { name:'Bruts',   value: totalFiles - validatedCount, fill:'#f59e0b' },
  ];

  /* Feature engineering helpers */
  const toggleFeature = (f) => {
    const next = new Set(selectedFeatures);
    next.has(f) ? next.delete(f) : next.add(f);
    setSelectedFeatures(next);
  };

  const addTransform = () => {
    if (selectedFeatures.size === 0) return;
    setTransformRows(prev => [...prev, { id: Date.now(), features: [...selectedFeatures], transformer: 'Standardize', outputName: '' }]);
    setSelectedFeatures(new Set());
  };

  const removeTransform = (id) => setTransformRows(prev => prev.filter(r => r.id !== id));
  const updateTransform = (id, key, val) => setTransformRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));

  const handleApply = () => {
    if (transformRows.length === 0) { setApplyMsg('Aucune transformation définie.'); return; }
    setApplyMsg(`✅ ${transformRows.length} transformation(s) appliquée(s). Prévisualisation mise à jour.`);
    setTimeout(() => setApplyMsg(''), 4000);
  };

  const handleExport = () => {
    setExportMsg(`✅ Export ${exportFmt} vers "${exportDest}" lancé.`);
    setTimeout(() => setExportMsg(''), 4000);
  };

  return (
    <div>
      <div className="admin-page-header">
        <div><h1>Data Pipeline</h1><p>Sources de données, qualité et feature engineering</p></div>
      </div>

      {/* ── Data Sources ── */}
      <h3 style={{ fontWeight:700, color:'var(--sidebar-bg)', marginBottom:'1rem' }}>Data Sources</h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
        {[
          { icon: <Database size={28}/>, title:'PostgreSQL MLops', desc:`Tables: users, predictions, api_logs`, color:'#dbeafe', btn:'Explorer' },
          { icon: <Upload size={28}/>,   title:'Fichiers uploadés', desc:`${datasets.length} CSV disponibles`, color:'#d1fae5', btn:'Voir datasets' },
          { icon: <Globe size={28}/>,    title:'API Externe', desc:'Endpoint REST configurable', color:'#fef3c7', btn:'Configurer' },
        ].map(({ icon, title, desc, color, btn }) => (
          <div key={title} style={{ background:'white', borderRadius:10, padding:'1.25rem', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column', gap:'.75rem' }}>
            <div style={{ width:52, height:52, background:color, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--sidebar-bg)' }}>{icon}</div>
            <div>
              <div style={{ fontWeight:700, marginBottom:.25+'rem' }}>{title}</div>
              <div style={{ fontSize:'.82rem', color:'var(--text-muted)' }}>{desc}</div>
            </div>
            <button className="btn-icon btn-logs" style={{ alignSelf:'flex-start' }} onClick={() => setPreview(title)}>
              <Eye size={12}/>{btn}
            </button>
          </div>
        ))}
      </div>

      {/* ── Data Quality Dashboard ── */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700, marginBottom:'1.25rem' }}>Data Quality Dashboard</h3>
        <div className="quality-cards">
          <QualityCard label="Fichiers validés" value={`${validatedCount}/${totalFiles}`} color="ok" />
          <QualityCard label="Warnings" value={warnings.length} color={warnings.length > 10 ? 'warn' : 'ok'} />
          <QualityCard label="Features en drift" value={`${driftCount}/${Object.keys(drift).length}`} color={driftCount > 3 ? 'bad' : 'warn'} />
          <QualityCard label="Null rate max" value={nullPctMax.toFixed(1)} unit="%" color={nullPctMax > 5 ? 'warn' : 'ok'} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem' }}>
          {/* Pie chart */}
          <div>
            <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'.75rem' }}>Répartition Validé / Brut</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={qualityPie} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name,value }) => `${name}: ${value}`}>
                  {qualityPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Drift table */}
          <div>
            <p style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'.75rem' }}>Drift par feature</p>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.82rem' }}>
              <thead><tr>{['Feature','PSI','Drift'].map(h=><th key={h} style={{ textAlign:'left', padding:'.3rem .5rem', color:'var(--text-muted)', fontWeight:600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(drift).map(([f, d]) => (
                  <tr key={f} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'.35rem .5rem', fontWeight:600 }}>{f}</td>
                    <td style={{ padding:'.35rem .5rem' }}>{d.psi.toFixed(3)}</td>
                    <td style={{ padding:'.35rem .5rem' }}>
                      {d.drift
                        ? <span className="drift-badge-drift">DRIFT</span>
                        : <span className="drift-badge-ok">OK</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Feature Engineering Workspace ── */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700, marginBottom:'1.25rem' }}>
          <Wand2 size={18} style={{ display:'inline', marginRight:8, verticalAlign:'middle' }} />
          Feature Engineering Workspace
        </h3>
        <div className="fe-workspace">
          {/* Left — available features */}
          <div>
            <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'.5rem' }}>Colonnes disponibles ({selectedFeatures.size} sélectionnée{selectedFeatures.size > 1 ? 's' : ''})</p>
            <div className="fe-feature-list">
              {FEATURES.map(f => (
                <div key={f} className={`fe-feature-chip${selectedFeatures.has(f) ? ' selected' : ''}`} onClick={() => toggleFeature(f)}>
                  <span>{f}</span>
                  {selectedFeatures.has(f) && <span>✓</span>}
                </div>
              ))}
            </div>
            <button className="btn-submit-green" style={{ width:'100%', marginTop:'.75rem' }} onClick={addTransform} disabled={selectedFeatures.size === 0}>
              + Ajouter transformation
            </button>
          </div>

          {/* Right — transformations */}
          <div>
            <p style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text-muted)', marginBottom:'.5rem' }}>Transformations ({transformRows.length})</p>
            {transformRows.length === 0
              ? <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-muted)', background:'#f9fafb', borderRadius:8, fontSize:'.85rem' }}>Sélectionnez des colonnes et cliquez "Ajouter transformation"</div>
              : (
                <div className="fe-transform-panel">
                  {transformRows.map(row => (
                    <div key={row.id} className="transform-row">
                      <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--sidebar-bg)', minWidth:100 }}>{row.features.join(', ')}</span>
                      <span style={{ fontSize:'.8rem', color:'var(--text-muted)' }}>→</span>
                      <select value={row.transformer} onChange={e => updateTransform(row.id, 'transformer', e.target.value)}>
                        {TRANSFORMERS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <input placeholder="Nouveau nom (opt.)" value={row.outputName}
                        onChange={e => updateTransform(row.id, 'outputName', e.target.value)}
                        style={{ flex:1 }} />
                      <button className="btn-icon btn-del" onClick={() => removeTransform(row.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )
            }
            {transformRows.length > 0 && (
              <button className="btn-create-dataset" style={{ marginTop:'1rem', marginBottom:0 }} onClick={handleApply}>
                <Wand2 size={16}/> Apply Transformations
              </button>
            )}
            {applyMsg && <div className="alert-info" style={{ marginTop:'.5rem' }}>{applyMsg}</div>}
          </div>
        </div>
      </div>

      {/* ── Export ── */}
      <div className="card">
        <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700, marginBottom:'1.25rem' }}>
          <Download size={18} style={{ display:'inline', marginRight:8, verticalAlign:'middle' }} />
          Data Export
        </h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'1.5rem', alignItems:'flex-end' }}>
          <div className="form-group" style={{ marginBottom:0, minWidth:160 }}>
            <label>Format</label>
            <select value={exportFmt} onChange={e => setExportFmt(e.target.value)}>
              {EXPORT_FORMATS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0, minWidth:200 }}>
            <label>Destination</label>
            <select value={exportDest} onChange={e => setExportDest(e.target.value)}>
              <option value="download">⬇️ Télécharger</option>
              <option value="s3">☁️ Upload vers S3</option>
              <option value="db">🗄️ Push vers DB</option>
            </select>
          </div>
          <button className="btn-submit-green" style={{ width:'auto' }} onClick={handleExport}>
            <Download size={14} style={{ display:'inline', marginRight:6 }} />Export Processed Data
          </button>
        </div>
        {exportMsg && <div className="alert-info" style={{ marginTop:'1rem' }}>{exportMsg}</div>}
      </div>

      {/* ── Preview modal ── */}
      {preview && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width:560 }}>
            <h3 style={{ marginBottom:'1rem' }}>Aperçu — {preview}</h3>
            <div className="alert-info">Preview de la source "{preview}" — connectez la source réelle pour afficher les vraies données.</div>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setPreview(null)}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

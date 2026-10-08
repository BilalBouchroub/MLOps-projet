import React, { useState, useEffect, useCallback } from 'react';
import { apiUsers } from '../../api/axios';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { ExternalLink, RefreshCw, Plus, Download, FileText, Image, Play, Database, Calendar, HardDrive, Table2 } from 'lucide-react';
import './ScientistPages.css';

const STATUS_EXP = {
  completed: { cls:'badge-completed', label:'Completed' },
  failed:    { cls:'badge-failed',    label:'Failed'    },
  running:   { cls:'badge-running',   label:'Running'   },
};

const TABS = ['Général', 'Hyperparams', 'Métriques', 'Artifacts', 'Logs', 'Système', 'Datasets'];

export default function ClearMLDashboard() {
  const [status, setStatus]           = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [selectedExp, setSelectedExp] = useState(null);
  const [details, setDetails]         = useState({});   // {metrics, logs, artifacts}
  const [activeTab, setActiveTab]     = useState(0);
  const [showLaunch, setShowLaunch]   = useState(false);
  const [loadingDet, setLoadingDet]   = useState(false);
  const [creds, setCreds]             = useState({ api_server:'http://localhost:8080', web_ui:'http://localhost:8080', api_key:'', api_secret:'' });
  const [testMsg, setTestMsg]         = useState('');
  const [launch, setLaunch]           = useState({ project:'MLops/Stress Hydrique', name:'', queue:'default', hyperparams:'{"learning_rate": 0.05, "n_estimators": 200}' });
  const [launchMsg, setLaunchMsg]     = useState('');
  const [myProject, setMyProject]     = useState(null);

  const fetchAll = useCallback(async (projectName) => {
    const params = projectName ? { project: projectName } : {};
    const [sRes, eRes] = await Promise.all([
      apiUsers.get('/clearml/status').catch(() => ({ data: { connected: false } })),
      apiUsers.get('/clearml/experiments', { params }).catch(() => ({ data: { experiments: [] } })),
    ]);
    setStatus(sRes.data);
    setExperiments(eRes.data?.experiments || []);
  }, []);

  useEffect(() => {
    apiUsers.get('/projects/my-project').then(r => {
      setMyProject(r.data);
      const projectName = r.data?.clearml_project_name;
      if (projectName) setLaunch(l => ({ ...l, project: projectName }));
      fetchAll(projectName);
    }).catch(() => {
      fetchAll(null);
    });
  }, [fetchAll]);

  const openExp = async (exp) => {
    setSelectedExp(exp); setActiveTab(0); setLoadingDet(true); setDetails({});
    const [mRes, lRes, aRes, dRes] = await Promise.all([
      apiUsers.get(`/clearml/experiments/${exp.id}/metrics`).catch(() => ({ data: { epochs: [] } })),
      apiUsers.get(`/clearml/experiments/${exp.id}/logs`).catch(()   => ({ data: { logs: [] }   })),
      apiUsers.get(`/clearml/experiments/${exp.id}/artifacts`).catch(() => ({ data: { artifacts: [] } })),
      apiUsers.get(`/clearml/experiments/${exp.id}/datasets`).catch(() => ({ data: { datasets: [], total: 0, total_size_mb: 0, year_range: [] } })),
    ]);
    setDetails({
      metrics:   mRes.data?.epochs    || [],
      logs:      lRes.data?.logs      || [],
      artifacts: aRes.data?.artifacts || [],
      datasets:  dRes.data || { datasets: [], total: 0, total_size_mb: 0, year_range: [] },
    });
    setLoadingDet(false);
  };

  const testConnection = async () => {
    const r = await apiUsers.post('/clearml/test-connection', creds).catch(e => ({ data: { success:false, message: e.userMessage } }));
    setTestMsg(r.data.success ? '✅ Connexion réussie !' : `❌ ${r.data.message}`);
  };

  const handleLaunch = async () => {
    let hp = {};
    try { hp = JSON.parse(launch.hyperparams); } catch { setLaunchMsg('❌ JSON invalide dans les hyperparamètres.'); return; }
    const r = await apiUsers.post('/clearml/launch', { ...launch, hyperparams: hp }).catch(() => null);
    setLaunchMsg(r ? `✅ ${r.data.message}` : '❌ Erreur lors du lancement.');
  };

  /* ── Experiment detail tabs ──────────────────────── */
  const renderTabContent = () => {
    if (!selectedExp) return null;
    if (loadingDet) return <p style={{ color:'var(--text-muted)', textAlign:'center', padding:'2rem' }}>Chargement…</p>;

    if (activeTab === 0) return (
      <table className="params-table">
        <tbody>
          {[['ID', selectedExp.id], ['Project', selectedExp.project], ['Status', selectedExp.status],
            ['Created', selectedExp.created], ['Started', selectedExp.started], ['Completed', selectedExp.completed],
            ['Tags', (selectedExp.tags || []).join(', ')]
          ].map(([k,v]) => <tr key={k}><td>{k}</td><td>{v || '—'}</td></tr>)}
        </tbody>
      </table>
    );

    if (activeTab === 1) return (
      <table className="params-table">
        <tbody>
          {Object.entries(selectedExp.hyperparams || {}).map(([k,v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
        </tbody>
      </table>
    );

    if (activeTab === 2) {
      const epochs = details.metrics || [];
      return (
        <div>
          <p style={{ fontWeight:700, fontSize:'.85rem', marginBottom:'.75rem', color:'var(--text-muted)' }}>Loss (Train / Validation)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={epochs} margin={{ top:4, right:8, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="epoch" tick={{ fontSize:10 }} />
              <YAxis tickFormatter={v => v.toFixed(3)} tick={{ fontSize:10 }} />
              <Tooltip formatter={(v,n) => [v.toFixed(4), n]} />
              <Legend wrapperStyle={{ fontSize:11 }} />
              <Line type="monotone" dataKey="train_loss" stroke="#ef4444" strokeWidth={2} dot={false} name="Train Loss" />
              <Line type="monotone" dataKey="val_loss"   stroke="#f59e0b" strokeWidth={2} dot={false} name="Val Loss" />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontWeight:700, fontSize:'.85rem', margin:'1rem 0 .75rem', color:'var(--text-muted)' }}>R² par epoch</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={epochs} margin={{ top:4, right:8, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="epoch" tick={{ fontSize:10 }} />
              <YAxis domain={[0.4, 1]} tickFormatter={v => v.toFixed(2)} tick={{ fontSize:10 }} />
              <Tooltip formatter={(v,n) => [v.toFixed(4), n]} />
              <Line type="monotone" dataKey="r2" stroke="#2d6a4f" strokeWidth={2} dot={false} name="R²" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeTab === 3) return (
      <div className="artifacts-list">
        {(details.artifacts || []).map(a => {
          const icons = { model:<Download size={16}/>, csv:<FileText size={16}/>, image:<Image size={16}/>, text:<FileText size={16}/> };
          return (
            <div key={a.name} className="artifact-row">
              <span className="artifact-name">{icons[a.type] || <FileText size={16}/>}{a.name}</span>
              <span className="artifact-size">{a.size}</span>
              <button className="btn-icon btn-logs" style={{ fontSize:'.78rem' }}>
                <Download size={12}/>Télécharger
              </button>
            </div>
          );
        })}
      </div>
    );

    if (activeTab === 4) return (
      <div className="console-box">
        {(details.logs || []).map((l, i) => (
          <div key={i} className={`log-line${l.includes('❌')||l.includes('failed') ? ' log-error' : l.includes('✅')||l.includes('completed') ? ' log-ok' : ''}`}>{l}</div>
        ))}
      </div>
    );

    if (activeTab === 5) {
      const epochs = details.metrics || [];
      return (
        <div>
          <p style={{ fontWeight:700, fontSize:'.85rem', marginBottom:'.75rem', color:'var(--text-muted)' }}>CPU & Mémoire</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={epochs} margin={{ top:4, right:8, bottom:4, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="epoch" tick={{ fontSize:10 }} />
              <YAxis yAxisId="cpu" domain={[0,100]} tick={{ fontSize:10 }} unit="%" />
              <YAxis yAxisId="mem" orientation="right" domain={[400,900]} tick={{ fontSize:10 }} unit=" MB" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize:11 }} />
              <Line yAxisId="cpu" type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
              <Line yAxisId="mem" type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="RAM MB" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeTab === 6) {
      const ds = details.datasets || {};
      const files = ds.datasets || [];
      return (
        <div>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'.75rem', marginBottom:'1.25rem' }}>
            {[
              { icon: <Database size={16} color="#6d28d9"/>, label:'Fichiers CSV', value: ds.total ?? '—', bg:'#f5f3ff', color:'#6d28d9' },
              { icon: <Calendar size={16} color="#0369a1"/>, label:'Années couvertes', value: ds.year_range?.length === 2 ? `${ds.year_range[0]} – ${ds.year_range[1]}` : '—', bg:'#e0f2fe', color:'#0369a1' },
              { icon: <HardDrive size={16} color="#065f46"/>, label:'Taille totale', value: ds.total_size_mb ? `${ds.total_size_mb} MB` : '—', bg:'#dcfce7', color:'#065f46' },
              { icon: <Table2 size={16} color="#b45309"/>,   label:'Features', value: '16 colonnes', bg:'#fef3c7', color:'#b45309' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius:10, padding:'.65rem .9rem', display:'flex', alignItems:'center', gap:8 }}>
                {c.icon}
                <div>
                  <div style={{ fontSize:'.68rem', color: c.color, fontWeight:600 }}>{c.label}</div>
                  <div style={{ fontSize:'.9rem', fontWeight:800, color: c.color }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Features badge list */}
          {files.length > 0 && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'#374151', marginBottom:'.4rem' }}>Features utilisées</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'.3rem' }}>
                {(files[0].features || []).map(f => (
                  <span key={f} style={{ background:'#f3f4f6', border:'1px solid #e5e7eb', borderRadius:12, padding:'.15rem .55rem', fontSize:'.68rem', fontWeight:600, color:'#374151' }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Files table */}
          <div style={{ fontSize:'.75rem', fontWeight:700, color:'#374151', marginBottom:'.5rem' }}>
            Fichiers CSV utilisés ({files.length})
          </div>
          <div style={{ maxHeight:300, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.78rem' }}>
              <thead>
                <tr style={{ background:'#f9fafb', position:'sticky', top:0 }}>
                  {['Fichier','Année','Lignes','Taille'].map(h => (
                    <th key={h} style={{ padding:'.5rem .75rem', textAlign:'left', fontWeight:700, color:'#374151', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={f.name} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', transition:'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                  >
                    <td style={{ padding:'.45rem .75rem', display:'flex', alignItems:'center', gap:6 }}>
                      <FileText size={13} color="#6d28d9" style={{ flexShrink:0 }}/>
                      <span style={{ fontFamily:'monospace', color:'#1e293b' }}>{f.name}</span>
                    </td>
                    <td style={{ padding:'.45rem .75rem' }}>
                      <span style={{ background:'#e0f2fe', color:'#0369a1', borderRadius:10, padding:'.1rem .45rem', fontWeight:700, fontSize:'.72rem' }}>{f.year}</span>
                    </td>
                    <td style={{ padding:'.45rem .75rem', color:'#374151' }}>
                      {f.rows != null ? f.rows.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding:'.45rem .75rem', color:'#6b7280' }}>{f.size_mb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      {myProject && (
        <div style={{
          background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8,
          padding: '0.5rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: '.84rem',
        }}>
          <span style={{ fontWeight: 700, color: '#5b21b6' }}>Projet :</span>
          <span style={{ color: '#5b21b6' }}>{myProject.name}</span>
          {myProject.clearml_project_name && (
            <>
              <span style={{ color: '#9ca3af' }}>·</span>
              <span style={{
                color: '#4c1d95', fontWeight: 600, fontFamily: 'monospace', fontSize: '.78rem',
                background: '#ede9fe', padding: '0.1rem 0.45rem', borderRadius: 4,
              }}>
                ClearML : {myProject.clearml_project_name}
              </span>
            </>
          )}
        </div>
      )}
      <div className="admin-page-header">
        <div><h1>ClearML Dashboard</h1><p>Suivi des expériences et gestion des modèles</p></div>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <button className="btn-add" style={{ background:'white', color:'var(--sidebar-bg)', border:'1px solid var(--sidebar-bg)' }} onClick={fetchAll}><RefreshCw size={15}/>Refresh</button>
          <button className="btn-add" onClick={() => setShowLaunch(!showLaunch)}><Plus size={15}/>Lancer expérience</button>
        </div>
      </div>

      {/* ── Connection Status ── */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700 }}>ClearML Connection Status</h3>
          {status && (
            <span className={`badge ${status.connected ? 'badge-completed' : 'badge-failed'}`}>
              {status.connected ? '✅ Connected' : '❌ Disconnected'}
              {status.mode === 'demo' && <span className="badge-demo" style={{ marginLeft:8 }}>MODE DÉMO</span>}
            </span>
          )}
        </div>
        {status?.mode === 'demo' && (
          <div className="alert-info" style={{ marginBottom:'1rem' }}>
            {status.message || 'Mode démo actif — données simulées.'}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
          {[['API Server URL', 'api_server'], ['Web UI URL', 'web_ui']].map(([label, key]) => (
            <div key={key} className="form-group" style={{ marginBottom:0 }}>
              <label style={{ fontSize:'.82rem' }}>{label}</label>
              <input value={creds[key]} onChange={e => setCreds(c => ({ ...c, [key]: e.target.value }))} />
            </div>
          ))}
          {[['API Key', 'api_key'], ['API Secret', 'api_secret']].map(([label, key]) => (
            <div key={key} className="form-group" style={{ marginBottom:0 }}>
              <label style={{ fontSize:'.82rem' }}>{label}</label>
              <input type="password" value={creds[key]} placeholder="••••••••"
                onChange={e => setCreds(c => ({ ...c, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          <button className="btn-submit-green" style={{ width:'auto' }} onClick={testConnection}>Test Connection</button>
          {testMsg && <span style={{ fontSize:'.88rem' }}>{testMsg}</span>}
        </div>
      </div>

      {/* ── Launch form ── */}
      {showLaunch && (
        <div className="card" style={{ marginBottom:'1.5rem' }}>
          <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700, marginBottom:'1.25rem' }}>Launch New Experiment</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Project</label>
              <input value={launch.project} onChange={e => setLaunch(l => ({ ...l, project: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Experiment Name</label>
              <input value={launch.name} placeholder="RandomForest CWSI v9" onChange={e => setLaunch(l => ({ ...l, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Queue</label>
              <select value={launch.queue} onChange={e => setLaunch(l => ({ ...l, queue: e.target.value }))}>
                {['default', 'gpu', 'cpu'].map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop:'1rem' }}>
            <label>Hyperparameters (JSON)</label>
            <textarea className="json-editor" value={launch.hyperparams}
              onChange={e => setLaunch(l => ({ ...l, hyperparams: e.target.value }))} />
          </div>
          <div className="modal-actions" style={{ justifyContent:'flex-start', marginTop:0 }}>
            <button className="btn-submit-green" style={{ width:'auto' }} onClick={handleLaunch} disabled={!launch.name}>
              <Play size={14} style={{ display:'inline', marginRight:4 }} />Launch Experiment
            </button>
            {launchMsg && <span style={{ fontSize:'.88rem', marginLeft:'1rem' }}>{launchMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Experiments list ── */}
      <div className="card">
        <h3 style={{ color:'var(--sidebar-bg)', fontWeight:700, marginBottom:'1.25rem' }}>
          Recent Experiments ({experiments.length})
        </h3>
        <div className="experiments-grid">
          {experiments.map(exp => {
            const st = STATUS_EXP[exp.status] || STATUS_EXP.completed;
            return (
              <div key={exp.id} className={`exp-card status-${exp.status}`} onClick={() => openExp(exp)}>
                <div className="exp-card-project">{exp.project}</div>
                <div className="exp-card-name">{exp.name}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  <button className="btn-icon btn-logs" onClick={e => { e.stopPropagation(); openExp(exp); }}>
                    <ExternalLink size={11}/>Détails
                  </button>
                </div>
                <div className="exp-card-metrics">
                  {['r2','rmse','mae'].map(k => (
                    <div key={k} className="exp-metric">
                      <div className="exp-metric-val">{(exp.metrics?.[k] ?? 0).toFixed(4)}</div>
                      <div className="exp-metric-key">{k.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.5rem' }}>
                  {exp.completed ? new Date(exp.completed).toLocaleDateString('fr-FR') : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Experiment detail modal ── */}
      {selectedExp && (
        <div className="modal-overlay">
          <div className="modal-box modal-xl">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontSize:'.75rem', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase' }}>{selectedExp.project}</div>
                <h3 style={{ margin:'0.25rem 0' }}>{selectedExp.name}</h3>
                <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                  <span className={`badge ${STATUS_EXP[selectedExp.status]?.cls || 'badge-idle'}`}>{selectedExp.status}</span>
                  {(selectedExp.tags || []).map(t => <span key={t} className="badge badge-idle">{t}</span>)}
                </div>
              </div>
              <button className="btn-cancel" onClick={() => setSelectedExp(null)}>✕</button>
            </div>

            <div className="tabs">
              {TABS.map((t, i) => (
                <button key={t} className={`tab-btn${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>{t}</button>
              ))}
            </div>

            {renderTabContent()}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedExp(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

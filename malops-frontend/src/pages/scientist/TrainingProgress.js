import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiUsers } from '../../api/axios';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Square, RefreshCw, Loader2, CheckCircle2, Clock, Zap } from 'lucide-react';
import './ScientistPages.css';

const MODEL_COLORS = {
  RandomForest: '#16a34a',
  XGBoost:      '#d97706',
  LightGBM:     '#3b82f6',
  AdaBoost:     '#7c3aed',
  GRU:          '#db2777',
};

const POLL_RUNNING = 2000;
const POLL_IDLE    = 30000;

function LiveBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:'#dcfce7', color:'#15803d',
      padding:'.2rem .65rem', borderRadius:20, fontSize:'.72rem', fontWeight:700,
    }}>
      <span style={{
        width:7, height:7, borderRadius:'50%', background:'#16a34a',
        animation:'pulse-ring 1.2s ease-in-out infinite', display:'inline-block',
      }}/>
      LIVE
    </span>
  );
}

function StatBox({ label, value, sub, color='#1e40af' }) {
  return (
    <div style={{
      flex:1, background:'white', borderRadius:10, padding:'1rem 1.25rem',
      border:'1px solid #e5e7eb', textAlign:'center',
      boxShadow:'0 1px 3px rgba(0,0,0,.06)',
    }}>
      <div style={{ fontSize:'2rem', fontWeight:800, color, lineHeight:1 }}>{value ?? '—'}</div>
      <div style={{ fontWeight:700, fontSize:'.78rem', color:'#374151', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:'.7rem', color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function ModelChip({ name, state }) {
  const color = MODEL_COLORS[name] || '#6b7280';
  const bg    = state==='completed' ? `${color}20` : state==='running' ? `${color}15` : '#f3f4f6';
  const bdr   = state==='pending'   ? '#e5e7eb' : color;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6, padding:'.35rem .75rem',
      borderRadius:20, background:bg, border:`1.5px solid ${bdr}`,
      fontSize:'.78rem', fontWeight:700,
      color: state==='pending' ? '#9ca3af' : color,
    }}>
      {state==='running'   && <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/>}
      {state==='completed' && <CheckCircle2 size={11}/>}
      {state==='pending'   && <Clock size={11} color="#d1d5db"/>}
      {name}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'white', border:'1px solid #e5e7eb', borderRadius:8,
      padding:'.6rem .9rem', boxShadow:'0 4px 12px rgba(0,0,0,.1)', fontSize:'.78rem',
    }}>
      <div style={{ fontWeight:700, marginBottom:4, color:'#374151' }}>Epoch {label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color:p.color, fontWeight:600 }}>
          {p.dataKey}: {typeof p.value==='number' ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function TrainingProgress() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [stopping, setStopping] = useState(false);
  const [msg, setMsg]           = useState('');
  const pollRef                 = useRef(null);

  const fetchProgress = useCallback(async () => {
    try {
      const r = await apiUsers.get('/training/progress');
      setData(r.data);
    } catch(e) {
      setMsg(e.userMessage || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Adaptive polling speed
  useEffect(() => {
    clearInterval(pollRef.current);
    const ms = data?.status === 'running' ? POLL_RUNNING : POLL_IDLE;
    pollRef.current = setInterval(fetchProgress, ms);
    return () => clearInterval(pollRef.current);
  }, [data?.status, fetchProgress]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await apiUsers.post('/training/stop');
      setMsg('⛔ Entraînement arrêté.');
      fetchProgress();
    } catch(e) { setMsg(e.userMessage || 'Erreur stop'); }
    finally { setStopping(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:300, gap:12, color:'#6b7280' }}>
      <Loader2 size={24} style={{ animation:'spin 1s linear infinite' }}/>
      <span>Chargement du statut d'entraînement…</span>
    </div>
  );

  const d = data || {};
  const isRunning  = d.status === 'running';
  const completedN = d.completed_models?.length || 0;
  const queuedN    = d.queued_models?.length || 0;
  const epochHist  = d.epoch_history || [];
  const modelRes   = d.model_results || {};
  const sortedModels = Object.entries(modelRes).sort(([,a],[,b]) => b.r2 - a.r2);
  const bestName   = sortedModels[0]?.[0];

  const barData = sortedModels.map(([name, m]) => ({
    name, r2: +(m.r2 * 100).toFixed(2), isBest: name === bestName,
  }));

  // ETA helper
  const eta = (() => {
    if (!d.started_at || !isRunning || !d.progress_pct) return null;
    const elapsed  = (Date.now() - new Date(d.started_at).getTime()) / 1000;
    const pct = d.progress_pct / 100;
    if (pct <= 0.01) return null;
    const remaining = Math.round(elapsed / pct - elapsed);
    if (remaining <= 0) return 'Bientôt…';
    const m = Math.floor(remaining / 60), s = remaining % 60;
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
  })();

  return (
    <div>
      <style>{`
        @keyframes spin        { to{ transform:rotate(360deg); } }
        @keyframes pulse-ring  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }
        @keyframes slide-right { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
      `}</style>

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1>Training Progress</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            {isRunning
              ? `Entraînement en cours — modèle actif : ${d.current_model}`
              : d.status==='completed'
                ? `Terminé · Meilleur : ${bestName} (R²=${modelRes[bestName]?.r2?.toFixed(4)})`
                : 'Aucun entraînement actif — données du dernier run'}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {isRunning && <LiveBadge/>}
          {isRunning && (
            <button onClick={handleStop} disabled={stopping} style={{
              display:'flex', alignItems:'center', gap:6, padding:'.45rem 1.1rem',
              background:'#fef2f2', color:'#b91c1c', border:'1.5px solid #fca5a5',
              borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:'.85rem',
              opacity:stopping?.6:1,
            }}>
              <Square size={13}/>{stopping ? 'Arrêt…' : 'Stop Training'}
            </button>
          )}
          <button onClick={fetchProgress} style={{
            display:'flex', alignItems:'center', gap:5, padding:'.45rem .9rem',
            background:'white', border:'1px solid #e5e7eb', borderRadius:7,
            cursor:'pointer', fontWeight:600, fontSize:'.85rem', color:'#374151',
          }}>
            <RefreshCw size={13}/>Rafraîchir
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom:'1rem', padding:'.65rem 1rem', borderRadius:8,
          background:msg.includes('⛔')?'#fef2f2':'#f0fdf4',
          color:msg.includes('⛔')?'#991b1b':'#166534',
          fontSize:'.85rem', fontWeight:600 }}>{msg}</div>
      )}

      {/* ── Section 1 : Overall Progress ── */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h3 style={{ margin:0, color:'var(--sidebar-bg)' }}>Overall Progress</h3>
          <span style={{ fontWeight:800, fontSize:'1.5rem', color:'var(--sidebar-bg)' }}>
            {d.progress_pct ?? 0}%
          </span>
        </div>

        {/* Bar */}
        <div style={{ height:12, background:'#e5e7eb', borderRadius:20, marginBottom:'1.25rem', overflow:'hidden', position:'relative' }}>
          <div style={{
            height:'100%', borderRadius:20, transition:'width .6s ease',
            width:`${d.progress_pct ?? 0}%`,
            background:'linear-gradient(90deg,#2d6a4f,#40916c)',
            position:'relative', overflow:'hidden',
          }}>
            {isRunning && (
              <div style={{
                position:'absolute', inset:0,
                background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.35) 50%,transparent 100%)',
                animation:'slide-right 1.2s linear infinite',
              }}/>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
          <StatBox label="Completed"   value={completedN} color="#16a34a" sub={`sur ${completedN+queuedN+(isRunning?1:0)} modèles`}/>
          <StatBox label="In Progress" value={isRunning?1:0} color="#1e40af" sub={d.current_model||'—'}/>
          <StatBox label="Queued"      value={queuedN} color="#9ca3af" sub={d.queued_models?.slice(0,2).join(', ')||'—'}/>
        </div>

        {/* Chips */}
        <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
          {(d.completed_models||[]).map(n => <ModelChip key={n} name={n} state="completed"/>)}
          {isRunning && d.current_model && <ModelChip name={d.current_model} state="running"/>}
          {(d.queued_models||[]).map(n => <ModelChip key={n} name={n} state="pending"/>)}
        </div>
      </div>

      {/* ── Section 2 : Current Task (running only) ── */}
      {isRunning && (
        <div className="card" style={{ marginBottom:'1.25rem', borderColor:'#bfdbfe', borderWidth:2 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <h3 style={{ margin:0, color:'var(--sidebar-bg)' }}>Current Task Progress</h3>
            <LiveBadge/>
          </div>

          <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
            <StatBox label="Current Epoch"  value={d.current_epoch || 0}             color="#1e40af"/>
            <StatBox label="Total Epochs"   value={d.total_epochs  || '—'}            color="#1e40af"/>
            <StatBox label="R² Score"       value={d.r2   ? d.r2.toFixed(4)   : '…'} color="#16a34a"/>
            <StatBox label="RMSE"           value={d.rmse ? d.rmse.toFixed(4) : '…'} color="#d97706"/>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:'1.5rem', fontSize:'.85rem' }}>
            <span>
              <span style={{ color:'#6b7280' }}>Training: </span>
              <strong style={{ color:MODEL_COLORS[d.current_model]||'#374151' }}>{d.current_model}</strong>
            </span>
            {eta && (
              <span>
                <span style={{ color:'#6b7280' }}>ETA: </span>
                <strong>{eta}</strong>
              </span>
            )}
            <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
              <Zap size={14} color="#d97706"/>
              <span style={{ color:'#6b7280' }}>Session démarrée: </span>
              <strong>{d.started_at ? new Date(d.started_at).toLocaleTimeString('fr-FR') : '—'}</strong>
            </span>
          </div>

          {/* Epoch bar — only for GRU */}
          {d.total_epochs > 1 && d.current_epoch > 0 && (
            <div style={{ marginTop:'.75rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.72rem', color:'#9ca3af', marginBottom:3 }}>
                <span>Epoch {d.current_epoch} / {d.total_epochs}</span>
                <span>{Math.round((d.current_epoch/d.total_epochs)*100)}%</span>
              </div>
              <div style={{ height:6, background:'#dbeafe', borderRadius:20, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:20, transition:'width .4s',
                  width:`${(d.current_epoch/d.total_epochs)*100}%`,
                  background:'linear-gradient(90deg,#3b82f6,#6366f1)',
                }}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 3 : Charts ── */}
      {epochHist.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
          <div className="card">
            <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)', fontSize:'.95rem' }}>
              R² Score Evolution
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={epochHist} margin={{ top:5, right:15, bottom:5, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                <XAxis dataKey="epoch" tick={{ fontSize:11 }}/>
                <YAxis domain={[0.4,1.0]} tickFormatter={v=>v.toFixed(2)} tick={{ fontSize:11 }}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend iconSize={10} wrapperStyle={{ fontSize:'.78rem' }}/>
                {Object.keys(modelRes).map(name => (
                  <Line key={name} type="monotone" dataKey={name}
                    stroke={MODEL_COLORS[name]||'#8b5cf6'}
                    strokeWidth={2} dot={false} activeDot={{ r:4 }}/>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)', fontSize:'.95rem' }}>
              Model Comparison (R²)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top:5, right:15, bottom:25, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                <XAxis dataKey="name" tick={{ fontSize:11 }} angle={-15} textAnchor="end" interval={0}/>
                <YAxis domain={[90,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize:11 }}/>
                <Tooltip formatter={(v,n) => [`${v.toFixed(2)}%`, 'R² Score']}/>
                <Bar dataKey="r2" radius={[6,6,0,0]}>
                  {barData.map((b,i) => (
                    <Cell key={i} fill={b.isBest ? '#16a34a' : MODEL_COLORS[b.name]||'#6b7280'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p style={{ textAlign:'center', fontSize:'.71rem', color:'#9ca3af', margin:'.25rem 0 0' }}>
              🟩 Meilleur modèle
            </p>
          </div>
        </div>
      )}

      {/* ── Results table ── */}
      {sortedModels.length > 0 && (
        <div className="card">
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)', fontSize:'.95rem' }}>
            Résultats par modèle
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>{['Modèle','R²','RMSE','MAE','Statut'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sortedModels.map(([name, m]) => (
                  <tr key={name}>
                    <td style={{ fontWeight:700 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:10, height:10, borderRadius:'50%', background:MODEL_COLORS[name]||'#6b7280', display:'inline-block', flexShrink:0 }}/>
                        {name}
                        {name===bestName && (
                          <span style={{ fontSize:'.65rem', background:'#dcfce7', color:'#15803d', padding:'.1rem .4rem', borderRadius:10, fontWeight:700 }}>⭐ Best</span>
                        )}
                      </span>
                    </td>
                    <td style={{ fontWeight:700, color:'#15803d' }}>{m.r2?.toFixed(6)}</td>
                    <td>{m.rmse?.toFixed(6)}</td>
                    <td>{m.mae?.toFixed(6)}</td>
                    <td>
                      <span className={`badge ${
                        d.current_model===name    ? 'badge-running'   :
                        (d.completed_models||[]).includes(name) ? 'badge-completed' : 'badge-idle'}`}>
                        {d.current_model===name ? 'Running' :
                         (d.completed_models||[]).includes(name) ? 'Completed' : 'Idle'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

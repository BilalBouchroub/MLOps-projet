import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { apiUsers } from '../../api/axios';
import {
  Play, Square, Terminal, Code2, Save,
  ChevronRight, CheckCircle2, XCircle,
  Clock, Loader2, Zap, Database, Brain, Server,
  BarChart3, Shield, Box, RefreshCw, X,
} from 'lucide-react';
import { PipelineConfigUI } from './PipelineConfigs';
import './ScientistPages.css';

/* ── Type metadata ────────────────────────────────────────────────────────── */
const TYPE_META = {
  Orchestrator: { icon: <Zap size={13}/>,    bg: '#f5f3ff', fg: '#6d28d9' },
  Data:         { icon: <Database size={13}/>,bg: '#e0f2fe', fg: '#0369a1' },
  Validation:   { icon: <Shield size={13}/>,  bg: '#e0f2fe', fg: '#0369a1' },
  Training:     { icon: <Brain size={13}/>,   bg: '#dcfce7', fg: '#15803d' },
  Registry:     { icon: <Box size={13}/>,     bg: '#fef3c7', fg: '#b45309' },
  Serving:      { icon: <Server size={13}/>,  bg: '#fee2e2', fg: '#b91c1c' },
  Monitoring:   { icon: <BarChart3 size={13}/>,bg:'#fce7f3', fg: '#9d174d' },
};

const STATUS_COLORS = {
  Completed: '#10b981',
  Running:   '#3b82f6',
  Failed:    '#ef4444',
  Idle:      '#9ca3af',
  Queued:    '#f59e0b',
  pending:   '#d1d5db',
  running:   '#3b82f6',
  completed: '#10b981',
  failed:    '#ef4444',
};

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { icon: null, bg: '#f3f4f6', fg: '#374151' };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'.2rem .55rem',
      background: m.bg, color: m.fg, borderRadius:20, fontSize:'.7rem', fontWeight:700,
    }}>
      {m.icon}{type}
    </span>
  );
}

function StatusDot({ status, size = 8 }) {
  const color = STATUS_COLORS[status] || '#9ca3af';
  const pulse = status === 'running' || status === 'Running';
  return (
    <span style={{
      display:'inline-block', width:size, height:size, borderRadius:'50%',
      background: color, flexShrink:0,
      animation: pulse ? 'pulse-ring 1.2s ease-in-out infinite' : 'none',
    }}/>
  );
}

/* ── Step flow component ─────────────────────────────────────────────────── */
function StepFlow({ steps, stepsStatus = {}, compact = false }) {
  if (!steps?.length) return null;
  const nodes = steps.flatMap((step, i) => {
    const s = stepsStatus[step.id] || 'pending';
    const color = STATUS_COLORS[s] || '#d1d5db';
    const isRunning = s === 'running';
    const badge = (
      <div key={step.id} style={{
        display:'flex', alignItems:'center', gap:compact ? 3 : 5,
        padding: compact ? '.15rem .4rem' : '.3rem .65rem',
        background: s === 'completed' ? '#f0fdf4' : s === 'failed' ? '#fef2f2' : s === 'running' ? '#eff6ff' : '#f9fafb',
        border:`1.5px solid ${color}`, borderRadius:20,
        fontSize: compact ? '.67rem' : '.75rem', fontWeight:600,
        color: s === 'pending' ? '#9ca3af' : color,
        transition:'all .3s', whiteSpace:'nowrap',
      }}>
        {isRunning
          ? <Loader2 size={compact ? 9 : 11} style={{ animation:'spin 1s linear infinite', flexShrink:0 }} color={color}/>
          : s === 'completed' ? <CheckCircle2 size={compact ? 9 : 11} color={color} style={{ flexShrink:0 }}/>
          : s === 'failed'    ? <XCircle size={compact ? 9 : 11} color={color} style={{ flexShrink:0 }}/>
          : <Clock size={compact ? 9 : 11} color="#d1d5db" style={{ flexShrink:0 }}/>
        }
        {step.name}
      </div>
    );
    if (i < steps.length - 1) {
      return [badge, <ChevronRight key={`arr-${step.id}`} size={compact ? 10 : 13} color="#d1d5db" style={{ flexShrink:0 }}/>];
    }
    return [badge];
  });
  return (
    <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap: compact ? '.3rem' : '.5rem', marginTop: compact ? 0 : '.75rem' }}>
      {nodes}
    </div>
  );
}

/* ── Live Run Modal ──────────────────────────────────────────────────────── */
function RunModal({ pipeline, onClose }) {
  const [runData, setRunData] = useState(null);
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState('');
  const logsRef = useRef(null);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await apiUsers.get(`/clearml-pipelines/${pipeline.id}/run-status`);
      setRunData(r.data);
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
      if (r.data.status === 'completed' || r.data.status === 'failed') {
        clearInterval(pollRef.current);
      }
    } catch {}
  }, [pipeline.id]);

  useEffect(() => {
    const launch = async () => {
      try {
        await apiUsers.post(`/clearml-pipelines/${pipeline.id}/run`);
        setLaunched(true);
        pollRef.current = setInterval(fetchStatus, 1500);
        fetchStatus();
      } catch(e) {
        setError(e.userMessage || 'Erreur au lancement');
      }
    };
    launch();
    return () => clearInterval(pollRef.current);
  }, [pipeline.id, fetchStatus]);

  const handleStop = async () => {
    try {
      await apiUsers.post(`/clearml-pipelines/${pipeline.id}/stop`);
      fetchStatus();
    } catch(e) { setError(e.userMessage || 'Erreur stop'); }
  };

  const status = runData?.status || 'running';
  const stepsStatus = runData?.steps_status || {};
  const logs = runData?.logs || [];

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', paddingTop:'3vh' }}>
      <div style={{
        background:'#0f172a', borderRadius:14, width:'92vw', maxWidth:900,
        maxHeight:'91vh', display:'flex', flexDirection:'column',
        boxShadow:'0 30px 80px rgba(0,0,0,.5)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:'1rem 1.5rem', borderBottom:'1px solid #1e293b',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          background: '#0f172a',
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {status === 'running' && <Loader2 size={16} color="#60a5fa" style={{ animation:'spin 1s linear infinite' }}/>}
              {status === 'completed' && <CheckCircle2 size={16} color="#34d399"/>}
              {status === 'failed'    && <XCircle size={16} color="#f87171"/>}
              <span style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>
                {pipeline.name} {pipeline.subtitle && `— ${pipeline.subtitle}`}
              </span>
              <TypeBadge type={pipeline.type}/>
            </div>
            <div style={{ color:'#64748b', fontSize:'.78rem', marginTop:3 }}>
              {runData?.started_at
                ? `Démarré à ${new Date(runData.started_at).toLocaleTimeString('fr-FR')}`
                : 'Initialisation…'}
              {runData?.ended_at && ` · Terminé à ${new Date(runData.ended_at).toLocaleTimeString('fr-FR')}`}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {status === 'running' && (
              <button onClick={handleStop} style={{
                display:'flex', alignItems:'center', gap:5, padding:'.4rem 1rem',
                background:'#7f1d1d', color:'#fca5a5', border:'none', borderRadius:7,
                cursor:'pointer', fontWeight:600, fontSize:'.82rem',
              }}>
                <Square size={12}/>Arrêter
              </button>
            )}
            <button onClick={onClose} style={{
              background:'#1e293b', border:'none', borderRadius:7, padding:'.4rem .8rem',
              color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center',
            }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background:'#450a0a', color:'#fca5a5', padding:'.75rem 1.5rem', fontSize:'.83rem' }}>
            ❌ {error}
          </div>
        )}

        {/* Step cards */}
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #1e293b' }}>
          <div style={{
            display:'grid',
            gridTemplateColumns: `repeat(${Math.min(pipeline.steps.length, 5)}, 1fr)`,
            gap:'.6rem',
          }}>
            {pipeline.steps.map((step, i) => {
              const s = stepsStatus[step.id] || 'pending';
              const color = STATUS_COLORS[s] || '#d1d5db';
              const isRunning = s === 'running';
              return (
                <div key={step.id} style={{
                  background: s === 'completed' ? '#052e16' : s === 'failed' ? '#450a0a' : s === 'running' ? '#172554' : '#1e293b',
                  border:`1px solid ${s === 'pending' ? '#334155' : color}`,
                  borderRadius:8, padding:'.6rem .75rem',
                  transition:'all .4s',
                  position:'relative', overflow:'hidden',
                }}>
                  {isRunning && (
                    <div style={{
                      position:'absolute', top:0, left:0, width:'100%', height:2,
                      background:'linear-gradient(90deg,transparent,#60a5fa,transparent)',
                      animation:'slide-right 1.5s linear infinite',
                    }}/>
                  )}
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                    {isRunning
                      ? <Loader2 size={12} color="#60a5fa" style={{ animation:'spin 1s linear infinite' }}/>
                      : s === 'completed' ? <CheckCircle2 size={12} color="#34d399"/>
                      : s === 'failed'    ? <XCircle size={12} color="#f87171"/>
                      : <Clock size={12} color="#475569"/>
                    }
                    <span style={{ fontSize:'.68rem', fontWeight:700, color: s === 'pending' ? '#475569' : color }}>
                      {i + 1}
                    </span>
                  </div>
                  <div style={{ fontSize:'.73rem', color: s === 'pending' ? '#64748b' : '#e2e8f0', fontWeight:600, lineHeight:1.3 }}>
                    {step.name}
                  </div>
                  <div style={{ fontSize:'.65rem', color: color, marginTop:2, fontWeight:600 }}>
                    {s === 'pending' ? 'En attente' : s === 'running' ? 'En cours…' : s === 'completed' ? '✓ Terminé' : '✗ Échec'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Logs console */}
        <div style={{ flex:1, minHeight:0 }}>
          <div style={{
            background:'#020617', padding:'.5rem 1rem',
            display:'flex', alignItems:'center', gap:6,
            borderBottom:'1px solid #1e293b',
          }}>
            <Terminal size={12} color="#64748b"/>
            <span style={{ color:'#64748b', fontSize:'.72rem', fontWeight:600 }}>LOGS</span>
            {status === 'running' && (
              <span style={{
                marginLeft:'auto', fontSize:'.65rem', color:'#60a5fa',
                display:'flex', alignItems:'center', gap:4,
              }}>
                <StatusDot status="running" size={6}/>Live
              </span>
            )}
          </div>
          <div ref={logsRef} style={{
            fontFamily:"'Courier New',monospace", fontSize:'.75rem',
            padding:'1rem', overflowY:'auto', height:220,
            background:'#020617', color:'#94a3b8', lineHeight:1.6,
          }}>
            {logs.length === 0 && !launched && (
              <span style={{ color:'#475569' }}>Démarrage du pipeline…</span>
            )}
            {logs.map((l, i) => (
              <div key={i} style={{
                color: l.includes('ERROR') || l.includes('✗') || l.includes('❌') ? '#f87171'
                      : l.includes('✓') || l.includes('✅') || l.includes('terminé') ? '#34d399'
                      : l.includes('→') || l.includes('Lancement') ? '#60a5fa'
                      : '#94a3b8',
              }}>{l}</div>
            ))}
            {status === 'running' && (
              <div style={{ color:'#60a5fa', display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/>
                <span>Exécution en cours…</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:'.75rem 1.5rem', background:'#0f172a', borderTop:'1px solid #1e293b',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div style={{ fontSize:'.75rem', color:'#475569' }}>
            {runData?.run_id || ''}
          </div>
          <div style={{ fontSize:'.8rem', fontWeight:700,
            color: status === 'completed' ? '#34d399' : status === 'failed' ? '#f87171' : '#60a5fa',
          }}>
            {status === 'completed' ? '✅ Pipeline terminé avec succès'
              : status === 'failed' ? '❌ Échec du pipeline'
              : '⚡ Exécution en cours…'}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ConfigField kept for compatibility (not used directly — PipelineConfigs.js used instead) ── */
// eslint-disable-next-line no-unused-vars
function ConfigField({ field, value, onChange }) {
  const displayVal = value ?? field.default;

  if (field.type === 'slider') {
    const pct = field.max > field.min
      ? ((displayVal - field.min) / (field.max - field.min)) * 100
      : 0;
    return (
      <div style={{ marginBottom:'1.1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <span style={{ fontWeight:600, fontSize:'.85rem', color:'#111827' }}>{field.label}</span>
            {field.hint && <span style={{ fontSize:'.73rem', color:'#9ca3af', marginLeft:6 }}>{field.hint}</span>}
          </div>
          <input
            type="number" value={displayVal}
            step={field.step} min={field.min} max={field.max}
            onChange={e => onChange(field.key, parseFloat(e.target.value) || field.default)}
            style={{
              width:80, textAlign:'center', border:'1px solid #d1d5db', borderRadius:6,
              fontSize:'.85rem', fontWeight:700, padding:'.2rem .4rem', color:'#1e40af',
            }}
          />
        </div>
        <div style={{ position:'relative', height:6, background:'#e5e7eb', borderRadius:20 }}>
          <div style={{
            position:'absolute', left:0, top:0, height:'100%', borderRadius:20,
            width:`${pct}%`, background:'linear-gradient(90deg,#3b82f6,#6366f1)',
            transition:'width .15s',
          }}/>
          <input
            type="range" min={field.min} max={field.max} step={field.step}
            value={displayVal}
            onChange={e => onChange(field.key, parseFloat(e.target.value))}
            style={{
              position:'absolute', top:-4, left:0, width:'100%', height:14,
              opacity:0, cursor:'pointer',
            }}
          />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.65rem', color:'#9ca3af', marginTop:2 }}>
          <span>{field.min}</span><span>{field.max}</span>
        </div>
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:'.85rem', color:'#111827' }}>{field.label}</div>
          {field.hint && <div style={{ fontSize:'.73rem', color:'#9ca3af' }}>{field.hint}</div>}
        </div>
        <input
          type="number" value={displayVal}
          onChange={e => onChange(field.key, parseInt(e.target.value, 10) || field.default)}
          style={{
            width:100, textAlign:'right', border:'1px solid #d1d5db', borderRadius:6,
            fontSize:'.9rem', fontWeight:700, padding:'.35rem .6rem', color:'#1e40af',
          }}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:'.85rem', color:'#111827' }}>{field.label}</div>
          {field.hint && <div style={{ fontSize:'.73rem', color:'#9ca3af' }}>{field.hint}</div>}
        </div>
        <select
          value={displayVal}
          onChange={e => onChange(field.key, parseInt(e.target.value, 10) || e.target.value)}
          style={{
            border:'1px solid #d1d5db', borderRadius:6, padding:'.35rem .6rem',
            fontSize:'.85rem', fontWeight:600, color:'#1e40af', background:'white',
          }}
        >
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'.85rem' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:'.85rem', color:'#111827' }}>{field.label}</div>
          {field.hint && <div style={{ fontSize:'.73rem', color:'#9ca3af' }}>{field.hint}</div>}
        </div>
        <button
          onClick={() => onChange(field.key, !displayVal)}
          style={{
            width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
            background: displayVal ? '#3b82f6' : '#d1d5db', position:'relative',
            transition:'background .2s', flexShrink:0,
          }}
        >
          <div style={{
            position:'absolute', top:2, left: displayVal ? 22 : 2,
            width:20, height:20, borderRadius:'50%', background:'white',
            transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
          }}/>
        </button>
      </div>
    );
  }

  // text
  return (
    <div style={{ marginBottom:'1rem' }}>
      <div style={{ fontWeight:600, fontSize:'.85rem', color:'#111827', marginBottom:4 }}>{field.label}</div>
      {field.hint && <div style={{ fontSize:'.73rem', color:'#9ca3af', marginBottom:4 }}>{field.hint}</div>}
      <input
        type="text" value={displayVal}
        onChange={e => onChange(field.key, e.target.value)}
        style={{
          width:'100%', border:'1px solid #d1d5db', borderRadius:7, padding:'.45rem .75rem',
          fontSize:'.85rem', boxSizing:'border-box',
        }}
      />
    </div>
  );
}

function PipelineEditModal({ pipeline, onClose }) {
  const [tab, setTab]         = useState('params');
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  // code editor state
  const [script, setScript]   = useState('');
  const [codeLoading, setCL]  = useState(false);
  const scriptRef             = useRef('');

  useEffect(() => {
    const cfgKey = pipeline.id.startsWith('pipeline-') ? pipeline.id.replace('pipeline-', '') : pipeline.id;
    Promise.all([
      apiUsers.get(`/clearml-pipelines/${pipeline.id}/config`).catch(() => ({ data: { values: {} } })),
      apiUsers.get('/pipelines/config').catch(() => ({ data: {} })),
    ]).then(([clearmlRes, cfgRes]) => {
      const clearmlVals = clearmlRes.data.values || {};
      const savedVals   = (cfgRes.data || {})[cfgKey] || {};
      setValues({ ...clearmlVals, ...savedVals });
      setLoading(false);
    });
  }, [pipeline.id]);

  useEffect(() => {
    if (tab === 'code' && !script) {
      setCL(true);
      apiUsers.get(`/clearml-pipelines/${pipeline.id}/script`)
        .then(r => { const s = r.data.script || ''; setScript(s); scriptRef.current = s; setCL(false); })
        .catch(() => { setScript('# Erreur chargement'); setCL(false); });
    }
  }, [tab, pipeline.id, script]);

  const handleChange = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const saveParams = async () => {
    setSaving(true);
    const cfgKey = pipeline.id.startsWith('pipeline-') ? pipeline.id.replace('pipeline-', '') : pipeline.id;
    try {
      const r = await apiUsers.put(`/clearml-pipelines/${pipeline.id}/config`, { values });
      await apiUsers.post('/pipelines/config', { [cfgKey]: values });
      setMsg(`✅ ${r.data.message}`);
      setTimeout(() => setMsg(''), 4000);
    } catch(e) { setMsg(`❌ ${e.userMessage || 'Erreur sauvegarde'}`); }
    finally { setSaving(false); }
  };

  const saveCode = async () => {
    setSaving(true);
    try {
      await apiUsers.put(`/clearml-pipelines/${pipeline.id}/script`, { script: scriptRef.current });
      setMsg('✅ Script sauvegardé');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg(`❌ ${e.userMessage || 'Erreur'}`); }
    finally { setSaving(false); }
  };

  const handleCodeChange = (v) => { const val = v||''; setScript(val); scriptRef.current = val; };

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', paddingTop:'1vh' }}>
      <div style={{
        background:'white', borderRadius:14,
        width: tab === 'code' ? '98vw' : '92vw',
        maxWidth: tab === 'code' ? 1400 : 1000,
        height: tab === 'code' ? '97vh' : 'auto',
        maxHeight: tab === 'code' ? '97vh' : '94vh',
        display:'flex', flexDirection:'column',
        boxShadow:'0 30px 70px rgba(0,0,0,.2)',
        transition:'width .2s, max-width .2s',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'1rem 1.5rem', borderBottom:'1px solid #e5e7eb',
          background:'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius:'14px 14px 0 0',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>
              ✏️ {pipeline.name} {pipeline.subtitle && `— ${pipeline.subtitle}`}
            </div>
            <TypeBadge type={pipeline.type}/>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {msg && (
              <span style={{
                fontSize:'.8rem', fontWeight:600, padding:'.3rem .7rem', borderRadius:20,
                background: msg.includes('✅') ? '#052e16' : '#450a0a',
                color: msg.includes('✅') ? '#4ade80' : '#f87171',
              }}>{msg}</span>
            )}
            <button onClick={onClose} style={{
              background:'rgba(255,255,255,.1)', border:'none', borderRadius:7,
              padding:'.4rem .75rem', cursor:'pointer', color:'white', fontWeight:600,
            }}>✕ Fermer</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display:'flex', borderBottom:'1px solid #e5e7eb',
          background:'#f9fafb',
        }}>
          {true && (
            <button onClick={() => setTab('params')} style={{
              padding:'.65rem 1.25rem', border:'none', background:'none', cursor:'pointer',
              fontWeight:600, fontSize:'.85rem',
              color: tab === 'params' ? '#6d28d9' : '#6b7280',
              borderBottom: tab === 'params' ? '2px solid #6d28d9' : '2px solid transparent',
              transition:'all .15s',
            }}>
              ⚙️ Paramètres
            </button>
          )}
          <button onClick={() => setTab('code')} style={{
            padding:'.65rem 1.25rem', border:'none', background:'none', cursor:'pointer',
            fontWeight:600, fontSize:'.85rem',
            color: tab === 'code' ? '#6d28d9' : '#6b7280',
            borderBottom: tab === 'code' ? '2px solid #6d28d9' : '2px solid transparent',
            transition:'all .15s',
          }}>
            {'</>'}  Code Python
          </button>
          <button onClick={() => setTab('steps')} style={{
            padding:'.65rem 1.25rem', border:'none', background:'none', cursor:'pointer',
            fontWeight:600, fontSize:'.85rem',
            color: tab === 'steps' ? '#6d28d9' : '#6b7280',
            borderBottom: tab === 'steps' ? '2px solid #6d28d9' : '2px solid transparent',
          }}>
            📋 Étapes
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>

          {/* ── Params tab ── */}
          {tab === 'params' && (
            <div style={{ flex:1, overflow:'auto', padding:'1.5rem' }}>
              {loading ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#6b7280' }}>
                  <Loader2 size={22} style={{ animation:'spin 1s linear infinite' }}/>
                  <p style={{ marginTop:8 }}>Chargement de la configuration…</p>
                </div>
              ) : (
                <PipelineConfigUI
                  pipeline={pipeline}
                  values={values}
                  onChange={handleChange}
                />
              )}
            </div>
          )}

          {/* ── Code tab ── */}
          {tab === 'code' && (
            <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
              <div style={{
                background:'#1e1e2e', color:'#a0aec0', fontSize:'.73rem',
                padding:'.5rem 1.5rem', display:'flex', gap:'2rem',
                alignItems:'center', flexShrink:0,
              }}>
                <span>💡 <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px', fontSize:'.7rem' }}>Ctrl+S</kbd> Sauvegarder</span>
                <span>🔍 <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px', fontSize:'.7rem' }}>Ctrl+F</kbd> Chercher</span>
                <span>⌨️ <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px', fontSize:'.7rem' }}>Ctrl+/</kbd> Commenter</span>
                <span style={{ marginLeft:'auto', color:'#64748b', fontFamily:'monospace', fontSize:'.72rem' }}>
                  📄 {pipeline.script}
                </span>
              </div>
              <div style={{ flex:1, minHeight:0 }}>
                {codeLoading
                  ? (
                    <div style={{
                      height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                      background:'#1e1e1e', color:'#64748b', flexDirection:'column', gap:12,
                    }}>
                      <Loader2 size={24} style={{ animation:'spin 1s linear infinite', color:'#60a5fa' }}/>
                      <span style={{ fontSize:'.85rem' }}>Chargement du script…</span>
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      defaultLanguage="python"
                      theme="vs-dark"
                      value={script}
                      onChange={handleCodeChange}
                      onMount={(editor, monaco) => {
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveCode);
                        // Better font and layout on mount
                        editor.updateOptions({ fontSize: 14, lineHeight: 22 });
                        editor.layout();
                      }}
                      options={{
                        fontSize: 14,
                        lineHeight: 22,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                        fontLigatures: true,
                        minimap: { enabled: true, scale: 1 },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        folding: true,
                        bracketPairColorization: { enabled: true },
                        renderLineHighlight: 'all',
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        formatOnPaste: true,
                        padding: { top: 12, bottom: 12 },
                      }}
                    />
                  )
                }
              </div>
            </div>
          )}

          {/* ── Steps tab ── */}
          {tab === 'steps' && (
            <div style={{ flex:1, overflow:'auto', padding:'1.5rem' }}>
              <p style={{ fontSize:'.83rem', color:'#6b7280', marginBottom:'1rem' }}>
                Étapes définies pour ce pipeline. La modification de l'ordre se fait dans le code.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                {pipeline.steps.map((step, i) => (
                  <div key={step.id} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'.65rem 1rem',
                    background:'white', borderRadius:8, border:'1px solid #e5e7eb',
                  }}>
                    <div style={{
                      width:28, height:28, borderRadius:'50%',
                      background:`linear-gradient(135deg,${pipeline.color || '#6d28d9'},${pipeline.color || '#6d28d9'}88)`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'white', fontWeight:700, fontSize:'.75rem', flexShrink:0,
                    }}>{i+1}</div>
                    <span style={{ flex:1, fontWeight:600, fontSize:'.9rem' }}>{step.name}</span>
                    <span style={{
                      fontSize:'.68rem', color:'#6b7280', background:'#f3f4f6',
                      padding:'.15rem .5rem', borderRadius:10, fontFamily:'monospace',
                    }}>{step.queue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with save button */}
        <div style={{
          padding:'.85rem 1.5rem', borderTop:'1px solid #e5e7eb', background:'#f9fafb',
          display:'flex', justifyContent:'flex-end', gap:'.75rem', borderRadius:'0 0 14px 14px',
        }}>
          <button onClick={onClose} style={{
            padding:'.45rem 1.1rem', border:'1px solid #d1d5db', borderRadius:7,
            background:'white', cursor:'pointer', fontWeight:600, color:'#374151', fontSize:'.85rem',
          }}>Annuler</button>
          {tab === 'params' && (
            <button onClick={saveParams} disabled={saving} style={{
              display:'flex', alignItems:'center', gap:6, padding:'.45rem 1.25rem',
              background:'#6d28d9', color:'white', border:'none', borderRadius:7,
              cursor:'pointer', fontWeight:700, fontSize:'.85rem', opacity: saving ? 0.6 : 1,
            }}>
              <Save size={14}/>{saving ? 'Application…' : 'Appliquer au script'}
            </button>
          )}
          {tab === 'code' && (
            <button onClick={saveCode} disabled={saving} style={{
              display:'flex', alignItems:'center', gap:6, padding:'.45rem 1.25rem',
              background:'#6d28d9', color:'white', border:'none', borderRadius:7,
              cursor:'pointer', fontWeight:700, fontSize:'.85rem', opacity: saving ? 0.6 : 1,
            }}>
              <Save size={14}/>{saving ? 'Sauvegarde…' : 'Sauvegarder le script'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Code editor modal (standalone "Code" button) ────────────────────────── */
function CodeModal({ pipeline, onClose }) {
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const scriptRef             = useRef('');

  useEffect(() => {
    apiUsers.get(`/clearml-pipelines/${pipeline.id}/script`)
      .then(r => { const s = r.data.script || ''; setScript(s); scriptRef.current = s; setLoading(false); })
      .catch(() => { setScript('# Erreur chargement'); setLoading(false); });
  }, [pipeline.id]);

  const handleChange = (v) => { const val = v||''; setScript(val); scriptRef.current = val; };

  const save = async () => {
    setSaving(true);
    try {
      await apiUsers.put(`/clearml-pipelines/${pipeline.id}/script`, { script: scriptRef.current });
      setMsg('✅ Sauvegardé');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) { setMsg(`❌ ${e.userMessage || 'Erreur'}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', padding:0 }}>
      <div style={{
        width:'100vw', height:'100vh',
        display:'flex', flexDirection:'column',
        background:'#0f172a',
      }}>
        {/* Header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'.65rem 1.25rem', background:'#1e293b',
          borderBottom:'1px solid #334155', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Code2 size={16} color="#818cf8"/>
            <span style={{ color:'white', fontWeight:700, fontSize:'.92rem' }}>
              {pipeline.name}{pipeline.subtitle ? ` — ${pipeline.subtitle}` : ''}
            </span>
            <TypeBadge type={pipeline.type}/>
            <span style={{ color:'#64748b', fontSize:'.75rem', fontFamily:'monospace', marginLeft:4 }}>
              {pipeline.script}
            </span>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {msg && (
              <span style={{
                fontSize:'.78rem', fontWeight:600, padding:'.25rem .7rem', borderRadius:20,
                background: msg.includes('✅') ? '#052e16' : '#450a0a',
                color: msg.includes('✅') ? '#4ade80' : '#f87171',
              }}>{msg}</span>
            )}
            <button onClick={save} disabled={saving} style={{
              display:'flex', alignItems:'center', gap:5, padding:'.4rem 1rem',
              background:'#6d28d9', color:'white', border:'none', borderRadius:6,
              cursor:'pointer', fontWeight:700, fontSize:'.82rem', opacity: saving ? 0.6 : 1,
            }}>
              <Save size={13}/>{saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button onClick={onClose} style={{
              background:'#334155', border:'none', borderRadius:6,
              padding:'.4rem .8rem', cursor:'pointer', color:'#94a3b8', fontWeight:600,
            }}>✕ Fermer</button>
          </div>
        </div>

        {/* Tips bar */}
        <div style={{
          background:'#1e1e2e', color:'#64748b', fontSize:'.72rem',
          padding:'.35rem 1.25rem', display:'flex', gap:'1.5rem',
          alignItems:'center', flexShrink:0, borderBottom:'1px solid #1e293b',
        }}>
          <span>💡 <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px' }}>Ctrl+S</kbd> Sauvegarder</span>
          <span>🔍 <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px' }}>Ctrl+F</kbd> Chercher</span>
          <span>⌨️ <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px' }}>Ctrl+/</kbd> Commenter</span>
          <span>📋 <kbd style={{ background:'#334155', borderRadius:3, padding:'1px 5px' }}>Ctrl+Z</kbd> Annuler</span>
        </div>

        {/* Editor — takes ALL remaining space */}
        <div style={{ flex:1, minHeight:0 }}>
          {loading ? (
            <div style={{
              height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
              flexDirection:'column', gap:12, color:'#64748b',
            }}>
              <Loader2 size={28} style={{ animation:'spin 1s linear infinite', color:'#818cf8' }}/>
              <span>Chargement de {pipeline.script}…</span>
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={script}
              onChange={handleChange}
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
                editor.layout();
              }}
              options={{
                fontSize: 15,
                lineHeight: 24,
                fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Menlo,monospace",
                fontLigatures: true,
                minimap: { enabled: true, scale: 1 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
                folding: true,
                bracketPairColorization: { enabled: true },
                renderLineHighlight: 'all',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                padding: { top: 16, bottom: 16 },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pipeline Chain (nœuds liés) ────────────────────────────────────────── */
function PipelineChain({ pipelines, onRun, onEdit, onCode }) {
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded]     = useState(false);

  const selected    = pipelines.find(p => p.id === selectedId);
  const run         = selected?.current_run;
  const isRunning   = run?.status === 'running';
  const stepsStatus = run?.steps_status || {};

  useEffect(() => { setExpanded(false); }, [selectedId]);

  if (!pipelines.length) return null;

  const selectNode = (id) => setSelectedId(prev => prev === id ? null : id);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.82rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={14} color="#6d28d9"/>Chaîne de Pipelines
        </span>
        <span style={{ fontSize: '.7rem', color: '#9ca3af' }}>— Cliquer sur un nœud pour afficher les détails</span>
      </div>

      {/* Scrollable chain strip */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)', padding: '1.25rem 1.5rem',
        overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
          {pipelines.flatMap((p, i) => {
            const meta      = TYPE_META[p.type] || { bg: '#f3f4f6', fg: '#374151', icon: null };
            const isSel     = p.id === selectedId;
            const pRunning  = p.current_run?.status === 'running';
            const statusClr = STATUS_COLORS[pRunning ? 'Running' : p.status] || '#9ca3af';
            const nodeColor = p.color || '#6d28d9';

            const node = (
              <div
                key={p.id}
                onClick={() => selectNode(p.id)}
                title={p.name + (p.subtitle ? ` — ${p.subtitle}` : '')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', userSelect: 'none', transition: 'transform .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: isSel ? nodeColor : meta.bg,
                  border: `2.5px solid ${isSel ? nodeColor : (pRunning ? statusClr : '#e5e7eb')}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  boxShadow: isSel ? `0 0 0 4px ${nodeColor}22` : 'none',
                  transition: 'all .2s',
                }}>
                  <div style={{ position: 'absolute', top: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: statusClr, border: '2px solid white' }}/>
                  {meta.icon
                    ? React.cloneElement(meta.icon, { size: 20, color: isSel ? 'white' : meta.fg })
                    : <Zap size={20} color={isSel ? 'white' : '#374151'}/>
                  }
                </div>
                <div style={{ marginTop: 5, textAlign: 'center', width: 68 }}>
                  <div style={{ fontSize: '.63rem', fontWeight: 700, lineHeight: 1.2, color: isSel ? nodeColor : '#374151', wordBreak: 'break-word' }}>
                    {p.name.length > 16 ? p.name.slice(0, 14) + '…' : p.name}
                  </div>
                  {p.subtitle && (
                    <div style={{ fontSize: '.58rem', color: '#9ca3af', marginTop: 1 }}>
                      {p.subtitle.length > 12 ? p.subtitle.slice(0, 10) + '…' : p.subtitle}
                    </div>
                  )}
                </div>
              </div>
            );

            if (i < pipelines.length - 1) {
              return [node, (
                <div key={`arr-${p.id}`} style={{ display: 'flex', alignItems: 'center', padding: '0 6px', marginBottom: 22, flexShrink: 0 }}>
                  <div style={{ width: 18, height: 1.5, background: '#d1d5db' }}/>
                  <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid #d1d5db' }}/>
                </div>
              )];
            }
            return [node];
          })}
        </div>
      </div>

      {/* Detail panel for selected node */}
      {selected && (
        <div key={selected.id} style={{
          marginTop: '.6rem', background: 'white', borderRadius: 12,
          border: `1px solid ${selected.color || '#e5e7eb'}`,
          borderLeft: `4px solid ${selected.color || '#6d28d9'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,.08)', overflow: 'hidden',
          animation: 'fadeIn .18s ease',
        }}>
          {isRunning && (
            <div style={{ height: 3, background: '#dbeafe', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', height: '100%', width: '40%', background: 'linear-gradient(90deg,transparent,#3b82f6,transparent)', animation: 'slide-right 1.5s linear infinite' }}/>
            </div>
          )}

          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#111827' }}>{selected.name}</div>
                {selected.subtitle && <div style={{ fontSize: '.76rem', color: '#6b7280', marginTop: 2 }}>{selected.subtitle}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <TypeBadge type={selected.type}/>
                <StatusDot status={isRunning ? 'running' : selected.status}/>
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: STATUS_COLORS[isRunning ? 'Running' : selected.status] || '#9ca3af' }}>
                  {isRunning ? 'Running' : selected.status}
                </span>
                <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', borderRadius: 4 }}>
                  <X size={14}/>
                </button>
              </div>
            </div>

            <div style={{ fontSize: '.78rem', color: '#6b7280', marginBottom: '.6rem', lineHeight: 1.4 }}>{selected.description}</div>

            <StepFlow steps={selected.steps} stepsStatus={isRunning ? stepsStatus : {}} compact/>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '.6rem', fontSize: '.72rem', color: '#9ca3af' }}>
              <span>{selected.steps.length} étapes</span>
              {selected.last_run && <span>Dernier run : {new Date(selected.last_run).toLocaleDateString('fr-FR')}</span>}
              {selected.clearml_task_id && <span style={{ color: '#6d28d9' }}>ClearML ✓</span>}
            </div>

            <div style={{ display: 'flex', gap: '.4rem', marginTop: '.8rem', flexWrap: 'wrap' }}>
              {isRunning ? (
                <button onClick={() => onRun(selected)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '.3rem .75rem', background: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                  <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }}/>Voir état
                </button>
              ) : (
                <button onClick={() => onRun(selected)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '.3rem .75rem', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                  <Play size={11}/>Lancer
                </button>
              )}
              <button onClick={() => onEdit(selected)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '.3rem .75rem', background: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                <Save size={11}/>Modifier
              </button>
              <button onClick={() => onCode(selected)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '.3rem .75rem', background: '#f5f3ff', color: '#6d28d9', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                <Code2 size={11}/>Code
              </button>
              <button onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '.3rem .75rem', background: '#f9fafb', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '.78rem' }}>
                <Terminal size={11}/>{expanded ? 'Masquer' : 'Détails'}
              </button>
            </div>
          </div>

          {expanded && (
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '1rem 1.25rem', background: '#fafafa' }}>
              <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#374151', marginBottom: '.5rem' }}>Étapes du pipeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {selected.steps.map((step, i) => {
                  const s = stepsStatus[step.id] || 'idle';
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '.4rem .65rem', background: 'white', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: '.8rem' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ flex: 1, fontWeight: 500 }}>{step.name}</span>
                      <span style={{ fontSize: '.65rem', color: '#9ca3af', background: '#f3f4f6', padding: '.1rem .4rem', borderRadius: 10 }}>{step.queue}</span>
                      {s !== 'idle' && <StatusDot status={s} size={7}/>}
                    </div>
                  );
                })}
              </div>
              {selected.clearml_task_id && (
                <div style={{ fontSize: '.73rem', color: '#6b7280', display: 'flex', gap: '1rem', marginTop: '.75rem' }}>
                  <span>ClearML ID: <code style={{ background: '#f3f4f6', padding: '.1rem .3rem', borderRadius: 3 }}>{selected.clearml_task_id}</code></span>
                  {selected.clearml_status && <span>Statut ClearML: <strong>{selected.clearml_status}</strong></span>}
                </div>
              )}
              {run?.logs?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.8rem', color: '#374151', margin: '.75rem 0 .4rem' }}>Derniers logs</div>
                  <div style={{ background: '#0d1117', color: '#58d68d', fontFamily: "'Courier New',monospace", fontSize: '.72rem', padding: '.75rem', borderRadius: 7, maxHeight: 140, overflowY: 'auto', lineHeight: 1.6 }}>
                    {run.logs.slice(-20).map((l, idx) => (
                      <div key={idx} style={{ color: l.includes('✗') || l.includes('ERROR') ? '#ff6b6b' : l.includes('✓') || l.includes('✅') ? '#58d68d' : '#94a3b8' }}>{l}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pipeline card ───────────────────────────────────────────────────────── */
function PipelineCard({ pipeline, onRun, onEdit, onCode, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const run = pipeline.current_run;
  const isRunning = run?.status === 'running';
  const stepsStatus = run?.steps_status || {};

  const lastStatus = pipeline.status || 'Idle';
  const borderColor = STATUS_COLORS[lastStatus] || '#e5e7eb';

  return (
    <div style={{
      background:'white', borderRadius:12, overflow:'hidden',
      boxShadow:'0 1px 4px rgba(0,0,0,.08)',
      border:`1px solid ${isRunning ? borderColor : '#e5e7eb'}`,
      borderLeft:`4px solid ${pipeline.color || borderColor}`,
      transition:'box-shadow .2s, border-color .3s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.13)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'}
    >
      {/* Running progress bar */}
      {isRunning && (
        <div style={{ height:3, background:'#dbeafe', position:'relative', overflow:'hidden' }}>
          <div style={{
            position:'absolute', height:'100%', width:'40%',
            background:'linear-gradient(90deg,transparent,#3b82f6,transparent)',
            animation:'slide-right 1.5s linear infinite',
          }}/>
        </div>
      )}

      <div style={{ padding:'1rem 1.1rem' }}>
        {/* Header row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.5rem' }}>
          <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
            <div style={{ fontWeight:700, fontSize:'.92rem', color:'#111827', lineHeight:1.2 }}>
              {pipeline.name}
            </div>
            {pipeline.subtitle && (
              <div style={{ fontSize:'.75rem', color:'#6b7280', fontWeight:500, marginTop:2 }}>
                {pipeline.subtitle}
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
            <TypeBadge type={pipeline.type}/>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <StatusDot status={isRunning ? 'running' : lastStatus}/>
              <span style={{
                fontSize:'.68rem', fontWeight:700,
                color: STATUS_COLORS[isRunning ? 'Running' : lastStatus] || '#9ca3af',
              }}>
                {isRunning ? 'Running' : lastStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize:'.78rem', color:'#6b7280', marginBottom:'.6rem', lineHeight:1.4 }}>
          {pipeline.description}
        </div>

        {/* Step mini-flow */}
        <StepFlow
          steps={pipeline.steps}
          stepsStatus={isRunning ? stepsStatus : {}}
          compact
        />

        {/* Stats row */}
        <div style={{ display:'flex', gap:'1rem', marginTop:'.6rem', fontSize:'.72rem', color:'#9ca3af' }}>
          <span>{pipeline.steps.length} étapes</span>
          {pipeline.last_run && (
            <span>Dernier run : {new Date(pipeline.last_run).toLocaleDateString('fr-FR')}</span>
          )}
          {pipeline.clearml_task_id && (
            <span style={{ color:'#6d28d9' }}>ClearML ✓</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:'.4rem', marginTop:'.8rem', flexWrap:'wrap' }}>
          {isRunning ? (
            <button
              onClick={() => onRun(pipeline)}
              style={{
                display:'flex', alignItems:'center', gap:4, padding:'.3rem .75rem',
                background:'#eff6ff', color:'#1e40af',
                border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
              }}>
              <Loader2 size={11} style={{ animation:'spin 1s linear infinite' }}/>Voir état
            </button>
          ) : (
            <button
              onClick={() => onRun(pipeline)}
              style={{
                display:'flex', alignItems:'center', gap:4, padding:'.3rem .75rem',
                background:'#dcfce7', color:'#15803d',
                border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
              }}>
              <Play size={11}/>Lancer
            </button>
          )}
          <button
            onClick={() => onEdit(pipeline)}
            style={{
              display:'flex', alignItems:'center', gap:4, padding:'.3rem .75rem',
              background:'#eff6ff', color:'#1e40af',
              border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
            }}>
            <Save size={11}/>Modifier
          </button>
          <button
            onClick={() => onCode(pipeline)}
            style={{
              display:'flex', alignItems:'center', gap:4, padding:'.3rem .75rem',
              background:'#f5f3ff', color:'#6d28d9',
              border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
            }}>
            <Code2 size={11}/>Code
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              display:'flex', alignItems:'center', gap:4, padding:'.3rem .75rem',
              background:'#f9fafb', color:'#374151',
              border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'.78rem',
            }}>
            <Terminal size={11}/>{expanded ? 'Masquer' : 'Détails'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'1rem 1.1rem', background:'#fafafa' }}>
          <div style={{ marginBottom:'.75rem' }}>
            <div style={{ fontWeight:700, fontSize:'.8rem', color:'#374151', marginBottom:'.5rem' }}>
              Étapes du pipeline
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
              {pipeline.steps.map((step, i) => {
                const s = stepsStatus[step.id] || 'idle';
                return (
                  <div key={step.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'.4rem .65rem',
                    background:'white', borderRadius:7, border:'1px solid #e5e7eb', fontSize:'.8rem',
                  }}>
                    <div style={{
                      width:22, height:22, borderRadius:'50%', background:'#f3f4f6',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'.65rem', fontWeight:700, color:'#6b7280', flexShrink:0,
                    }}>
                      {i+1}
                    </div>
                    <span style={{ flex:1, fontWeight:500 }}>{step.name}</span>
                    <span style={{ fontSize:'.65rem', color:'#9ca3af', background:'#f3f4f6', padding:'.1rem .4rem', borderRadius:10 }}>
                      {step.queue}
                    </span>
                    {s !== 'idle' && <StatusDot status={s} size={7}/>}
                  </div>
                );
              })}
            </div>
          </div>
          {pipeline.clearml_task_id && (
            <div style={{ fontSize:'.73rem', color:'#6b7280', display:'flex', gap:'1rem' }}>
              <span>ClearML ID: <code style={{ background:'#f3f4f6', padding:'.1rem .3rem', borderRadius:3 }}>{pipeline.clearml_task_id}</code></span>
              {pipeline.clearml_status && <span>Statut ClearML: <strong>{pipeline.clearml_status}</strong></span>}
            </div>
          )}
          {run?.logs?.length > 0 && (
            <div>
              <div style={{ fontWeight:700, fontSize:'.8rem', color:'#374151', margin:'.75rem 0 .4rem' }}>
                Derniers logs
              </div>
              <div style={{
                background:'#0d1117', color:'#58d68d', fontFamily:"'Courier New',monospace",
                fontSize:'.72rem', padding:'.75rem', borderRadius:7, maxHeight:140, overflowY:'auto',
                lineHeight:1.6,
              }}>
                {run.logs.slice(-20).map((l, i) => (
                  <div key={i} style={{
                    color: l.includes('✗') || l.includes('ERROR') ? '#ff6b6b'
                          : l.includes('✓') || l.includes('✅') ? '#58d68d'
                          : '#94a3b8',
                  }}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function PipelineManager() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filter, setFilter]       = useState('All');
  const [runModal, setRunModal]   = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [codeModal, setCodeModal] = useState(null);
  const [search, setSearch]       = useState('');
  const [myProject, setMyProject] = useState(null);
  const pollRef = useRef(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const r = await apiUsers.get('/clearml-pipelines');
      setPipelines(r.data.pipelines || []);
    } catch(e) {
      setError(e.userMessage || 'Impossible de charger les pipelines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
    fetchPipelines();
    // Poll every 4s — always refresh to stay in sync with ClearML
    pollRef.current = setInterval(fetchPipelines, 4000);
    return () => clearInterval(pollRef.current);
  }, [fetchPipelines]);

  // Re-fetch after run modal closes
  const handleRunClose = () => {
    setRunModal(null);
    fetchPipelines();
  };

  const types = ['All', ...Array.from(new Set(pipelines.map(p => p.type)))];

  const filtered = pipelines.filter(p => {
    const matchType = filter === 'All' || p.type === filter;
    const matchSearch = !search
      || p.name.toLowerCase().includes(search.toLowerCase())
      || p.description.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  /* Effective status: current_run takes priority over p.status (stays in sync with ClearML) */
  const effectiveStatus = (p) => {
    const r = (p.current_run?.status || '').toLowerCase();
    if (r === 'running' || r === 'completed' || r === 'failed') return r;
    return (p.status || '').toLowerCase();
  };
  const running   = pipelines.filter(p => effectiveStatus(p) === 'running').length;
  const completed = pipelines.filter(p => effectiveStatus(p) === 'completed').length;
  const failed    = pipelines.filter(p => effectiveStatus(p) === 'failed').length;

  const chainPipelines = [
    ...pipelines.filter(p => p.type !== 'Orchestrator' && p.type !== 'Data'),
    ...pipelines.filter(p => p.type === 'Data'),
  ];

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

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1>Pipeline Manager</h1>
          <p>{pipelines.length} pipelines · {running > 0 && <span style={{ color:'#1e40af' }}>{running} en cours · </span>}{completed} terminés · {failed} échoués</p>
        </div>
        <button className="btn-add" onClick={fetchPipelines}>
          <RefreshCw size={15}/>Rafraîchir
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom:'1rem' }}>{error}</div>}

      {/* Stats bar */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem',
      }}>
        {[
          { label:'Total', value: pipelines.length, color:'#6d28d9', bg:'#f5f3ff' },
          { label:'En cours', value: running, color:'#1e40af', bg:'#eff6ff' },
          { label:'Terminés', value: completed, color:'#065f46', bg:'#f0fdf4' },
          { label:'Échoués', value: failed, color:'#991b1b', bg:'#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius:10, padding:'.85rem 1.1rem',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <span style={{ fontSize:'.8rem', fontWeight:600, color: s.color }}>{s.label}</span>
            <span style={{ fontSize:'1.6rem', fontWeight:800, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding:'.3rem .8rem', borderRadius:20, border:'none', cursor:'pointer',
              fontWeight:600, fontSize:'.78rem',
              background: filter === t ? '#1e293b' : '#f3f4f6',
              color: filter === t ? 'white' : '#374151',
              transition:'all .15s',
            }}>
              {t} {t !== 'All' && `(${pipelines.filter(p=>p.type===t).length})`}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un pipeline…"
          style={{
            marginLeft:'auto', padding:'.4rem .85rem', border:'1px solid #e5e7eb',
            borderRadius:20, fontSize:'.82rem', outline:'none', width:220,
          }}
        />
      </div>

      {/* Chaîne de nœuds liés — sans Orchestrator, Versioning en dernier */}
      {!loading && (
        <PipelineChain
          pipelines={chainPipelines}
          onRun={setRunModal}
          onEdit={setEditModal}
          onCode={setCodeModal}
        />
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'#6b7280' }}>
          <Loader2 size={24} style={{ animation:'spin 1s linear infinite' }}/>
          <p style={{ marginTop:'.75rem' }}>Chargement des pipelines…</p>
        </div>
      ) : (
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(330px, 1fr))',
          gap:'1.1rem',
          marginBottom:'2rem',
        }}>
          {filtered.map(p => (
            <PipelineCard
              key={p.id}
              pipeline={p}
              onRun={setRunModal}
              onEdit={setEditModal}
              onCode={setCodeModal}
              onRefresh={fetchPipelines}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{
              gridColumn:'1/-1', textAlign:'center', padding:'3rem',
              background:'white', borderRadius:10, boxShadow:'var(--shadow-sm)',
              color:'#6b7280',
            }}>
              Aucun pipeline trouvé.
            </div>
          )}
        </div>
      )}

      {/* Run modal */}
      {runModal && (
        <RunModal pipeline={runModal} onClose={handleRunClose}/>
      )}

      {/* Graphical + code edit modal */}
      {editModal && (
        <PipelineEditModal pipeline={editModal} onClose={() => { setEditModal(null); fetchPipelines(); }}/>
      )}

      {/* Code-only editor modal */}
      {codeModal && (
        <CodeModal pipeline={codeModal} onClose={() => setCodeModal(null)}/>
      )}
    </div>
  );
}

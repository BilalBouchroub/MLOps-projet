import React, { useState, useEffect, useRef } from 'react';
import { apiUsers } from '../../api/axios';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Activity, Clock } from 'lucide-react';

function QualityCircle({ pct, size = 120 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash  = (pct / 100) * circ;
  const color = pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:'1.6rem', fontWeight:800, color, lineHeight:1 }}>{pct}%</span>
        <span style={{ fontSize:'.65rem', color:'#9ca3af', fontWeight:600, marginTop:2 }}>QUALITÉ</span>
      </div>
    </div>
  );
}

function SummaryCard({ icon, value, label, color, bg }) {
  return (
    <div style={{ background:'white', borderRadius:10, padding:'1.1rem 1.25rem',
      border:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:12,
      boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ width:46, height:46, borderRadius:10, background:bg,
        display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize:'1.7rem', fontWeight:800, color, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:'.73rem', color:'#6b7280', fontWeight:600,
          textTransform:'uppercase', letterSpacing:'.4px', marginTop:2 }}>{label}</div>
      </div>
    </div>
  );
}

function DriftBadge({ drift, psi }) {
  if (!drift) return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'.2rem .6rem',
      borderRadius:20, fontSize:'.73rem', fontWeight:700, background:'#d1fae5', color:'#065f46' }}>
      <CheckCircle2 size={11}/>OK
    </span>
  );
  const critical = psi > 0.5;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'.2rem .6rem',
      borderRadius:20, fontSize:'.73rem', fontWeight:700,
      background:critical?'#fee2e2':'#fef3c7', color:critical?'#991b1b':'#92400e' }}>
      {critical ? <XCircle size={11}/> : <AlertTriangle size={11}/>}
      {critical ? 'CRITICAL' : 'DRIFT'}
    </span>
  );
}

export default function ValidationReport() {
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const intervalRef = useRef(null);

  const loadReport = (silent = false) => {
    if (!silent) setLoading(true);
    apiUsers.get('/validation/report')
      .then(r => { setReport(r.data); setError(null); })
      .catch(() => setError('Impossible de charger le rapport.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    // Auto-refresh toutes les 10s pour refléter le dernier run pipeline
    intervalRef.current = setInterval(() => loadReport(true), 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (loading && !report) return <p style={{ padding:'2rem', textAlign:'center', color:'#6b7280' }}>Chargement…</p>;
  if (error && !report)   return <div className="alert-error">{error}</div>;
  if (!report) return null;

  const { schema, stats, drift, last_updated, pipeline_meta } = report;
  const totalFiles     = schema.total_files || 0;  // déjà live depuis le backend
  const warnings       = schema.warnings || [];
  const perFile        = schema.per_file  || {};
  const validatedN = Object.values(perFile).filter(f => f.null_rate === 0).length;
  const driftEntries   = Object.entries(drift || {}).sort((a,b) => b[1].psi - a[1].psi);
  const driftCount     = driftEntries.filter(([,v]) => v.drift).length;
  const totalFeat      = driftEntries.length;

  const qualityPct = Math.max(0, Math.round(
    100
    - (driftCount / Math.max(totalFeat, 1)) * 30
    - (warnings.length / Math.max(totalFiles * 2, 1)) * 20
    - ((schema.issues||[]).length > 0 ? 15 : 0)
  ));

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Validation Report</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            {totalFiles} fichiers · {driftCount}/{totalFeat} features en drift
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {loading && <span style={{ fontSize:'.78rem', color:'#9ca3af' }}>↻ sync…</span>}
          <button onClick={() => loadReport()} style={{ display:'flex', alignItems:'center', gap:5,
            padding:'.45rem .9rem', background:'white', border:'1px solid #e5e7eb',
            borderRadius:7, cursor:'pointer', fontWeight:600, fontSize:'.85rem', color:'#374151' }}>
            <RefreshCw size={13}/>Rafraîchir
          </button>
        </div>
      </div>

      {/* Bannière dernier run pipeline */}
      {(last_updated || pipeline_meta?.run_at) && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'.55rem 1rem',
          background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
          marginBottom:'1rem', fontSize:'.82rem',
        }}>
          <Clock size={14} color="#16a34a"/>
          <span style={{ color:'#166534', fontWeight:600 }}>
            Dernier run pipeline :&nbsp;
            <strong>
              {new Date(pipeline_meta?.run_at || last_updated).toLocaleString('fr-FR')}
            </strong>
          </span>
          {pipeline_meta?.status && (
            <span style={{
              marginLeft:'auto', padding:'.15rem .6rem', borderRadius:20,
              fontSize:'.72rem', fontWeight:700,
              background: pipeline_meta.status === 'completed' ? '#d1fae5' : '#fee2e2',
              color:       pipeline_meta.status === 'completed' ? '#065f46' : '#991b1b',
            }}>
              {pipeline_meta.status === 'completed' ? '✅ Completed' : '❌ Failed'}
            </span>
          )}
          <span style={{ marginLeft: pipeline_meta?.status ? 0 : 'auto', color:'#9ca3af', fontSize:'.73rem' }}>
            auto-refresh 10s
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        <SummaryCard icon={<CheckCircle2 size={20}/>} value={totalFiles}
          label="Files Validated" color="#065f46" bg="#d1fae5"/>
        <SummaryCard icon={<Activity size={20}/>} value={`${totalFeat}/${totalFeat}`}
          label="Features Valid" color="#1e40af" bg="#dbeafe"/>
        <SummaryCard icon={<AlertTriangle size={20}/>} value={warnings.length}
          label="Warnings" color="#92400e" bg="#fef3c7"/>
        <SummaryCard icon={<XCircle size={20}/>} value={driftCount}
          label="Drift Detected" color="#991b1b" bg="#fee2e2"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
        {/* Drift table */}
        <div className="card">
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)' }}>Drift Detection Results</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>{['Feature','PSI Score','KS p-value','Statut'].map(h=><th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {driftEntries.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af' }}>Aucune donnée.</td></tr>
                ) : driftEntries.map(([feat, v]) => (
                  <tr key={feat} style={{ background:v.drift?'#fff7ed':undefined }}>
                    <td style={{ fontWeight:700 }}>{feat}</td>
                    <td style={{ fontFamily:'monospace', fontWeight:700,
                      color:v.psi>0.5?'#dc2626':v.psi>0.2?'#d97706':'#166534' }}>
                      {v.psi.toFixed(4)}
                    </td>
                    <td style={{ fontFamily:'monospace',
                      color:v.ks_pval<0.05?'#d97706':'#166534', fontWeight:600 }}>
                      {v.ks_pval.toFixed(4)}
                    </td>
                    <td><DriftBadge drift={v.drift} psi={v.psi}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality Score */}
        <div className="card" style={{ display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'1rem' }}>
          <h3 style={{ margin:0, color:'var(--sidebar-bg)', textAlign:'center' }}>Data Quality Score</h3>
          <QualityCircle pct={qualityPct}/>
          <div style={{ width:'100%' }}>
            {[
              { label:'Drift features', val:`${driftCount}/${totalFeat}`, ok:driftCount===0 },
              { label:'Warnings',       val:warnings.length,              ok:warnings.length===0 },
              { label:'Issues',         val:(schema.issues||[]).length,   ok:(schema.issues||[]).length===0 },
              { label:'Fichiers validés', val:`${validatedN}/${totalFiles}`, ok:validatedN===totalFiles },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between',
                padding:'.3rem 0', borderBottom:'1px solid #f3f4f6', fontSize:'.8rem' }}>
                <span style={{ color:'#374151', fontWeight:600 }}>{row.label}</span>
                <span style={{ fontWeight:700, color:row.ok?'#16a34a':'#d97706' }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Statistics */}
      {Object.keys(stats||{}).length > 0 && (
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)' }}>Feature Statistics</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>{['Feature','Count','Mean','Std','Min','Médiane','Max'].map(h=><th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {Object.entries(stats).map(([feat, s]) => (
                  <tr key={feat}>
                    <td style={{ fontWeight:700 }}>{feat}</td>
                    <td>{s.count?.toFixed(0)}</td>
                    <td style={{ fontFamily:'monospace' }}>{s.mean?.toFixed(4)}</td>
                    <td style={{ fontFamily:'monospace', color:'#6b7280' }}>{s.std?.toFixed(4)}</td>
                    <td style={{ fontFamily:'monospace', color:'#dc2626' }}>{s.min?.toFixed(4)}</td>
                    <td style={{ fontFamily:'monospace' }}>{s['50%']?.toFixed(4)}</td>
                    <td style={{ fontFamily:'monospace', color:'#16a34a' }}>{s.max?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="card">
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)' }}>Warnings ({warnings.length})</h3>
          <ul className="warnings-list">
            {warnings.slice(0, 30).map((w, i) => <li key={i}>{w}</li>)}
            {warnings.length > 30 && (
              <li style={{ color:'#6b7280', background:'#f9fafb' }}>
                + {warnings.length - 30} avertissements supplémentaires…
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

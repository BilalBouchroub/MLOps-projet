import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from 'recharts';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Database } from 'lucide-react';

function MetricCard({ icon, value, label, sub, color, bg }) {
  return (
    <div style={{ background:'white', borderRadius:10, padding:'1.1rem',
      border:'1px solid #e5e7eb', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'.5rem' }}>
        <div style={{ width:38, height:38, borderRadius:9, background:bg,
          display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0 }}>
          {icon}
        </div>
        <span style={{ fontSize:'1.65rem', fontWeight:800, color, lineHeight:1 }}>{value}</span>
      </div>
      <div style={{ fontWeight:700, fontSize:'.78rem', color:'#374151',
        textTransform:'uppercase', letterSpacing:'.4px' }}>{label}</div>
      {sub && <div style={{ fontSize:'.72rem', color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  );
}


export default function QualityDashboard() {
  const [report,    setReport]    = useState(null);
  const [datasets,  setDatasets]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [myProject, setMyProject] = useState(null);

  const fetchAll = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      apiUsers.get('/validation/report'),
      apiUsers.get('/datasets/available'),
    ]).then(([repRes, dsRes]) => {
      setReport(repRes.data);
      setDatasets(dsRes.data.datasets || []);
    }).catch(() => {})
    .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchAll();
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
    const iv = setInterval(() => fetchAll(true), 10000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <p style={{ padding:'2rem', textAlign:'center', color:'#6b7280' }}>Chargement…</p>;

  const schema = report?.schema || {};
  const stats  = report?.stats  || {};  // used for feature count below
  const featCount = Object.keys(stats).length;
  const drift  = report?.drift  || {};

  const totalFiles     = datasets.length || schema.total_files || 0;
  const warnings       = schema.warnings || [];
  const perFile        = schema.per_file  || {};
  const validatedN     = Object.values(perFile).filter(f => f.null_rate === 0).length;
  const driftCount     = Object.values(drift).filter(v => v.drift).length;
  const totalFeat      = Object.keys(drift).length;

  const qualityPct = Math.max(0, Math.round(
    100
    - (driftCount / Math.max(totalFeat,1)) * 30
    - (warnings.length / Math.max(totalFiles * 2, 1)) * 20
  ));


  // Drift radar
  const maxPsi = Math.max(...Object.values(drift).map(v => v.psi), 1);
  const radarData = Object.entries(drift).map(([feat, v]) => ({
    subject: feat,
    PSI:     +((v.psi / maxPsi) * 100).toFixed(1),
    KS:      +(v.ks_pval * 100).toFixed(2),
    fullMark: 100,
  }));

  // Null rate by file (from datasets list)
  const fileNullData = datasets
    .filter(d => d.year && parseInt(d.year) >= 2018)
    .sort((a,b) => parseInt(a.year) - parseInt(b.year))
    .map(d => ({ name: d.year, null_pct: d.null_pct, rows: d.rows }));

  // Per-file quality table
  const fileQuality = datasets.slice(0, 20).map(d => {
    const info = perFile[d.filename] || {};
    const nullR = info.null_rate !== undefined ? info.null_rate * 100 : d.null_pct;
    const score = Math.max(0, 100 - nullR * 2);
    return { ...d, nullR, score };
  });

  return (
    <div>
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
          <h1>Data Quality Dashboard</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            Score global : {qualityPct}% · {totalFiles} fichiers analysés
          </p>
        </div>
        <button onClick={fetchAll} style={{ display:'flex', alignItems:'center', gap:5,
          padding:'.45rem .9rem', background:'white', border:'1px solid #e5e7eb',
          borderRadius:7, cursor:'pointer', fontWeight:600, fontSize:'.85rem', color:'#374151' }}>
          <RefreshCw size={13}/>Rafraîchir
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        <MetricCard icon={<TrendingUp size={18}/>} value={`${qualityPct}%`}
          label="Score qualité" sub="Score global pondéré" color="#16a34a" bg="#d1fae5"/>
        <MetricCard icon={<Database size={18}/>} value={totalFiles}
          label="Fichiers analysés" sub={`${validatedN} validés · ${featCount} features`} color="#1e40af" bg="#dbeafe"/>
        <MetricCard icon={<AlertTriangle size={18}/>} value={warnings.length}
          label="Warnings" sub="Colonnes manquantes, LST" color="#92400e" bg="#fef3c7"/>
        <MetricCard icon={<CheckCircle2 size={18}/>} value={`${driftCount}/${totalFeat}`}
          label="Features en drift" sub="PSI > 0.2 ou KS < 0.05" color="#991b1b" bg="#fee2e2"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
        {/* Null rate by year */}
        <div className="card">
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)', fontSize:'.95rem' }}>
            Taux nulls par année (2018+)
          </h3>
          {fileNullData.length === 0 ? (
            <p style={{ color:'#9ca3af', textAlign:'center' }}>Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={fileNullData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                <XAxis dataKey="name" tick={{ fontSize:11 }}/>
                <YAxis tickFormatter={v=>`${v}%`} tick={{ fontSize:11 }}/>
                <Tooltip formatter={(v) => [`${v}%`, 'Nulls']}/>
                <Bar dataKey="null_pct" radius={[4,4,0,0]}>
                  {fileNullData.map((f,i) => (
                    <Cell key={i} fill={f.null_pct>50?'#dc2626':f.null_pct>20?'#d97706':'#16a34a'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Drift radar */}
        <div className="card">
          <h3 style={{ margin:'0 0 .25rem', color:'var(--sidebar-bg)', fontSize:'.95rem' }}>
            Drift par feature (PSI normalisé)
          </h3>
          <p style={{ fontSize:'.73rem', color:'#9ca3af', marginBottom:'.75rem' }}>
            Plus haut = drift plus important
          </p>
          {radarData.length === 0 ? (
            <p style={{ color:'#9ca3af', textAlign:'center' }}>Aucune donnée de drift</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#e5e7eb"/>
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:10, fontWeight:600 }}/>
                <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize:8 }}/>
                <Radar name="PSI" dataKey="PSI" stroke="#dc2626" fill="#dc2626" fillOpacity={0.25} strokeWidth={2}/>
                <Tooltip formatter={v => [`${v}`, 'PSI Score']}/>
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-file quality table */}
      <div className="card">
        <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)' }}>
          Qualité par fichier (20 derniers)
        </h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>{['Fichier','Année','Lignes','Taux nulls','Score','Statut'].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {fileQuality.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'#9ca3af' }}>Aucune donnée.</td></tr>
              ) : fileQuality.map(f => (
                <tr key={f.filename}>
                  <td style={{ fontWeight:600, fontSize:'.82rem', maxWidth:180,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {f.filename}
                  </td>
                  <td>{f.year||'—'}</td>
                  <td>{f.rows ? `${(f.rows/1000).toFixed(0)}K` : '—'}</td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:20, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:20,
                          width:`${Math.min(f.nullR,100)}%`,
                          background:f.nullR>50?'#dc2626':f.nullR>20?'#d97706':'#16a34a' }}/>
                      </div>
                      <span style={{ fontSize:'.75rem', fontWeight:700, minWidth:40,
                        color:f.nullR>50?'#dc2626':f.nullR>20?'#d97706':'#16a34a' }}>
                        {f.nullR.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight:800, color:f.score>=90?'#16a34a':f.score>=70?'#d97706':'#dc2626' }}>
                      {f.score.toFixed(0)}
                    </span>
                  </td>
                  <td>
                    <span style={{ padding:'.18rem .55rem', borderRadius:20, fontSize:'.73rem', fontWeight:700,
                      background:f.status==='VALIDATED'?'#d1fae5':'#fef3c7',
                      color:f.status==='VALIDATED'?'#065f46':'#92400e' }}>
                      {f.status}
                    </span>
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

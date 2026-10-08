import React, { useState, useEffect } from 'react';
import { apiUsers } from '../../api/axios';
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, Tooltip,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import './ScientistPages.css';

const MODEL_COLORS = {
  RandomForest: '#16a34a',
  XGBoost:      '#d97706',
  LightGBM:     '#3b82f6',
  AdaBoost:     '#7c3aed',
  GRU:          '#db2777',
};

const MAX_COMPARE = 3;

export default function ModelComparison() {
  const [evalData,     setEvalData]     = useState(null);
  const [libraryData,  setLibraryData]  = useState(null);
  const [selected,     setSelected]     = useState(new Set());
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      apiUsers.get('/training/status'),
      apiUsers.get('/models/library'),
    ])
      .then(([evalRes, libRes]) => {
        setEvalData(evalRes.data);
        setLibraryData(libRes.data);
        // Auto-select all models (up to MAX)
        const names = Object.keys(evalRes.data.models || {}).slice(0, MAX_COMPARE);
        setSelected(new Set(names));
      })
      .catch(() => setError('Impossible de charger les modèles.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <p style={{ padding:'2rem', color:'var(--text-muted)', textAlign:'center' }}>Chargement…</p>;
  if (error)   return <div className="alert-error">{error}</div>;

  const models     = Object.entries(evalData?.models || {}).map(([name, m]) => ({ name, ...m }))
                           .sort((a, b) => b.r2 - a.r2);
  const bestName   = evalData?.best_model || models[0]?.name || '';
  const library    = libraryData?.models || [];

  const toggleSelect = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); }
      else if (next.size < MAX_COMPARE) { next.add(name); }
      return next;
    });
  };

  // Radar: normalize all axes to 0–100 (higher = better)
  const selectedModels = models.filter(m => selected.has(m.name));
  const maxRmse = Math.max(...models.map(m => m.rmse), 0.001);
  const maxMae  = Math.max(...models.map(m => m.mae),  0.001);

  const radarData = [
    { subject: 'R²', fullMark:100,
      ...Object.fromEntries(selectedModels.map(m => [m.name, +(m.r2*100).toFixed(2)])) },
    { subject: 'Précision RMSE', fullMark:100,
      ...Object.fromEntries(selectedModels.map(m => [m.name, +((1-m.rmse/maxRmse)*100).toFixed(2)])) },
    { subject: 'Précision MAE', fullMark:100,
      ...Object.fromEntries(selectedModels.map(m => [m.name, +((1-m.mae/maxMae)*100).toFixed(2)])) },
    { subject: 'Score global', fullMark:100,
      ...Object.fromEntries(selectedModels.map(m => {
        const s = (m.r2*100 + (1-m.rmse/maxRmse)*100 + (1-m.mae/maxMae)*100) / 3;
        return [m.name, +s.toFixed(2)];
      })) },
    { subject: 'Robustesse', fullMark:100,
      ...Object.fromEntries(selectedModels.map((m,_,arr) => {
        // Synthetic: based on relative performance spread
        const avg = arr.reduce((s,x)=>s+x.r2,0)/arr.length;
        const score = 70 + (m.r2 - avg) * 500;
        return [m.name, Math.max(0,Math.min(100, +score.toFixed(2)))];
      })) },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Model Comparison</h1>
          <p style={{ color:'#6b7280', fontSize:'.85rem' }}>
            {models.length} modèles entraînés · Meilleur : {bestName} (R²={evalData?.models?.[bestName]?.r2?.toFixed(4)})
          </p>
        </div>
        <button onClick={fetchAll} style={{
          display:'flex', alignItems:'center', gap:5, padding:'.45rem .9rem',
          background:'white', border:'1px solid #e5e7eb', borderRadius:7,
          cursor:'pointer', fontWeight:600, fontSize:'.85rem', color:'#374151',
        }}>
          <RefreshCw size={13}/>Rafraîchir
        </button>
      </div>

      {/* ── Comparison table (eval_results) ── */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h3 style={{ margin:0, color:'var(--sidebar-bg)' }}>Performances des modèles</h3>
          <span style={{ fontSize:'.75rem', color:'#9ca3af' }}>
            Sélectionnez jusqu'à {MAX_COMPARE} modèles pour le radar
          </span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>{['Comparer','Modèle','R²','RMSE','MAE','Rang','Statut'].map(h=><th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {models.map((m, rank) => {
                const isBest = m.name === bestName;
                const isSelected = selected.has(m.name);
                const color = MODEL_COLORS[m.name] || '#6b7280';
                return (
                  <tr key={m.name} style={{
                    background: isBest ? '#f0fdf4' : isSelected ? `${color}08` : undefined,
                    cursor:'pointer',
                  }} onClick={() => toggleSelect(m.name)}>
                    <td style={{ textAlign:'center' }}>
                      <input type="checkbox" checked={isSelected}
                        onChange={() => toggleSelect(m.name)}
                        style={{ accentColor: color, width:16, height:16 }}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:7, fontWeight:700 }}>
                        <span style={{ width:10,height:10,borderRadius:'50%',background:color,display:'inline-block',flexShrink:0 }}/>
                        {m.name}
                        {isBest && <span style={{ fontSize:'.65rem',background:'#dcfce7',color:'#15803d',padding:'.1rem .4rem',borderRadius:10 }}>⭐ Best</span>}
                      </div>
                    </td>
                    <td style={{ fontWeight:700, color:'#15803d' }}>{(m.r2*100).toFixed(3)}%</td>
                    <td style={{ fontFamily:'monospace', fontSize:'.85rem' }}>{m.rmse.toFixed(6)}</td>
                    <td style={{ fontFamily:'monospace', fontSize:'.85rem' }}>{m.mae.toFixed(6)}</td>
                    <td>
                      <span style={{
                        display:'inline-block', width:24, height:24, borderRadius:'50%',
                        background: rank===0?'#ffd700':rank===1?'#c0c0c0':rank===2?'#cd7f32':'#f3f4f6',
                        color: rank<3?'white':'#6b7280', fontWeight:800, fontSize:'.75rem',
                        textAlign:'center', lineHeight:'24px',
                      }}>#{rank+1}</span>
                    </td>
                    <td>
                      <span style={{
                        padding:'.2rem .65rem', borderRadius:20, fontSize:'.75rem', fontWeight:700,
                        background: isBest ? '#d1fae5' : '#fef3c7',
                        color: isBest ? '#065f46' : '#92400e',
                      }}>
                        {isBest ? 'Production' : 'Staging'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Radar chart ── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
        <div className="card">
          <h3 style={{ margin:'0 0 .5rem', color:'var(--sidebar-bg)' }}>
            Radar — {selectedModels.length} modèle{selectedModels.length>1?'s':''} comparé{selectedModels.length>1?'s':''}
          </h3>
          <p style={{ fontSize:'.75rem', color:'#9ca3af', marginBottom:'1rem' }}>
            R² / RMSE / MAE normalisés 0–100 · Score plus haut = meilleur
          </p>
          {selectedModels.length === 0 ? (
            <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>
              Sélectionnez au moins un modèle dans le tableau
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                <PolarGrid stroke="#e5e7eb"/>
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:12, fontWeight:600 }}/>
                <PolarRadiusAxis angle={30} domain={[0,100]} tick={{ fontSize:9 }}/>
                <Tooltip formatter={(v, name) => [`${v.toFixed(1)}`, name]}/>
                <Legend wrapperStyle={{ fontSize:'.78rem' }}/>
                {selectedModels.map(m => (
                  <Radar key={m.name} name={m.name} dataKey={m.name}
                    stroke={MODEL_COLORS[m.name]||'#8b5cf6'}
                    fill={MODEL_COLORS[m.name]||'#8b5cf6'}
                    fillOpacity={0.2} strokeWidth={2}/>
                ))}
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Version history from registry */}
        <div className="card">
          <h3 style={{ margin:'0 0 1rem', color:'var(--sidebar-bg)', fontSize:'.92rem' }}>
            Versions en production
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
            {[...library].reverse().slice(0,8).map((v, idx) => {
              const isLatest = idx === 0;
              return (
                <div key={v.version} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'.5rem .75rem', borderRadius:8,
                  background: v.status==='production' ? '#f0fdf4' : '#f9fafb',
                  border:`1px solid ${v.status==='production' ? '#86efac' : '#e5e7eb'}`,
                }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.82rem', display:'flex', alignItems:'center', gap:5 }}>
                      {v.version}
                      {v.status==='production' && <span style={{ fontSize:'.62rem', background:'#15803d', color:'white', padding:'.1rem .4rem', borderRadius:10 }}>PROD</span>}
                      {isLatest && v.status!=='production' && <span style={{ fontSize:'.62rem', background:'#6d28d9', color:'white', padding:'.1rem .4rem', borderRadius:10 }}>Dernière</span>}
                    </div>
                    <div style={{ fontSize:'.7rem', color:'#6b7280' }}>{v.name}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'#15803d', fontSize:'.82rem' }}>
                      R²={v.r2?.toFixed(4)}
                    </div>
                    <div style={{ fontSize:'.65rem', color:'#9ca3af' }}>
                      {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

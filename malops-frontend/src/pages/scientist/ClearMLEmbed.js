import React, { useState } from 'react';
import { ExternalLink, RefreshCw, LayoutDashboard } from 'lucide-react';

const CLEARML_URL = 'http://localhost:8080';

export default function ClearMLEmbed() {
  const [key, setKey] = useState(0);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100% + 4rem)', margin:'-2rem', overflow:'hidden' }}>

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'.6rem 1.25rem', background:'white', borderBottom:'1px solid #e5e7eb', flexShrink:0,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <LayoutDashboard size={18} color="var(--sidebar-bg)" />
          <span style={{ fontWeight:700, fontSize:'.95rem' }}>ClearML — Interface intégrée</span>
          <span style={{ padding:'.15rem .55rem', borderRadius:20, fontSize:'.7rem', fontWeight:700, background:'#d1fae5', color:'#065f46' }}>● LIVE</span>
        </div>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button
            onClick={() => setKey(k => k + 1)}
            style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.35rem .75rem', border:'1px solid #e5e7eb', borderRadius:6, background:'white', cursor:'pointer', fontSize:'.82rem', fontWeight:600, color:'#6b7280' }}>
            <RefreshCw size={13}/> Recharger
          </button>
          <a href={CLEARML_URL} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.35rem .75rem', border:'1px solid var(--sidebar-bg)', borderRadius:6, background:'var(--sidebar-bg)', cursor:'pointer', fontSize:'.82rem', fontWeight:600, color:'white', textDecoration:'none' }}>
            <ExternalLink size={13}/> Ouvrir dans un onglet
          </a>
        </div>
      </div>

      <iframe
        key={key}
        src={CLEARML_URL}
        title="ClearML Dashboard"
        style={{ flex:1, border:'none', display:'block' }}
        allow="fullscreen"
      />
    </div>
  );
}

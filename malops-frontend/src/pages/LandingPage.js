import React, { useEffect, useRef, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import CountUp from 'react-countup';
import { motion, useInView } from 'framer-motion';
import AOS from 'aos';
import 'aos/dist/aos.css';

/* ── Palette ── */
const C = {
  dark:    '#0d2818',
  primary: '#2d6a4f',
  mid:     '#40916c',
  light:   '#52b788',
  accent:  '#95d5b2',
  pale:    '#d8f3dc',
  white:   '#ffffff',
  text:    '#212529',
  muted:   '#6b7280',
};


/* ── Scroll-aware CountUp ── */
function AnimatedStat({ end, suffix = '', prefix = '', decimals = 0, label, color = C.light }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.6rem', fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif', lineHeight: 1 }}>
        {inView ? (
          <CountUp start={0} end={end} duration={2.4} separator="," decimals={decimals}
            prefix={prefix} suffix={suffix} />
        ) : (
          <span>{prefix}0{suffix}</span>
        )}
      </div>
      <div style={{ fontSize: '.85rem', color: C.muted, marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ id, children, bg = C.white, style = {} }) {
  return (
    <section id={id} style={{ background: bg, ...style }}>
      {children}
    </section>
  );
}

/* ── Redirect path by role ── */
const getDashboardPath = (role) => {
  if (role === 'admin')          return '/admin';
  if (role === 'data_engineer')  return '/engineer';
  if (role === 'data_scientist') return '/scientist';
  if (role === 'mlops_engineer') return '/client';
  return '/map';
};

/* ── Moroccan partner institutions ── */
const PARTNERS = [
  { name: 'IAV Hassan II',   role: 'Institut Agronomique et Vétérinaire',        city: 'Rabat' },
  { name: 'INRA Maroc',      role: 'Institut National de la Recherche Agron.',   city: 'Rabat' },
  { name: 'ENA Meknès',      role: 'École Nationale d\'Agriculture',             city: 'Meknès' },
  { name: 'Pôle Digital Ag', role: 'Pôle Digital de l\'Agriculture',             city: 'Maroc' },
  { name: 'ONCA',            role: 'Office National du Conseil Agricole',         city: 'Rabat' },
  { name: 'ORMVAD',          role: 'Office Rég. de Mise en Valeur — Doukkala',   city: 'El Jadida' },
  { name: 'FAO Maroc',       role: 'Food & Agriculture Organization — ONU',      city: 'Rabat' },
  { name: 'AgriEdge',        role: 'Plateforme AgriTech Maroc',                  city: 'Casablanca' },
];

/* ══════════════════════════════════════════════════════════════
   NAVBAR
══════════════════════════════════════════════════════════════ */
function LandingNav() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useContext(AuthContext);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // eslint-disable-line no-unused-vars

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(13,40,24,.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,.08)' : 'none',
      transition: 'all .3s ease',
      padding: '0 3rem',
    }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg,${C.light},${C.mid})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '.95rem', color: 'white',
          }}>H</div>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Montserrat, sans-serif', letterSpacing: '.5px' }}>
            HydroVision
          </span>
        </div>

        {/* Links desktop */}
        <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }} className="nav-links-desktop">
          {[['about', 'À propos'], ['features', 'Fonctionnalités'], ['roles', 'Rôles']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.85)', fontWeight: 500, fontSize: '.9rem',
              transition: 'color .2s',
            }} onMouseEnter={e => e.target.style.color = C.accent}
               onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.85)'}>
              {label}
            </button>
          ))}
          <button onClick={() => navigate(isAuthenticated ? getDashboardPath(role) : '/login')} style={{
            padding: '.45rem 1.2rem', borderRadius: 8,
            background: `linear-gradient(135deg,${C.mid},${C.primary})`,
            color: 'white', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: '.88rem',
            boxShadow: '0 2px 10px rgba(64,145,108,.4)',
            transition: 'transform .15s, box-shadow .15s',
          }} onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 16px rgba(64,145,108,.5)'; }}
             onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 2px 10px rgba(64,145,108,.4)'; }}>
            {isAuthenticated ? 'Tableau de bord' : 'Se Connecter'}
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
function HeroSection() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useContext(AuthContext);

  const metrics = [
    { value: 1714623, label: 'données satellite analysées', suffix: '+' },
    { value: 97.34,   label: 'précision R² du modèle',      suffix: '%', decimals: 2 },
    { value: 36,      label: 'années de données historiques', suffix: '' },
  ];

  return (
    <section style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${C.dark} 0%, #1a3a2a 40%, #0f3020 70%, #051a0f 100%)`,
    }}>
      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: .06,
        backgroundImage: `linear-gradient(rgba(149,213,178,.6) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(149,213,178,.6) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}/>

      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(45,106,79,.25) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }}/>

      {/* Floating circles decoration */}
      {[
        { top: '15%', left: '8%',  size: 300, opacity: .04 },
        { top: '60%', right: '5%', size: 200, opacity: .06 },
        { top: '40%', left: '2%',  size: 120, opacity: .08 },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', ...c,
          width: c.size, height: c.size, borderRadius: '50%',
          border: `1px solid rgba(149,213,178,${c.opacity * 5})`,
        }}/>
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1300, margin: '0 auto', padding: '5rem 3rem 3rem', textAlign: 'center' }}>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(149,213,178,.12)', border: '1px solid rgba(149,213,178,.3)',
            borderRadius: 30, padding: '.35rem 1rem', marginBottom: '1.5rem',
            color: C.accent, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.8px',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.light, display: 'inline-block',
              animation: 'pulse 2s infinite' }}/>
            PLATEFORME MLOPS — AGRICULTURE INTELLIGENTE
          </span>
        </motion.div>

        {/* Main title */}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .1 }}
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)', fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif', color: 'white', lineHeight: 1.1,
            margin: '0 0 1.25rem',
          }}>
          Prédiction Intelligente du<br />
          <span style={{ background: `linear-gradient(135deg,${C.light},${C.accent})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Stress Hydrique
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .25 }}
          style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'rgba(255,255,255,.7)',
            maxWidth: 620, margin: '0 auto 2.5rem', lineHeight: 1.65, fontWeight: 400 }}>
          Plateforme MLOps pour l'agriculture durable au Maroc — analysez 7 indicateurs
          satellite et anticipez les crises hydriques grâce à l'IA.
        </motion.p>

        {/* CTA buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .4 }}
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
          <button onClick={() => navigate(isAuthenticated ? getDashboardPath(role) : '/login')} style={{
            padding: '.8rem 2rem', borderRadius: 10, fontWeight: 700, fontSize: '1rem',
            background: `linear-gradient(135deg,${C.mid},${C.primary})`,
            color: 'white', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(64,145,108,.45)',
            transition: 'all .2s',
          }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
             onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            {isAuthenticated ? 'Accéder au tableau de bord →' : 'Se Connecter →'}
          </button>
        </motion.div>

        {/* Metrics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: .6 }}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px', background: 'rgba(255,255,255,.08)',
            borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)',
            maxWidth: 1000, margin: '0 auto',
          }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              padding: '1.5rem 1rem', background: 'rgba(255,255,255,.04)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: C.accent,
                fontFamily: 'Montserrat, sans-serif' }}>
                <CountUp start={0} end={m.value} duration={2.5} separator="," decimals={m.decimals || 0}
                  suffix={m.suffix} enableScrollSpy scrollSpyDelay={800} />
              </div>
              <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.55)', marginTop: 4, fontWeight: 500 }}>
                {m.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}
        onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: '.7rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Défiler
        </span>
        <div style={{ width: 24, height: 38, border: '2px solid rgba(255,255,255,.2)', borderRadius: 12,
          display: 'flex', justifyContent: 'center', paddingTop: 6 }}>
          <div style={{
            width: 4, height: 8, background: C.accent, borderRadius: 2,
            animation: 'scrollDot 1.8s infinite',
          }}/>
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes scrollDot { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(12px)} }
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        h1,h2,h3 { font-family: 'Montserrat', sans-serif !important; }
        .nav-links-desktop { display:flex !important; }
        @media(max-width:768px) { .nav-links-desktop { display:none !important; } }
      `}</style>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   CRISIS BANNER
══════════════════════════════════════════════════════════════ */
function CrisisBanner() {
  const stats = [
    { icon: '💧', value: '565 m³', label: 'eau/habitant/an', sub: '-78% depuis 1960' },
    { icon: '🌾', value: '80%', label: 'eau utilisée pour l\'agriculture', sub: 'Maroc — Banque Mondiale' },
    { icon: '⚠️', value: '#27ème', label: 'pays à risque hydrique', sub: 'WRI Water Risk Index' },
    { icon: '📉', value: '5 Md m³', label: 'précipitations 2023', sub: 'contre 12 Md m³ en 2000' },
  ];
  return (
    <div style={{
      background: `linear-gradient(90deg,#0f2d1f,#1a3d2b,#0f2d1f)`,
      padding: '1.25rem 3rem',
      borderBottom: '1px solid rgba(149,213,178,.12)',
    }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem',
        textAlign: 'center',
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: C.accent, fontFamily: 'Montserrat, sans-serif' }}>{s.value}</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.65)', marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: '.67rem', color: C.light, fontWeight: 600, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ABOUT
══════════════════════════════════════════════════════════════ */
function AboutSection() {
  const indicators = ['NDVI', 'NDWI', 'LST', 'Precipitation', 'SoilMoisture', 'MSI', 'ET₀'];
  return (
    <Section id="about" bg="#f8fffe" style={{ padding: '6rem 3rem' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span style={{
            background: `${C.pale}`, color: C.primary, padding: '.3rem .9rem',
            borderRadius: 30, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.6px',
          }}>À PROPOS DE HYDROVISION</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: C.dark,
            margin: '.75rem 0 1rem' }}>
            L'IA au service de l'agriculture marocaine
          </h2>
          <p style={{ fontSize: '1.05rem', color: C.muted, maxWidth: 700, margin: '0 auto', lineHeight: 1.75 }}>
            HydroVision est une plateforme MLOps de pointe qui utilise l'intelligence artificielle et les données satellite
            pour prédire le stress hydrique des cultures au Maroc. Notre système analyse{' '}
            <strong style={{ color: C.primary }}>7 indicateurs environnementaux</strong> pour fournir des prédictions
            précises du <strong style={{ color: C.primary }}>CWSI</strong> (Crop Water Stress Index).
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          {/* Left: indicators */}
          <div data-aos="fade-right" data-aos-delay="100" style={{ textAlign: 'center' }}>
            <h3 style={{ color: C.dark, fontWeight: 700, marginBottom: '1.25rem', fontSize: '1.15rem' }}>
              7 Indicateurs Environnementaux
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', marginBottom: '2rem', justifyContent: 'center' }}>
              {indicators.map((ind, i) => (
                <span key={i} style={{
                  padding: '.5rem 1rem', borderRadius: 30, fontWeight: 700,
                  fontSize: '.82rem', background: 'white', color: C.primary,
                  border: `2px solid ${C.pale}`, boxShadow: '0 2px 8px rgba(45,106,79,.1)',
                }}>
                  {ind}
                </span>
              ))}
            </div>
            <div style={{ padding: '1.25rem', background: 'white', borderRadius: 12,
              border: `1px solid ${C.pale}`, boxShadow: '0 2px 12px rgba(45,106,79,.08)', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: C.dark, marginBottom: '.5rem', fontSize: '.9rem' }}>
                Contexte — Crise hydrique au Maroc
              </div>
              <p style={{ fontSize: '.82rem', color: C.muted, lineHeight: 1.65, margin: 0 }}>
                Le Maroc est passé de <strong>2 560 m³/habitant/an</strong> en 1960 à seulement{' '}
                <strong>565 m³</strong> aujourd'hui. L'agriculture consomme <strong>80%</strong> des ressources en eau.
                HydroVision aide à optimiser l'irrigation et réduire le gaspillage grâce à la prédiction précise.
              </p>
            </div>
          </div>

          {/* Right: cards */}
          <div data-aos="fade-left" data-aos-delay="200">
            {[
              { icon: '🛰️', title: 'Données Satellite', text: '36 ans de données (1990-2026) issues de Google Earth Engine — Sentinel-2, Landsat et MODIS.' },
              { icon: '🤖', title: 'IA & Modèles ML', text: '8 algorithmes comparés : RandomForest, XGBoost, LightGBM, AdaBoost, GRU. R² = 97.34%.' },
              { icon: '⚡', title: 'Pipeline Automatisé', text: 'De l\'ingestion des données jusqu\'au déploiement en production, via ClearML et Docker.' },
            ].map((c, i) => (
              <div key={i} style={{
                padding: '1rem', marginBottom: '.75rem',
                background: 'white', borderRadius: 12, border: `1px solid ${C.pale}`,
                boxShadow: '0 2px 8px rgba(45,106,79,.06)',
                transition: 'transform .2s, box-shadow .2s',
                textAlign: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = `0 4px 16px rgba(45,106,79,.15)`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(45,106,79,.06)'; }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '.35rem' }}>{c.icon}</div>
                <div style={{ fontWeight: 700, color: C.dark, fontSize: '.9rem', marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: '.8rem', color: C.muted, lineHeight: 1.55 }}>{c.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════
   FEATURES
══════════════════════════════════════════════════════════════ */
function FeaturesSection() {
  const features = [
    {
      icon: '📊', color: '#0284c7', bg: '#eff6ff',
      title: 'Analyse Temps Réel',
      items: ['Surveillance continue des 7 indicateurs', 'Alertes automatiques sur dérive', 'Dashboard qualité données', 'Rapport détection outliers'],
    },
    {
      icon: '🤖', color: C.primary, bg: '#f0fdf4',
      title: 'IA & Machine Learning',
      items: ['8 modèles ML pré-configurés', 'Entraînement automatisé ClearML', 'Hyperparameter tuning GUI', 'Model comparison dashboard'],
    },
    {
      icon: '🗺️', color: '#7c3aed', bg: '#faf5ff',
      title: 'Cartographie Prédictive',
      items: ['Visualisation géospatiale Leaflet', '4 couches : CWSI, LST, NDVI, Précip.', 'Export CSV / GeoJSON / Shapefile', 'Historique 1990-2026 par région'],
    },
    {
      icon: '🔄', color: '#d97706', bg: '#fffbeb',
      title: 'Pipeline Orchestration',
      items: ['Wizard de configuration étape par étape', 'Intégration ClearML native', 'CI/CD automatisé des modèles', 'Logs temps réel & monitoring'],
    },
    {
      icon: '✅', color: '#059669', bg: '#f0fdf4',
      title: 'Validation & Qualité',
      items: ['Détection de drift PSI + KS', 'Gestion des valeurs manquantes', 'Validation schéma données', 'Score qualité par fichier'],
    },
    {
      icon: '👥', color: '#dc2626', bg: '#fef2f2',
      title: 'Gestion Multi-Rôles',
      items: ['Admin : projets + utilisateurs', 'Data Engineer : datasets', 'Data Scientist : modèles ML', 'MLOps : cartes & tableaux de bord'],
    },
  ];

  return (
    <Section id="features" bg={C.white} style={{ padding: '6rem 3rem' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ background: C.pale, color: C.primary, padding: '.3rem .9rem',
            borderRadius: 30, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.6px' }}>
            FONCTIONNALITÉS
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: C.dark, margin: '.75rem 0 1rem' }}>
            Une plateforme complète de bout en bout
          </h2>
          <p style={{ color: C.muted, maxWidth: 550, margin: '0 auto', lineHeight: 1.65 }}>
            De l'ingestion des données satellite jusqu'à la visualisation des prédictions — tout est intégré.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem' }}>
          {features.map((f, i) => (
            <div key={i} data-aos="fade-up" data-aos-delay={i * 80} style={{
              padding: '1.5rem', borderRadius: 16, background: 'white',
              border: '1.5px solid #f0f0f0', boxShadow: '0 2px 10px rgba(0,0,0,.05)',
              transition: 'all .25s', textAlign: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,.1)`; e.currentTarget.style.borderColor = f.color + '30'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.05)'; e.currentTarget.style.borderColor = '#f0f0f0'; }}>
              <h3 style={{ fontWeight: 700, color: C.dark, fontSize: '1rem', marginBottom: '.75rem' }}>{f.title}</h3>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {f.items.map((item, j) => (
                  <li key={j} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontSize: '.82rem', color: C.muted, marginBottom: '.4rem', lineHeight: 1.45,
                    justifyContent: 'center',
                  }}>
                    <span style={{ color: f.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROLES
══════════════════════════════════════════════════════════════ */
function RolesSection() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useContext(AuthContext);
  const roles = [
    {
      icon: '👨‍💼', title: 'Data Engineer',
      color: '#0284c7', gradFrom: '#eff6ff', gradTo: '#dbeafe',
      tag: 'data_engineer',
      responsibilities: ['Import & versioning des datasets', 'Validation qualité des données', 'Détection drift & outliers', 'Monitoring pipeline dataset'],
      tools: ['Dataset Creator avec filtres régionaux', 'Validation automatique des colonnes', 'Rapports qualité temps réel', 'Import CSV par région (El Jadida…)'],
    },
    {
      icon: '⚙️', title: 'MLOps Engineer',
      color: '#7c3aed', gradFrom: '#faf5ff', gradTo: '#ede9fe',
      tag: 'mlops_engineer',
      responsibilities: ['Orchestration des pipelines', 'Monitoring en production', 'CI/CD des modèles', 'Gestion de l\'infrastructure'],
      tools: ['Pipeline Orchestrator Wizard', 'Intégration ClearML native', 'Alertes drift & performance', 'Carte prédictive interactive'],
    },
  ];

  return (
    <Section id="roles" bg="#fafafa" style={{ padding: '6rem 3rem' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ background: C.pale, color: C.primary, padding: '.3rem .9rem',
            borderRadius: 30, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.6px' }}>
            RÔLES
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: C.dark, margin: '.75rem 0 1rem' }}>
            Une plateforme pour chaque rôle
          </h2>
          <p style={{ color: C.muted, maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            Chaque membre de l'équipe dispose d'un espace dédié, adapté à ses responsabilités et ses outils.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
          {roles.map((r, i) => (
            <div key={i} data-aos="fade-up" data-aos-delay={i * 100} style={{
              background: 'white', borderRadius: 20, overflow: 'hidden',
              border: r.highlight ? `2px solid ${r.color}40` : '1.5px solid #f0f0f0',
              boxShadow: r.highlight ? `0 8px 32px ${r.color}20` : '0 2px 10px rgba(0,0,0,.05)',
              transition: 'all .25s',
              position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = `0 16px 48px ${r.color}25`; e.currentTarget.style.borderColor = r.color + '50'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = r.highlight ? `0 8px 32px ${r.color}20` : '0 2px 10px rgba(0,0,0,.05)'; e.currentTarget.style.borderColor = r.highlight ? `${r.color}40` : '#f0f0f0'; }}>

              {r.highlight && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg,${r.color},${C.light})`,
                }}/>
              )}

              {/* Header */}
              <div style={{
                padding: '1.5rem',
                background: `linear-gradient(135deg,${r.gradFrom},${r.gradTo})`,
                textAlign: 'center',
              }}>
                <h3 style={{ fontWeight: 800, color: r.color, fontSize: '1.15rem', margin: 0 }}>{r.title}</h3>
              </div>

              {/* Body */}
              <div style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.muted,
                    letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: '.6rem' }}>
                    Responsabilités
                  </div>
                  {r.responsibilities.map((item, j) => (
                    <div key={j} style={{
                      display: 'flex', gap: 8, fontSize: '.83rem', color: '#374151',
                      marginBottom: '.35rem', alignItems: 'flex-start', justifyContent: 'center',
                    }}>
                      <span style={{ color: r.color, fontWeight: 700, flexShrink: 0 }}>•</span>
                      {item}
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: `1px solid #f3f4f6`, paddingTop: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: C.muted,
                    letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: '.6rem' }}>
                    Outils disponibles
                  </div>
                  {r.tools.map((item, j) => (
                    <div key={j} style={{
                      display: 'flex', gap: 8, fontSize: '.83rem', color: '#374151',
                      marginBottom: '.35rem', alignItems: 'flex-start', justifyContent: 'center',
                    }}>
                      <span style={{ color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>

                <button onClick={() => navigate(isAuthenticated ? getDashboardPath(role) : '/login')} style={{
                  width: '100%', padding: '.55rem 1rem', borderRadius: 10,
                  background: r.highlight ? `linear-gradient(135deg,${r.color},${C.mid})` : 'white',
                  color: r.highlight ? 'white' : r.color,
                  border: `1.5px solid ${r.color}`,
                  cursor: 'pointer', fontWeight: 700, fontSize: '.85rem',
                  transition: 'all .2s',
                }}>
                  Accéder à l'espace →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}


/* ══════════════════════════════════════════════════════════════
   STATISTICS
══════════════════════════════════════════════════════════════ */
function StatsSection() {
  const stats = [
    { end: 1714623, suffix: '+', label: 'Lignes de données analysées',    icon: '📊' },
    { end: 97.34,   suffix: '%', label: 'Précision R² — RandomForest',    icon: '🎯', decimals: 2 },
    { end: 36,      suffix: ' ans', label: 'Données historiques (1990–2026)', icon: '📅' },
    { end: 7,       suffix: '',   label: 'Indicateurs environnementaux',  icon: '🛰️' },
    { end: 8,       suffix: '',   label: 'Algorithmes ML comparés',        icon: '🤖' },
    { end: 18,      suffix: '+',  label: 'Régions du Maroc couvertes',     icon: '🗺️' },
  ];

  return (
    <Section id="stats" bg="#f0fdf4" style={{ padding: '5rem 3rem' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ background: C.pale, color: C.primary, padding: '.3rem .9rem',
            borderRadius: 30, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.6px' }}>
            CHIFFRES CLÉS
          </span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: C.dark, margin: '.75rem 0' }}>
            La puissance des données
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.25rem' }}>
          {stats.map((s, i) => (
            <div key={i} data-aos="zoom-in" data-aos-delay={i * 80} style={{
              background: 'white', borderRadius: 16, padding: '2rem 1.5rem',
              textAlign: 'center', border: `1px solid ${C.pale}`,
              boxShadow: '0 2px 12px rgba(45,106,79,.08)',
              transition: 'all .25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(45,106,79,.15)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(45,106,79,.08)'; }}>
              <AnimatedStat end={s.end} suffix={s.suffix} decimals={s.decimals} label={s.label} color={C.primary} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════
   TRUSTED BY
══════════════════════════════════════════════════════════════ */
function TrustedSection() {
  return (
    <Section bg="#fafafa" style={{ padding: '5rem 3rem' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div data-aos="fade-up" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '.8rem', fontWeight: 700, color: C.muted, letterSpacing: '1.5px',
            textTransform: 'uppercase', marginBottom: '.75rem' }}>
            Conçu en collaboration avec
          </p>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, color: C.dark, margin: 0 }}>
            Institutions & partenaires marocains
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
          {PARTNERS.map((p, i) => (
            <div key={i} data-aos="fade-up" data-aos-delay={i * 60} style={{
              background: 'white', borderRadius: 14, padding: '1.1rem 1.25rem',
              border: '1.5px solid #f0f0f0', textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,.04)',
              transition: 'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.light; e.currentTarget.style.boxShadow = `0 6px 20px rgba(45,106,79,.12)`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.04)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: `linear-gradient(135deg,${C.pale},${C.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto .75rem',
                fontWeight: 800, fontSize: '.75rem', color: C.primary,
              }}>
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: C.dark, marginBottom: 3 }}>{p.name}</div>
              <div style={{ fontSize: '.72rem', color: C.muted, lineHeight: 1.4, marginBottom: 4 }}>{p.role}</div>
              <div style={{ fontSize: '.68rem', color: C.light, fontWeight: 600 }}>{p.city}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════
   CTA FINAL
══════════════════════════════════════════════════════════════ */
function CTASection() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useContext(AuthContext);
  return (
    <Section bg={C.dark} style={{ padding: '7rem 3rem', position: 'relative', overflow: 'hidden' }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', inset: 0, opacity: .05,
        backgroundImage: `radial-gradient(circle at 30% 50%, rgba(82,183,136,.8) 0%, transparent 50%),
                          radial-gradient(circle at 70% 50%, rgba(45,106,79,.8) 0%, transparent 50%)`,
      }}/>

      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: .8 }}>
          <span style={{
            background: 'rgba(149,213,178,.12)', color: C.accent,
            padding: '.3rem .9rem', borderRadius: 30, fontSize: '.78rem', fontWeight: 700, letterSpacing: '.6px',
            display: 'inline-block', marginBottom: '1.5rem',
          }}>COMMENCER MAINTENANT</span>

          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: 'white',
            fontFamily: 'Montserrat, sans-serif', margin: '0 0 1.25rem', lineHeight: 1.15 }}>
            Prêt à optimiser<br />votre agriculture ?
          </h2>

          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '1.05rem', margin: '0 auto 2.5rem',
            maxWidth: 520, lineHeight: 1.65 }}>
            Rejoignez les équipes qui utilisent HydroVision pour anticiper le stress hydrique
            et prendre des décisions d'irrigation basées sur les données.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(isAuthenticated ? getDashboardPath(role) : '/login')} style={{
              padding: '.85rem 2.2rem', borderRadius: 12, fontWeight: 700, fontSize: '1rem',
              background: `linear-gradient(135deg,${C.light},${C.mid})`,
              color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(82,183,136,.4)',
              transition: 'all .2s',
            }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(82,183,136,.5)'; }}
               onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(82,183,136,.4)'; }}>
              {isAuthenticated ? 'Accéder au tableau de bord →' : 'Se Connecter →'}
            </button>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

/* ══════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════ */
function Footer() {
  const navigate = useNavigate();
  const links = [
    ['À propos', 'about'], ['Fonctionnalités', 'features'],
    ['Rôles', 'roles'],
  ];
  return (
    <footer style={{ background: '#060f09', padding: '3rem 3rem 1.5rem', borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '3rem', marginBottom: '2.5rem' }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg,${C.light},${C.mid})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '.95rem', color: 'white',
              }}>H</div>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'Montserrat, sans-serif' }}>HydroVision</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,.45)', fontSize: '.83rem', lineHeight: 1.65, margin: '0 0 1.25rem', maxWidth: 320 }}>
              Plateforme MLOps pour la prédiction du stress hydrique au Maroc.
              Alimentée par 36 ans de données satellite et des modèles IA de pointe.
            </p>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              {['GitHub', 'LinkedIn', 'Twitter'].map((label, i) => (
                <div key={i} style={{
                  padding: '.35rem .75rem', borderRadius: 8, background: 'rgba(255,255,255,.06)',
                  cursor: 'pointer', fontSize: '.72rem', fontWeight: 600, color: 'rgba(255,255,255,.5)',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,.6)', fontSize: '.75rem',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Navigation
            </div>
            {links.map(([label, id]) => (
              <div key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
                style={{ color: 'rgba(255,255,255,.5)', fontSize: '.85rem', marginBottom: '.55rem',
                  cursor: 'pointer', transition: 'color .2s' }}
                onMouseEnter={e => e.target.style.color = C.accent}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.5)'}>
                {label}
              </div>
            ))}
          </div>

          {/* Platform */}
          <div>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,.6)', fontSize: '.75rem',
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Plateforme
            </div>
            {[['Se Connecter', '/login'], ['Documentation', '#'], ['Contact', '#'], ['GitHub', '#']].map(([label, path]) => (
              <div key={label} onClick={() => path.startsWith('/') ? navigate(path) : null}
                style={{ color: 'rgba(255,255,255,.5)', fontSize: '.85rem', marginBottom: '.55rem',
                  cursor: 'pointer', transition: 'color .2s' }}
                onMouseEnter={e => e.target.style.color = C.accent}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.5)'}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '.5rem',
        }}>
          <div style={{ color: 'rgba(255,255,255,.3)', fontSize: '.78rem' }}>
            © 2026 HydroVision. Tous droits réservés.
          </div>
          <div style={{ color: 'rgba(255,255,255,.3)', fontSize: '.78rem', display: 'flex', gap: '1.25rem' }}>
            <span style={{ cursor: 'pointer' }}>Confidentialité</span>
            <span style={{ cursor: 'pointer' }}>Conditions d'utilisation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  useEffect(() => {
    AOS.init({ duration: 700, easing: 'ease-out-cubic', once: true, offset: 60 });
  }, []);

  return (
    <div style={{ overflowX: 'hidden' }}>
      <LandingNav />
      <HeroSection />
      <CrisisBanner />
      <AboutSection />
      <FeaturesSection />
      <RolesSection />
      <StatsSection />
      <TrustedSection />
      <CTASection />
      <Footer />
    </div>
  );
}

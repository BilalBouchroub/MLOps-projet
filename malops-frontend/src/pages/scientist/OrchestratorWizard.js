import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiUsers } from '../../api/axios';
import './ScientistPages.css';
import {
  DatasetConfig, ValidationConfig, TrainingConfig,
  RegistryConfig, ServingConfig, MonitoringConfig, PredictConfig,
} from './PipelineConfigs';
import {
  Database, Shield, Brain, Box, Server, BarChart3, Target,
  Rocket, ChevronLeft, ChevronRight, SkipForward,
  CheckCircle2, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

const LAUNCH_PIPELINES = ['dataset', 'validation', 'training', 'registry', 'serving', 'monitoring', 'predict'];
const SESSION_KEY = 'orch_launch_state';

/* ── Step definitions ────────────────────────────────────────────────────── */
const STEPS = [
  { key: 'dataset',    label: 'Dataset',    icon: Database,  color: '#0891b2', bg: '#e0f2fe' },
  { key: 'validation', label: 'Validation', icon: Shield,    color: '#0369a1', bg: '#e0f2fe' },
  { key: 'training',   label: 'Training',   icon: Brain,     color: '#16a34a', bg: '#dcfce7' },
  { key: 'registry',   label: 'Registry',   icon: Box,       color: '#d97706', bg: '#fef3c7' },
  { key: 'serving',    label: 'Serving',    icon: Server,    color: '#dc2626', bg: '#fee2e2' },
  { key: 'monitoring', label: 'Monitoring', icon: BarChart3, color: '#db2777', bg: '#fce7f3' },
  { key: 'predict',    label: 'Predict',    icon: Target,    color: '#7c3aed', bg: '#f5f3ff' },
];

const TOTAL = STEPS.length; // 7 pipeline steps + 1 summary = 8 screens

/* ── Default config (mirrors clearml_pipelines.py DEFAULT_CONFIGS) ───────── */
const DEFAULT_CONFIG = {
  dataset: {
    start_year: 1990, end_year: 2026,
    region_nord: true, region_centre: true, region_sud: true,
    nulls_max: 20, min_rows: 1000,
  },
  validation: {
    feat_ndvi: true, feat_ndwi: true, feat_msi: true,
    feat_lst: true, feat_precip: true, feat_soil: true, feat_et0: true,
    psi_threshold: 0.1, ks_pvalue: 0.05,
    outlier_method: 'IQR', outlier_threshold: 3.0, autofix: false,
  },
  training: {
    rf_enabled: true,  rf_n_estimators: 200, rf_max_depth: 10, rf_min_samples: 2,
    xgb_enabled: true, xgb_n_estimators: 200, xgb_lr: 0.1, xgb_max_depth: 6,
    lgb_enabled: true, lgb_n_estimators: 200, lgb_lr: 0.1,
    ada_enabled: true, ada_n_estimators: 100, ada_dt_depth: 4,
    gru_enabled: false, gru_epochs: 100, gru_hidden_size: 64, gru_seq_len: 12,
    custom_enabled: false, custom_file: '',
    test_size: 20, random_seed: 42, target: 'CWSI',
    feat_ndvi: true, feat_ndwi: true, feat_msi: true,
    feat_lst: true, feat_precip: true, feat_soil: true, feat_et0: true,
    feat_dem: false, feat_slope: false,
    cv_enabled: false, cv_k: 5,
  },
  registry: {
    selection_criterion: 'best_r2', r2_min: 0.85,
    auto_archive: true, max_versions: 5,
  },
  serving: {
    model_version: 'v8', port: 8000, workers: 4,
    timeout: 30, auto_scaler: true, health_check_interval: 60,
  },
  monitoring: {
    r2_drop_threshold: 5, r2_email: false,
    psi_threshold: 0.2, psi_email: false,
    check_frequency: 'daily', baseline_period: 'last_30_days',
  },
  predict: {
    year: 2024, month_all: true,
    months: [1,2,3,4,5,6,7,8,9,10,11,12],
    region: 'all', grid_size: 0.1,
    output_csv: true, output_geojson: false, output_shapefile: false,
    stress_low_max: 0.4, stress_mod_max: 0.6,
  },
};

/* ── Summary card ────────────────────────────────────────────────────────── */
function SummaryCard({ step, cfg, onEdit }) {
  const Icon = step.icon;
  const flat = Object.entries(cfg || {}).filter(
    ([, v]) => typeof v !== 'object' && v !== undefined
  );

  return (
    <div style={{
      background: 'white', borderRadius: 10, border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${step.color}`, marginBottom: '.75rem',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '.6rem 1rem', background: '#fafafa',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon size={14} color={step.color}/>
        <span style={{ fontWeight: 700, fontSize: '.86rem', color: '#111827', flex: 1 }}>
          Step {STEPS.indexOf(step) + 1} — {step.label}
        </span>
        <button onClick={onEdit} style={{
          border: 'none', background: step.bg, color: step.color, borderRadius: 6,
          padding: '.2rem .6rem', fontSize: '.72rem', fontWeight: 700, cursor: 'pointer',
        }}>Modifier</button>
      </div>
      <div style={{ padding: '.65rem 1rem' }}>
        {flat.length === 0 ? (
          <span style={{ fontSize: '.76rem', color: '#9ca3af', fontStyle: 'italic' }}>
            Configuration par défaut
          </span>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '.25rem .75rem',
          }}>
            {flat.slice(0, 14).map(([k, v]) => (
              <div key={k} style={{ fontSize: '.73rem', display: 'flex', gap: 5 }}>
                <span style={{ color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0 }}>{k}:</span>
                <span style={{ fontWeight: 600, color: '#374151', wordBreak: 'break-all' }}>
                  {String(v)}
                </span>
              </div>
            ))}
            {flat.length > 14 && (
              <div style={{ fontSize: '.7rem', color: '#9ca3af' }}>
                +{flat.length - 14} paramètres…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stepper bar ─────────────────────────────────────────────────────────── */
function Stepper({ current, onGoTo }) {
  const isSummary = current === TOTAL;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', overflowX: 'auto',
      background: 'white', borderRadius: 12, padding: '1rem 1.5rem',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      marginBottom: '1.5rem', gap: 0,
    }}>
      {STEPS.flatMap((s, i) => {
        const Icon = s.icon;
        const done   = i < current;
        const active = i === current;
        const node = (
          <div
            key={s.key}
            onClick={() => done && onGoTo(i)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              flexShrink: 0, minWidth: 58,
              cursor: done ? 'pointer' : 'default',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: done ? '#10b981' : active ? s.color : '#f3f4f6',
              border: `2.5px solid ${done ? '#10b981' : active ? s.color : '#e5e7eb'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .25s',
              boxShadow: active ? `0 0 0 4px ${s.color}22` : 'none',
            }}>
              {done
                ? <CheckCircle2 size={15} color="white"/>
                : <Icon size={14} color={active ? 'white' : '#9ca3af'}/>
              }
            </div>
            <div style={{
              fontSize: '.6rem', marginTop: 3, fontWeight: done || active ? 700 : 400,
              color: done ? '#10b981' : active ? s.color : '#9ca3af',
              textAlign: 'center', lineHeight: 1.2,
            }}>
              {s.label}
            </div>
          </div>
        );
        const connector = (
          <div key={`conn-${s.key}`} style={{
            flex: 1, height: 2, minWidth: 12,
            background: done ? '#10b981' : '#e5e7eb',
            transition: 'background .3s', margin: '0 3px', marginBottom: 16,
          }}/>
        );
        return [node, connector];
      })}
      {/* Summary dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, minWidth: 54 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: isSummary ? '#7c3aed' : '#f3f4f6',
          border: `2.5px solid ${isSummary ? '#7c3aed' : '#e5e7eb'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isSummary ? '0 0 0 4px #7c3aed22' : 'none',
          transition: 'all .25s',
        }}>
          <Rocket size={14} color={isSummary ? 'white' : '#9ca3af'}/>
        </div>
        <div style={{
          fontSize: '.6rem', marginTop: 3, fontWeight: isSummary ? 700 : 400,
          color: isSummary ? '#7c3aed' : '#9ca3af', textAlign: 'center',
        }}>
          Lancer
        </div>
      </div>
    </div>
  );
}

/* ── Main wizard ─────────────────────────────────────────────────────────── */
export default function OrchestratorWizard() {
  const [step, setStep]               = useState(0);
  const [config, setConfig]           = useState(DEFAULT_CONFIG);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [launching, setLaunching]     = useState(false);
  const [launchMsg, setLaunchMsg]     = useState('');
  const [launchOk, setLaunchOk]       = useState(false);
  const [error, setError]             = useState('');
  const [skipped, setSkipped]         = useState(new Set());
  const [pipelineStatus, setPipelineStatus] = useState({});
  const [myProject, setMyProject] = useState(null);
  const pollLaunchRef = useRef(null);

  /* Load saved config + assigned project on mount */
  useEffect(() => {
    apiUsers.get('/projects/my-project').then(r => setMyProject(r.data)).catch(() => {});
    apiUsers.get('/pipelines/config')
      .then(res => {
        const saved = res.data || {};
        setConfig(prev => {
          const merged = { ...prev };
          for (const key of Object.keys(DEFAULT_CONFIG)) {
            if (saved[key] && Object.keys(saved[key]).length > 0) {
              merged[key] = { ...prev[key], ...saved[key] };
            }
          }
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => setLoadingInit(false));
  }, []);

  const isSummary    = step === TOTAL;
  const currentStep  = STEPS[step];

  /* Update a single field in a pipeline's config */
  const updateConfig = useCallback((pipelineKey, key, val) => {
    setConfig(prev => ({
      ...prev,
      [pipelineKey]: { ...prev[pipelineKey], [key]: val },
    }));
  }, []);

  /* Save current step's config, then advance */
  const handleNext = async () => {
    if (!currentStep) return;
    setSaving(true);
    try {
      await apiUsers.post('/pipelines/config', { [currentStep.key]: config[currentStep.key] });
    } catch {}
    setSaving(false);
    setSkipped(prev => { const s = new Set(prev); s.delete(currentStep.key); return s; });
    setStep(s => s + 1);
  };

  /* Skip = advance without saving */
  const handleSkip = () => {
    if (currentStep) {
      setSkipped(prev => new Set([...prev, currentStep.key]));
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => Math.max(0, s - 1));
  };

  const pollStatus = useCallback(async () => {
    const statuses = {};
    await Promise.all(
      LAUNCH_PIPELINES.map(async (name) => {
        try {
          const r = await apiUsers.get(`/pipelines/${name}/run-status`);
          statuses[name] = r.data.status || 'idle';
        } catch {
          statuses[name] = 'idle';
        }
      })
    );
    setPipelineStatus(statuses);
    const stillRunning = LAUNCH_PIPELINES.some(n => statuses[n] === 'running' || statuses[n] === 'started');
    const hasTerminated = LAUNCH_PIPELINES.some(n => statuses[n] === 'completed' || statuses[n] === 'failed');
    const allDone = hasTerminated && !stillRunning;
    const anyFailed = LAUNCH_PIPELINES.some(n => statuses[n] === 'failed');
    if (allDone) {
      clearInterval(pollLaunchRef.current);
      setLaunching(false);
      setLaunchOk(!anyFailed);
      setLaunchMsg(anyFailed
        ? '⚠️ Certains pipelines ont échoué. Consultez les logs dans Pipeline Manager.'
        : '✅ Tous les pipelines ont terminé avec succès !'
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Restore launch state from sessionStorage on mount */
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      const status = saved.pipelineStatus || {};
      if (Object.keys(status).length === 0) return;
      setPipelineStatus(status);
      setLaunchMsg(saved.launchMsg || '');
      setLaunchOk(!!saved.launchOk);
      /* Revenir sur la page summary pour que la grille de progress soit visible */
      if (saved.step !== undefined) setStep(saved.step);
      const stillRunning = LAUNCH_PIPELINES.some(n => status[n] === 'running' || status[n] === 'started');
      if (stillRunning) {
        setLaunching(true);
        setLaunchMsg('⚡ Suivi relancé — pipelines toujours en cours…');
        clearInterval(pollLaunchRef.current);
        pollLaunchRef.current = setInterval(pollStatus, 2500);
        pollStatus();
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollStatus]);

  /* Persist launch state + step to sessionStorage on every change */
  useEffect(() => {
    if (Object.keys(pipelineStatus).length === 0 && !launchMsg) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ pipelineStatus, launchMsg, launchOk, step }));
  }, [pipelineStatus, launchMsg, launchOk, step]);

  /* Launch the orchestrator */
  const handleLaunch = async () => {
    setLaunching(true);
    setError('');
    setPipelineStatus({});
    setLaunchMsg('Sauvegarde de la configuration…');
    try {
      await apiUsers.post('/pipelines/config', config);
      setLaunchMsg('Lancement des pipelines en cours…');
      const res = await apiUsers.post('/pipelines/run', {
        mode: 'full',
        pipelines: LAUNCH_PIPELINES,
        clearml_project: myProject?.clearml_project_name || null,
      });
      const results = res.data?.results || {};
      const initStatus = {};
      LAUNCH_PIPELINES.forEach(n => {
        initStatus[n] = results[n]?.status === 'started' ? 'running' : (results[n]?.error ? 'failed' : 'idle');
      });
      setPipelineStatus(initStatus);
      setLaunchMsg('⚡ Pipelines lancés — suivi en cours…');
      clearInterval(pollLaunchRef.current);
      pollLaunchRef.current = setInterval(pollStatus, 2500);
    } catch (e) {
      const detail = e.response?.data?.detail || e.userMessage || e.message || 'Erreur lors du lancement.';
      setError(detail);
      setLaunching(false);
      setLaunchMsg('');
    }
  };

  /* Reset the wizard */
  const handleReset = () => {
    clearInterval(pollLaunchRef.current);
    sessionStorage.removeItem(SESSION_KEY);
    setStep(0);
    setSkipped(new Set());
    setError('');
    setLaunchMsg('');
    setLaunchOk(false);
    setLaunching(false);
    setPipelineStatus({});
  };

  /* ── Loading state ── */
  if (loadingInit) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
        <Loader2 size={28} style={{ animation:'spin 1s linear infinite', color:'#7c3aed' }}/>
        <p style={{ color:'#6b7280', fontSize:'.9rem' }}>Chargement de la configuration…</p>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem 3rem' }}>

      {/* ── Projet assigné ── */}
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

      {/* ── Page header ── */}
      <div className="admin-page-header" style={{ marginBottom:'1.5rem' }}>
        <div>
          <h1>Orchestrator Wizard</h1>
          <p>
            Configurez chaque pipeline step-by-step, puis lancez la chaîne MLOps complète.
            &nbsp;·&nbsp;
            <span style={{ color:'#16a34a', fontWeight:600 }}>
              {TOTAL - skipped.size} / {TOTAL} étapes configurées
            </span>
          </p>
        </div>
        <button onClick={handleReset} style={{
          display:'flex', alignItems:'center', gap:6, padding:'.45rem 1rem',
          border:'1px solid #e5e7eb', borderRadius:8, background:'white',
          cursor:'pointer', fontWeight:600, fontSize:'.82rem', color:'#6b7280',
        }}>
          <RefreshCw size={14}/>Recommencer
        </button>
      </div>

      {/* ── Stepper ── */}
      <Stepper current={step} onGoTo={setStep}/>

      {/* ── Step content ── */}
      <div style={{ animation:'fadeIn .2s ease' }}>

        {/* Pipeline config step */}
        {!isSummary && currentStep && (
          <>
            {/* Step header card */}
            <div style={{
              display:'flex', alignItems:'center', gap:14, marginBottom:'1.1rem',
              padding:'1rem 1.25rem', background:'white', borderRadius:12,
              border:`1.5px solid ${currentStep.color}44`,
              borderLeft:`4px solid ${currentStep.color}`,
              boxShadow:'0 1px 4px rgba(0,0,0,.05)',
            }}>
              <div style={{
                width:46, height:46, borderRadius:10,
                background:currentStep.color,
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, boxShadow:`0 4px 12px ${currentStep.color}44`,
              }}>
                {React.createElement(currentStep.icon, { size:20, color:'white' })}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'.7rem', color:'#9ca3af', fontWeight:600, marginBottom:2 }}>
                  Étape {step + 1} / {TOTAL}
                </div>
                <div style={{ fontWeight:700, fontSize:'1rem', color:'#111827' }}>
                  {currentStep.label} — Configuration
                </div>
              </div>
              <div style={{
                padding:'.35rem .85rem', background:currentStep.bg,
                borderRadius:20, fontSize:'.72rem', fontWeight:600, color:currentStep.color,
              }}>
                {skipped.has(currentStep.key) ? '⏭ Ignorée' : 'En cours'}
              </div>
            </div>

            {/* Config form */}
            <div style={{
              background:'white', borderRadius:12, border:'1px solid #e5e7eb',
              padding:'1.25rem', marginBottom:'1.1rem',
              boxShadow:'0 1px 4px rgba(0,0,0,.04)',
            }}>
              {currentStep.key === 'dataset' && (
                <DatasetConfig
                  values={config.dataset}
                  onChange={(k, v) => updateConfig('dataset', k, v)}
                />
              )}
              {currentStep.key === 'validation' && (
                <ValidationConfig
                  values={config.validation}
                  onChange={(k, v) => updateConfig('validation', k, v)}
                />
              )}
              {currentStep.key === 'training' && (
                <TrainingConfig
                  values={config.training}
                  onChange={(k, v) => updateConfig('training', k, v)}
                />
              )}
              {currentStep.key === 'registry' && (
                <RegistryConfig
                  values={config.registry}
                  onChange={(k, v) => updateConfig('registry', k, v)}
                />
              )}
              {currentStep.key === 'serving' && (
                <ServingConfig
                  values={config.serving}
                  onChange={(k, v) => updateConfig('serving', k, v)}
                />
              )}
              {currentStep.key === 'monitoring' && (
                <MonitoringConfig
                  values={config.monitoring}
                  onChange={(k, v) => updateConfig('monitoring', k, v)}
                />
              )}
              {currentStep.key === 'predict' && (
                <PredictConfig
                  values={config.predict}
                  onChange={(k, v) => updateConfig('predict', k, v)}
                />
              )}
            </div>

            {/* Hint */}
            <div style={{
              padding:'.55rem 1rem', background:'#f9fafb', borderRadius:8,
              fontSize:'.75rem', color:'#6b7280', marginBottom:'1rem',
              display:'flex', alignItems:'center', gap:6, border:'1px solid #f3f4f6',
            }}>
              <SkipForward size={13} color="#9ca3af"/>
              <span>
                <strong>Skip</strong> = garde la config actuelle sans sauvegarder.&nbsp;
                <strong>Suivant</strong> = sauvegarde vos modifications puis passe à l'étape suivante.
              </span>
            </div>
          </>
        )}

        {/* Summary + Launch step */}
        {isSummary && (
          <>
            {/* Summary header */}
            <div style={{
              display:'flex', alignItems:'center', gap:14, marginBottom:'1.25rem',
              padding:'1rem 1.25rem', background:'white', borderRadius:12,
              border:'1.5px solid #7c3aed44', borderLeft:'4px solid #7c3aed',
              boxShadow:'0 1px 4px rgba(0,0,0,.05)',
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:'#7c3aed',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, boxShadow:'0 4px 12px #7c3aed44',
              }}>
                <Rocket size={20} color="white"/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'.7rem', color:'#9ca3af', fontWeight:600, marginBottom:2 }}>
                  Étape finale — 8 / 8
                </div>
                <div style={{ fontWeight:700, fontSize:'1rem', color:'#111827' }}>
                  Résumé de la configuration & Lancement
                </div>
              </div>
              <div style={{ fontSize:'.78rem', color:'#6b7280' }}>
                {skipped.size > 0 && (
                  <span style={{ color:'#d97706', fontWeight:600 }}>
                    ⏭ {skipped.size} étape(s) ignorée(s)
                  </span>
                )}
              </div>
            </div>

            {/* Summary cards */}
            {STEPS.map(s => (
              <SummaryCard
                key={s.key}
                step={s}
                cfg={config[s.key]}
                onEdit={() => setStep(STEPS.indexOf(s))}
              />
            ))}

            {/* Error */}
            {error && (
              <div style={{
                display:'flex', alignItems:'center', gap:8, padding:'.75rem 1rem',
                background:'#fef2f2', borderRadius:8, border:'1px solid #fca5a5',
                color:'#991b1b', fontSize:'.83rem', marginBottom:'1rem',
              }}>
                <AlertCircle size={15}/>
                {error}
              </div>
            )}

            {/* Launch status message */}
            {launchMsg && (
              <div style={{
                display:'flex', alignItems:'center', gap:8, padding:'.75rem 1rem',
                background: launchOk ? '#f0fdf4' : launchMsg.includes('⚠️') ? '#fffbeb' : '#eff6ff',
                borderRadius:8,
                border:`1px solid ${launchOk ? '#86efac' : launchMsg.includes('⚠️') ? '#fde68a' : '#93c5fd'}`,
                color: launchOk ? '#15803d' : launchMsg.includes('⚠️') ? '#92400e' : '#1e40af',
                fontSize:'.83rem', marginBottom:'1rem',
                animation:'fadeInD .2s ease',
              }}>
                {launching && !launchOk && !launchMsg.includes('⚠️') && (
                  <Loader2 size={14} style={{ animation:'spin 1s linear infinite', flexShrink:0 }}/>
                )}
                {launchOk && <CheckCircle2 size={14} color="#15803d" style={{ flexShrink:0 }}/>}
                {launchMsg}
              </div>
            )}

            {/* Per-pipeline live status */}
            {Object.keys(pipelineStatus).length > 0 && (
              <div style={{
                background:'white', borderRadius:10, border:'1px solid #e5e7eb',
                padding:'1rem 1.25rem', marginBottom:'1rem',
                animation:'fadeInD .2s ease',
              }}>
                <div style={{ fontSize:'.75rem', fontWeight:700, color:'#374151', marginBottom:'.75rem', display:'flex', alignItems:'center', gap:6 }}>
                  <Loader2 size={12} style={{ animation: launching ? 'spin 1s linear infinite' : 'none', color:'#6d28d9' }}/>
                  État du lancement
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:'.5rem' }}>
                  {LAUNCH_PIPELINES.map(name => {
                    const s = pipelineStatus[name] || 'idle';
                    const cfg = {
                      running:   { bg:'#eff6ff', border:'#93c5fd', color:'#1e40af', label:'En cours…' },
                      completed: { bg:'#f0fdf4', border:'#86efac', color:'#15803d', label:'Terminé ✓' },
                      failed:    { bg:'#fef2f2', border:'#fca5a5', color:'#991b1b', label:'Échec ✗' },
                      idle:      { bg:'#f9fafb', border:'#e5e7eb', color:'#9ca3af', label:'En attente' },
                      started:   { bg:'#eff6ff', border:'#93c5fd', color:'#1e40af', label:'Démarré' },
                    }[s] || { bg:'#f9fafb', border:'#e5e7eb', color:'#9ca3af', label: s };
                    return (
                      <div key={name} style={{
                        background: cfg.bg, border:`1px solid ${cfg.border}`,
                        borderRadius:8, padding:'.45rem .65rem',
                        transition:'all .3s',
                      }}>
                        <div style={{ fontSize:'.7rem', fontWeight:700, color:'#374151', textTransform:'capitalize', marginBottom:2 }}>
                          {name}
                        </div>
                        <div style={{ fontSize:'.68rem', fontWeight:600, color: cfg.color, display:'flex', alignItems:'center', gap:4 }}>
                          {s === 'running' && <Loader2 size={9} style={{ animation:'spin 1s linear infinite' }}/>}
                          {s === 'completed' && <CheckCircle2 size={9}/>}
                          {s === 'failed' && <AlertCircle size={9}/>}
                          {cfg.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Navigation footer ── */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'1rem 1.25rem', background:'white', borderRadius:12,
        border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,.06)',
        marginTop:'.25rem',
      }}>
        {/* Back */}
        <button
          onClick={handleBack}
          disabled={step === 0}
          style={{
            display:'flex', alignItems:'center', gap:5, padding:'.5rem 1.1rem',
            border:'1px solid #d1d5db', borderRadius:8, background:'white',
            cursor: step === 0 ? 'not-allowed' : 'pointer', fontWeight:600,
            fontSize:'.84rem', color: step === 0 ? '#d1d5db' : '#374151',
          }}
        >
          <ChevronLeft size={15}/>Précédent
        </button>

        {/* Center indicator */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          fontSize:'.78rem', color:'#6b7280', fontWeight:600,
        }}>
          {!isSummary ? (
            <>
              <div style={{
                width:6, height:6, borderRadius:'50%',
                background: currentStep?.color || '#6b7280',
              }}/>
              {step + 1} / {TOTAL} — {currentStep?.label}
            </>
          ) : (
            <>
              <Rocket size={13} color="#7c3aed"/>
              Résumé & Lancement
            </>

          )}
        </div>

        {/* Right: actions */}
        <div style={{ display:'flex', gap:'.5rem' }}>
          {!isSummary && (
            <button onClick={handleSkip} style={{
              display:'flex', alignItems:'center', gap:5, padding:'.5rem 1rem',
              border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb',
              cursor:'pointer', fontWeight:600, fontSize:'.84rem', color:'#6b7280',
            }}>
              <SkipForward size={14}/>Skip
            </button>
          )}

          {!isSummary ? (
            <button onClick={handleNext} disabled={saving} style={{
              display:'flex', alignItems:'center', gap:6, padding:'.5rem 1.3rem',
              background: currentStep?.color || '#6d28d9',
              color:'white', border:'none', borderRadius:8,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight:700, fontSize:'.84rem', opacity: saving ? .7 : 1,
              transition:'opacity .15s',
            }}>
              {saving
                ? <><Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/>Sauvegarde…</>
                : <>Suivant<ChevronRight size={15}/></>
              }
            </button>
          ) : (
            <button onClick={handleLaunch} disabled={launching || launchOk} style={{
              display:'flex', alignItems:'center', gap:8, padding:'.55rem 1.6rem',
              background: launchOk
                ? '#10b981'
                : launching
                  ? '#6b7280'
                  : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
              color:'white', border:'none', borderRadius:8,
              cursor: (launching || launchOk) ? 'not-allowed' : 'pointer',
              fontWeight:700, fontSize:'.88rem',
              boxShadow: (launching || launchOk) ? 'none' : '0 4px 14px rgba(124,58,237,.35)',
              transition:'all .2s',
            }}>
              {launching && !launchOk
                ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/>Lancement…</>
                : launchOk
                  ? <><CheckCircle2 size={15}/>Lancé !</>
                  : <><Rocket size={15}/>Lancer l'Orchestrator</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

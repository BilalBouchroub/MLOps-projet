/**
 * MLops – Graphical config editors for each pipeline.
 * Each component receives { values, onChange } and renders the exact UI from the spec.
 */
import React from 'react';

/* ── Shared primitives ──────────────────────────────────────────────────── */

const ACCENT = '#6d28d9';

function Card({ title, children, color }) {
  return (
    <div style={{
      background: 'white', borderRadius: 10, border: '1px solid #e5e7eb',
      borderLeft: `3px solid ${color || ACCENT}`,
      marginBottom: '1rem', overflow: 'hidden',
    }}>
      {title && (
        <div style={{
          padding: '.65rem 1rem', background: '#fafafa',
          borderBottom: '1px solid #f3f4f6',
          fontWeight: 700, fontSize: '.85rem', color: '#111827',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>{title}</div>
      )}
      <div style={{ padding: '1rem' }}>{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '.8rem' }}>
      <div style={{ minWidth: 160 }}>
        <div style={{ fontWeight: 600, fontSize: '.83rem', color: '#374151' }}>{label}</div>
        {hint && <div style={{ fontSize: '.7rem', color: '#9ca3af' }}>{hint}</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function SliderField({ label, hint, value, min, max, step = 1, unit = '', onChange }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <Row label={label} hint={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative', height: 6, background: '#e5e7eb', borderRadius: 20 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 20,
            width: `${pct}%`, background: `linear-gradient(90deg,${ACCENT},#818cf8)`,
          }} />
          <input type="range" min={min} max={max} step={step} value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            style={{ position: 'absolute', top: -5, left: 0, width: '100%', height: 16, opacity: 0, cursor: 'pointer' }}
          />
        </div>
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || min)}
          style={{
            width: 72, textAlign: 'center', border: '1px solid #d1d5db',
            borderRadius: 6, padding: '.25rem .4rem', fontWeight: 700,
            fontSize: '.85rem', color: ACCENT,
          }}
        />
        {unit && <span style={{ fontSize: '.78rem', color: '#6b7280', flexShrink: 0 }}>{unit}</span>}
      </div>
    </Row>
  );
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <Row label={label} hint={hint}>
      <button onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? ACCENT : '#d1d5db', position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
          borderRadius: '50%', background: 'white', transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </Row>
  );
}

function SelectField({ label, hint, value, options, onChange }) {
  return (
    <Row label={label} hint={hint}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          border: '1px solid #d1d5db', borderRadius: 7, padding: '.35rem .75rem',
          fontSize: '.85rem', fontWeight: 600, color: '#374151', background: 'white',
          cursor: 'pointer',
        }}>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </Row>
  );
}

function CheckGroup({ items, values, onChange, columns = 4 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '.4rem',
    }}>
      {items.map(item => (
        <label key={item.key} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '.35rem .6rem', borderRadius: 7,
          background: values[item.key] ? '#f5f3ff' : '#f9fafb',
          border: `1px solid ${values[item.key] ? '#c4b5fd' : '#e5e7eb'}`,
          fontSize: '.8rem', fontWeight: values[item.key] ? 700 : 500,
          color: values[item.key] ? ACCENT : '#6b7280',
        }}>
          <input type="checkbox" checked={!!values[item.key]}
            onChange={e => onChange(item.key, e.target.checked)}
            style={{ accentColor: ACCENT }}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, onChange, width = 90 }) {
  return (
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(parseFloat(e.target.value) || min)}
      style={{
        width, border: '1px solid #d1d5db', borderRadius: 7,
        padding: '.35rem .6rem', fontSize: '.88rem', fontWeight: 700, color: ACCENT,
        textAlign: 'center',
      }}
    />
  );
}

function SectionTitle({ children, color }) {
  return (
    <div style={{
      fontWeight: 700, fontSize: '.82rem', color: color || '#374151',
      padding: '.5rem 0 .4rem', borderBottom: '1px solid #f3f4f6',
      marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: 5,
    }}>{children}</div>
  );
}

/* ── Pipeline 1: Dataset ────────────────────────────────────────────────── */
export function DatasetConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  return (
    <div>
      <Card title="📅 Période" color="#0891b2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '.5rem' }}>
          <span style={{ fontSize: '.82rem', color: '#6b7280', minWidth: 80 }}>Début</span>
          <NumberInput value={v.start_year} min={1980} max={v.end_year - 1}
            onChange={val => o('start_year', val)} />
          <div style={{ flex: 1, height: 3, background: `linear-gradient(90deg,${ACCENT},#818cf8)`, borderRadius: 20 }} />
          <NumberInput value={v.end_year} min={v.start_year + 1} max={2030}
            onChange={val => o('end_year', val)} />
          <span style={{ fontSize: '.82rem', color: '#6b7280', minWidth: 40 }}>Fin</span>
        </div>
        <div style={{ fontSize: '.73rem', color: '#9ca3af', textAlign: 'center' }}>
          {v.end_year - v.start_year} années sélectionnées
        </div>
      </Card>

      <Card title="🗺️ Régions géographiques" color="#0891b2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {[
            { key: 'region_nord',   label: 'Nord',   sub: 'latitude > 34°N' },
            { key: 'region_centre', label: 'Centre', sub: '31° – 34°N' },
            { key: 'region_sud',    label: 'Sud',    sub: 'latitude < 31°N' },
          ].map(r => (
            <label key={r.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '.5rem .75rem', borderRadius: 8,
              background: v[r.key] ? '#e0f2fe' : '#f9fafb',
              border: `1px solid ${v[r.key] ? '#7dd3fc' : '#e5e7eb'}`,
            }}>
              <input type="checkbox" checked={!!v[r.key]}
                onChange={e => o(r.key, e.target.checked)}
                style={{ accentColor: '#0891b2', width: 16, height: 16 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{r.label}</div>
                <div style={{ fontSize: '.72rem', color: '#6b7280' }}>{r.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card title="🔍 Filtres qualité" color="#0891b2">
        <SliderField label="Nulls max" hint="% valeurs manquantes autorisées"
          value={v.nulls_max} min={0} max={50} step={1} unit="%"
          onChange={val => o('nulls_max', val)} />
        <Row label="Min lignes" hint="Lignes minimum par fichier CSV">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberInput value={v.min_rows} min={100} max={100000} step={100}
              onChange={val => o('min_rows', val)} width={110} />
            <span style={{ fontSize: '.78rem', color: '#6b7280' }}>lignes</span>
          </div>
        </Row>
      </Card>
    </div>
  );
}

/* ── Pipeline 2: Validation ─────────────────────────────────────────────── */
export function ValidationConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  const features = [
    { key: 'feat_ndvi', label: 'NDVI' }, { key: 'feat_ndwi', label: 'NDWI' },
    { key: 'feat_msi',  label: 'MSI' },  { key: 'feat_lst',  label: 'LST' },
    { key: 'feat_precip', label: 'Precipitation' },
    { key: 'feat_soil', label: 'SoilMoisture' }, { key: 'feat_et0', label: 'ET0' },
  ];
  return (
    <div>
      <Card title="✅ Features obligatoires" color="#0891b2">
        <CheckGroup items={features} values={v}
          onChange={(key, val) => o(key, val)} columns={4} />
      </Card>

      <Card title="📊 Drift Detection" color="#0891b2">
        <SliderField label="PSI threshold" hint="Population Stability Index"
          value={v.psi_threshold} min={0.02} max={0.5} step={0.01}
          onChange={val => o('psi_threshold', val)} />
        <SliderField label="KS p-value" hint="Kolmogorov-Smirnov significance"
          value={v.ks_pvalue} min={0.01} max={0.2} step={0.005}
          onChange={val => o('ks_pvalue', val)} />
      </Card>

      <Card title="🔎 Détection Outliers" color="#0891b2">
        <SelectField label="Méthode" value={v.outlier_method}
          options={[
            { value: 'IQR', label: 'IQR (Interquartile Range)' },
            { value: 'zscore', label: 'Z-Score' },
            { value: 'isolation_forest', label: 'Isolation Forest' },
          ]}
          onChange={val => o('outlier_method', val)} />
        <SliderField label="Seuil" hint={v.outlier_method === 'zscore' ? 'Nombre de σ' : 'Facteur IQR'}
          value={v.outlier_threshold} min={1} max={5} step={0.1}
          onChange={val => o('outlier_threshold', val)} />
        <Toggle label="Auto-fix" hint="Imputation automatique des valeurs aberrantes"
          value={v.autofix} onChange={val => o('autofix', val)} />
      </Card>
    </div>
  );
}

/* ── Pipeline 3: Training ⭐ ───────────────────────────────────────────── */
function ModelCard({ name, icon, color, enabled, enabledKey, children, onChange }) {
  return (
    <div style={{
      border: `2px solid ${enabled ? color : '#e5e7eb'}`,
      borderRadius: 10, marginBottom: '.75rem', overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '.6rem 1rem',
        background: enabled ? `${color}15` : '#f9fafb', cursor: 'pointer',
      }}
        onClick={() => onChange(enabledKey, !enabled)}>
        <input type="checkbox" checked={enabled}
          onChange={e => onChange(enabledKey, e.target.checked)}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: color, width: 16, height: 16 }} />
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '.9rem', color: enabled ? color : '#9ca3af' }}>
          {name}
        </span>
      </div>
      {enabled && (
        <div style={{ padding: '.75rem 1rem 0', borderTop: `1px solid ${color}30` }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function TrainingConfig({ values, onChange }) {
  const v = values;
  const o = onChange;

  const features = [
    { key: 'feat_ndvi', label: 'NDVI' }, { key: 'feat_ndwi', label: 'NDWI' },
    { key: 'feat_msi',  label: 'MSI'  }, { key: 'feat_lst',  label: 'LST'  },
    { key: 'feat_precip', label: 'Precipitation' },
    { key: 'feat_soil', label: 'SoilMoisture' },
    { key: 'feat_et0',  label: 'ET0'  },
    { key: 'feat_dem',  label: 'DEM'  }, { key: 'feat_slope', label: 'Slope' },
  ];

  return (
    <div>
      {/* Models */}
      <Card title="🤖 Modèles à entraîner" color="#16a34a">
        <ModelCard name="RandomForest" icon="🌲" color="#16a34a"
          enabled={!!v.rf_enabled} enabledKey="rf_enabled" onChange={o}>
          <SliderField label="n_estimators" value={v.rf_n_estimators}
            min={50} max={600} step={50} onChange={val => o('rf_n_estimators', val)} />
          <SliderField label="max_depth" value={v.rf_max_depth}
            min={3} max={30} step={1} onChange={val => o('rf_max_depth', val)} />
          <SliderField label="min_samples_split" value={v.rf_min_samples}
            min={2} max={20} step={1} onChange={val => o('rf_min_samples', val)} />
        </ModelCard>

        <ModelCard name="XGBoost" icon="⚡" color="#d97706"
          enabled={!!v.xgb_enabled} enabledKey="xgb_enabled" onChange={o}>
          <SliderField label="n_estimators" value={v.xgb_n_estimators}
            min={50} max={600} step={50} onChange={val => o('xgb_n_estimators', val)} />
          <SliderField label="max_depth" value={v.xgb_max_depth}
            min={2} max={15} step={1} onChange={val => o('xgb_max_depth', val)} />
          <SliderField label="learning_rate" value={v.xgb_lr}
            min={0.01} max={0.5} step={0.01} onChange={val => o('xgb_lr', val)} />
        </ModelCard>

        <ModelCard name="LightGBM" icon="💡" color="#0891b2"
          enabled={!!v.lgb_enabled} enabledKey="lgb_enabled" onChange={o}>
          <SliderField label="n_estimators" value={v.lgb_n_estimators}
            min={50} max={600} step={50} onChange={val => o('lgb_n_estimators', val)} />
          <SliderField label="learning_rate" value={v.lgb_lr}
            min={0.01} max={0.5} step={0.01} onChange={val => o('lgb_lr', val)} />
        </ModelCard>

        <ModelCard name="AdaBoost" icon="🔄" color="#7c3aed"
          enabled={!!v.ada_enabled} enabledKey="ada_enabled" onChange={o}>
          <SliderField label="n_estimators" value={v.ada_n_estimators}
            min={10} max={300} step={10} onChange={val => o('ada_n_estimators', val)} />
          <SliderField label="DT max_depth" value={v.ada_dt_depth}
            min={1} max={10} step={1} onChange={val => o('ada_dt_depth', val)} />
        </ModelCard>

        <ModelCard name="GRU (Deep Learning)" icon="🧠" color="#db2777"
          enabled={!!v.gru_enabled} enabledKey="gru_enabled" onChange={o}>
          <SliderField label="epochs" value={v.gru_epochs}
            min={10} max={300} step={10} onChange={val => o('gru_epochs', val)} />
          <SliderField label="hidden_size" value={v.gru_hidden_size}
            min={16} max={256} step={16} onChange={val => o('gru_hidden_size', val)} />
          <SliderField label="seq_len" value={v.gru_seq_len}
            min={4} max={32} step={2} onChange={val => o('gru_seq_len', val)} />
        </ModelCard>

        <ModelCard name="Modèle Custom (.py)" icon="📁" color="#374151"
          enabled={!!v.custom_enabled} enabledKey="custom_enabled" onChange={o}>
          <div style={{ marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.78rem', color: '#6b7280', marginBottom: '.4rem' }}>
              Fichier Python avec classe compatible sklearn (fit/predict)
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '.5rem .75rem',
              border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer',
              background: '#f9fafb', fontSize: '.82rem', color: '#6b7280',
            }}>
              📁 {v.custom_file || 'Sélectionner un fichier .py'}
              <input type="file" accept=".py"
                onChange={e => o('custom_file', e.target.files[0]?.name || '')}
                style={{ display: 'none' }} />
            </label>
          </div>
        </ModelCard>
      </Card>

      {/* Split */}
      <Card title="✂️ Train / Test Split" color="#16a34a">
        <SliderField label="Test size" value={v.test_size}
          min={5} max={40} step={1} unit="%"
          onChange={val => o('test_size', val)} />
        <Row label="Random seed">
          <NumberInput value={v.random_seed} min={0} max={9999} step={1}
            onChange={val => o('random_seed', val)} />
        </Row>
      </Card>

      {/* Target */}
      <Card title="🎯 Variable cible" color="#16a34a">
        <div style={{ display: 'flex', gap: '.75rem' }}>
          {[
            { v: 'CWSI', label: 'CWSI', hint: 'Continu [0–1]' },
            { v: 'Stress_binaire', label: 'Stress binaire', hint: 'Classif 0/1' },
          ].map(t => (
            <label key={t.v} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '.65rem', border: `2px solid ${v.target === t.v ? '#16a34a' : '#e5e7eb'}`,
              borderRadius: 8, cursor: 'pointer',
              background: v.target === t.v ? '#dcfce7' : '#f9fafb',
            }}>
              <input type="radio" value={t.v} checked={v.target === t.v}
                onChange={() => o('target', t.v)} style={{ accentColor: '#16a34a', marginBottom: 4 }} />
              <span style={{ fontWeight: 700, fontSize: '.85rem', color: v.target === t.v ? '#15803d' : '#6b7280' }}>
                {t.label}
              </span>
              <span style={{ fontSize: '.7rem', color: '#9ca3af' }}>{t.hint}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Features */}
      <Card title="📐 Features utilisées" color="#16a34a">
        <CheckGroup items={features} values={v}
          onChange={(key, val) => o(key, val)} columns={5} />
      </Card>

      {/* Cross-validation */}
      <Card title="🔁 Cross-Validation" color="#16a34a">
        <Toggle label="Activer K-Fold CV"
          value={!!v.cv_enabled} onChange={val => o('cv_enabled', val)} />
        {v.cv_enabled && (
          <SliderField label="K folds" hint="Nombre de plis"
            value={v.cv_k} min={2} max={10} step={1}
            onChange={val => o('cv_k', val)} />
        )}
      </Card>
    </div>
  );
}

/* ── Pipeline 4: Registry ───────────────────────────────────────────────── */
export function RegistryConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  const criteria = [
    { value: 'best_r2',    label: '📈 Meilleur R²',         hint: 'Maximise le coefficient de détermination' },
    { value: 'best_rmse',  label: '📉 Meilleur RMSE',        hint: 'Minimise l\'erreur quadratique' },
    { value: 'compromise', label: '⚖️  Compromis R²/RMSE',   hint: 'Score pondéré R² + RMSE' },
    { value: 'manual',     label: '🖐️  Manuel',              hint: 'Sélection manuelle de la version' },
  ];
  return (
    <div>
      <Card title="🏆 Critère de sélection production" color="#d97706">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {criteria.map(c => (
            <label key={c.value} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '.65rem .9rem',
              borderRadius: 8, cursor: 'pointer',
              border: `2px solid ${v.selection_criterion === c.value ? '#d97706' : '#e5e7eb'}`,
              background: v.selection_criterion === c.value ? '#fef3c7' : 'white',
            }}>
              <input type="radio" value={c.value} checked={v.selection_criterion === c.value}
                onChange={() => o('selection_criterion', c.value)}
                style={{ accentColor: '#d97706', width: 16, height: 16 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{c.label}</div>
                <div style={{ fontSize: '.72rem', color: '#6b7280' }}>{c.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      <Card title="📊 Seuil de qualité" color="#d97706">
        <SliderField label="R² minimum" hint="Modèle refusé si R² inférieur à ce seuil"
          value={v.r2_min} min={0.5} max={0.99} step={0.01}
          onChange={val => o('r2_min', val)} />
        <div style={{
          padding: '.5rem .75rem', background: '#fef3c7', borderRadius: 7,
          fontSize: '.75rem', color: '#92400e', marginTop: '.25rem',
        }}>
          ℹ️ Le challenger doit dépasser le champion d'au moins +0.001 R² pour être promu.
        </div>
      </Card>

      <Card title="🗂️ Auto-archivage" color="#d97706">
        <Toggle label="Archiver anciennes versions"
          hint="Supprime automatiquement les versions excédentaires"
          value={!!v.auto_archive} onChange={val => o('auto_archive', val)} />
        {v.auto_archive && (
          <SliderField label="Versions max conservées" value={v.max_versions}
            min={2} max={20} step={1} onChange={val => o('max_versions', val)} />
        )}
      </Card>
    </div>
  );
}

/* ── Pipeline 5: Serving ────────────────────────────────────────────────── */
const MODEL_VERSIONS = [
  { value: 'v8', label: 'v8 – RandomForest (R²=0.9734) ⭐ Production' },
  { value: 'v7', label: 'v7 – RandomForest (R²=0.9699)' },
  { value: 'v6', label: 'v6 – RandomForest (R²=0.9699)' },
  { value: 'v5', label: 'v5 – RandomForest (R²=0.9699)' },
  { value: 'v4', label: 'v4 – RandomForest (R²=0.9699)' },
  { value: 'v3', label: 'v3 – RandomForest (R²=0.9696)' },
  { value: 'v2', label: 'v2 – RandomForest (R²=0.9696)' },
  { value: 'v1', label: 'v1 – RandomForest (R²=0.9568)' },
];

export function ServingConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  return (
    <div>
      <Card title="🚀 Modèle à déployer" color="#dc2626">
        <SelectField label="Version" hint="Sélectionner la version à mettre en production"
          value={v.model_version} options={MODEL_VERSIONS}
          onChange={val => o('model_version', val)} />
        <div style={{
          padding: '.5rem .75rem', background: '#fef2f2', borderRadius: 7,
          fontSize: '.75rem', color: '#991b1b', marginTop: '.25rem',
        }}>
          ⚠️ Le changement de version redémarre le serveur de prédiction.
        </div>
      </Card>

      <Card title="⚙️ Configuration serveur" color="#dc2626">
        <Row label="Port">
          <NumberInput value={v.port} min={1024} max={65535} step={1}
            onChange={val => o('port', val)} width={100} />
        </Row>
        <SliderField label="Workers" hint="Processus parallèles (dépend du CPU)"
          value={v.workers} min={1} max={16} step={1}
          onChange={val => o('workers', val)} />
        <Row label="Timeout" hint="Secondes avant abandon d'une requête">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberInput value={v.timeout} min={5} max={120} step={5}
              onChange={val => o('timeout', val)} width={90} />
            <span style={{ fontSize: '.78rem', color: '#6b7280' }}>secondes</span>
          </div>
        </Row>
      </Card>

      <Card title="🔧 Options avancées" color="#dc2626">
        <Toggle label="Auto-charger scaler.pkl"
          hint="Charge automatiquement le scaler associé au modèle"
          value={!!v.auto_scaler} onChange={val => o('auto_scaler', val)} />
        <Row label="Health check" hint="Intervalle de vérification de santé">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NumberInput value={v.health_check_interval} min={10} max={600} step={10}
              onChange={val => o('health_check_interval', val)} width={90} />
            <span style={{ fontSize: '.78rem', color: '#6b7280' }}>secondes</span>
          </div>
        </Row>
      </Card>
    </div>
  );
}

/* ── Pipeline 6: Monitoring ─────────────────────────────────────────────── */
export function MonitoringConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  return (
    <div>
      <Card title="🚨 Alertes" color="#db2777">
        <SectionTitle color="#db2777">📉 Chute de R²</SectionTitle>
        <SliderField label="Seuil chute R²" hint="Alerte si R² baisse de X%"
          value={v.r2_drop_threshold} min={1} max={20} step={1} unit="%"
          onChange={val => o('r2_drop_threshold', val)} />
        <Toggle label="Notification email" hint="Envoyer un email si R² chute"
          value={!!v.r2_email} onChange={val => o('r2_email', val)} />

        <SectionTitle color="#db2777" style={{ marginTop: '.75rem' }}>📊 Drift PSI</SectionTitle>
        <SliderField label="Seuil PSI" hint="Alerte si drift données > seuil"
          value={v.psi_threshold} min={0.05} max={0.5} step={0.05}
          onChange={val => o('psi_threshold', val)} />
        <Toggle label="Notification email" hint="Envoyer un email si drift détecté"
          value={!!v.psi_email} onChange={val => o('psi_email', val)} />
      </Card>

      <Card title="⏱️ Fréquence de monitoring" color="#db2777">
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {[
            { v: 'hourly',  label: '⏰ Horaire' },
            { v: 'daily',   label: '📅 Quotidien' },
            { v: 'weekly',  label: '📆 Hebdomadaire' },
          ].map(f => (
            <label key={f.v} style={{
              flex: 1, minWidth: 100, display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '.6rem', cursor: 'pointer',
              border: `2px solid ${v.check_frequency === f.v ? '#db2777' : '#e5e7eb'}`,
              borderRadius: 8, background: v.check_frequency === f.v ? '#fce7f3' : 'white',
            }}>
              <input type="radio" value={f.v} checked={v.check_frequency === f.v}
                onChange={() => o('check_frequency', f.v)}
                style={{ accentColor: '#db2777', marginBottom: 4 }} />
              <span style={{ fontWeight: 700, fontSize: '.82rem',
                color: v.check_frequency === f.v ? '#9d174d' : '#6b7280' }}>{f.label}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="📏 Baseline de comparaison" color="#db2777">
        <SelectField label="Période" hint="Référence pour calculer les métriques de drift"
          value={v.baseline_period}
          options={[
            { value: 'last_7_days',  label: '7 derniers jours' },
            { value: 'last_30_days', label: '30 derniers jours' },
            { value: 'last_90_days', label: '90 derniers jours' },
            { value: 'all_time',     label: 'Depuis le début' },
          ]}
          onChange={val => o('baseline_period', val)} />
      </Card>
    </div>
  );
}

/* ── Pipeline 7: Predict ────────────────────────────────────────────────── */
const MONTHS = [
  { key: 1, label: 'Jan' }, { key: 2, label: 'Fév' }, { key: 3, label: 'Mar' },
  { key: 4, label: 'Avr' }, { key: 5, label: 'Mai' }, { key: 6, label: 'Jui' },
  { key: 7, label: 'Jul' }, { key: 8, label: 'Aoû' }, { key: 9, label: 'Sep' },
  { key: 10,label: 'Oct' }, { key: 11,label: 'Nov' }, { key: 12,label: 'Déc' },
];

export function PredictConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  const months = Array.isArray(v.months) ? v.months : [1,2,3,4,5,6,7,8,9,10,11,12];

  const toggleMonth = (m) => {
    const cur = months.includes(m) ? months.filter(x => x !== m) : [...months, m].sort((a,b)=>a-b);
    o('months', cur);
  };

  return (
    <div>
      <Card title="📅 Période de prédiction" color="#7c3aed">
        <Row label="Année">
          <NumberInput value={v.year} min={2015} max={2030} step={1}
            onChange={val => o('year', val)} />
        </Row>
        <div style={{ marginBottom: '.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.4rem' }}>
            <span style={{ fontWeight: 600, fontSize: '.83rem', color: '#374151' }}>Mois</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              fontSize: '.78rem', color: '#6b7280' }}>
              <input type="checkbox" checked={!!v.month_all}
                onChange={e => { o('month_all', e.target.checked);
                  if (e.target.checked) o('months', [1,2,3,4,5,6,7,8,9,10,11,12]); }}
                style={{ accentColor: '#7c3aed' }} />
              Tous les mois
            </label>
          </div>
          {!v.month_all && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '.3rem' }}>
              {MONTHS.map(({ key, label }) => (
                <button key={key} onClick={() => toggleMonth(key)} style={{
                  padding: '.3rem .2rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '.78rem',
                  background: months.includes(key) ? '#7c3aed' : '#f3f4f6',
                  color: months.includes(key) ? 'white' : '#6b7280',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="🗺️ Région géographique" color="#7c3aed">
        <SelectField label="Zone" value={v.region}
          options={[
            { value: 'all',    label: 'Tout le Maroc' },
            { value: 'nord',   label: 'Nord (lat > 34°)' },
            { value: 'centre', label: 'Centre (31°–34°)' },
            { value: 'sud',    label: 'Sud (lat < 31°)' },
            { value: 'custom', label: 'Zone personnalisée' },
          ]}
          onChange={val => o('region', val)} />
        <SliderField label="Résolution grille" hint="Degrés décimaux (0.1° ≈ 10 km)"
          value={v.grid_size} min={0.05} max={1.0} step={0.05} unit="°"
          onChange={val => o('grid_size', val)} />
      </Card>

      <Card title="📁 Format de sortie" color="#7c3aed">
        <div style={{ display: 'flex', gap: '.5rem' }}>
          {[
            { key: 'output_csv',       label: '📊 CSV' },
            { key: 'output_geojson',   label: '🌍 GeoJSON' },
            { key: 'output_shapefile', label: '🗺️ Shapefile' },
          ].map(fmt => (
            <label key={fmt.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '.6rem', cursor: 'pointer',
              border: `2px solid ${v[fmt.key] ? '#7c3aed' : '#e5e7eb'}`,
              borderRadius: 8, background: v[fmt.key] ? '#f5f3ff' : 'white',
            }}>
              <input type="checkbox" checked={!!v[fmt.key]}
                onChange={e => o(fmt.key, e.target.checked)}
                style={{ accentColor: '#7c3aed', marginBottom: 4 }} />
              <span style={{ fontWeight: 700, fontSize: '.82rem',
                color: v[fmt.key] ? '#6d28d9' : '#6b7280' }}>{fmt.label}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="🌡️ Seuils de classification stress hydrique" color="#7c3aed">
        <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '.75rem', marginBottom: '.75rem' }}>
          <div style={{ display: 'flex', gap: 0, height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: '.4rem' }}>
            <div style={{ flex: v.stress_low_max, background: '#22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '.65rem', color: 'white', fontWeight: 700 }}>Faible</div>
            <div style={{ flex: v.stress_mod_max - v.stress_low_max, background: '#f59e0b', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '.65rem', color: 'white', fontWeight: 700 }}>Modéré</div>
            <div style={{ flex: 1 - v.stress_mod_max, background: '#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '.65rem', color: 'white', fontWeight: 700 }}>Sévère</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#6b7280' }}>
            <span>0</span><span>{v.stress_low_max}</span><span>{v.stress_mod_max}</span><span>1.0</span>
          </div>
        </div>
        <SliderField label="Faible / Modéré" hint="CWSI < seuil = stress faible"
          value={v.stress_low_max} min={0.1} max={v.stress_mod_max - 0.05} step={0.05}
          onChange={val => o('stress_low_max', val)} />
        <SliderField label="Modéré / Sévère" hint="CWSI < seuil = stress modéré"
          value={v.stress_mod_max} min={v.stress_low_max + 0.05} max={0.95} step={0.05}
          onChange={val => o('stress_mod_max', val)} />
      </Card>
    </div>
  );
}

/* ── Orchestrator master interface ──────────────────────────────────────── */
const PIPELINE_FLOW = [
  { id: 'dataset',    label: '1\nDataset',    color: '#0891b2' },
  { id: 'validation', label: '2\nValidation', color: '#0891b2' },
  { id: 'training',   label: '3\nTraining',   color: '#16a34a' },
  { id: 'registry',   label: '4\nRegistry',   color: '#d97706' },
  { id: 'serving',    label: '5\nServing',    color: '#dc2626' },
  { id: 'monitoring', label: '6\nMonitor',    color: '#db2777' },
  { id: 'predict',    label: '7\nPredict',    color: '#7c3aed' },
];

export function OrchestratorConfig({ values, onChange }) {
  const v = values;
  const o = onChange;
  return (
    <div>
      {/* Visual flow */}
      <Card title="🔗 Flux du pipeline" color="#7c3aed">
        <div style={{ overflowX: 'auto', paddingBottom: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 600 }}>
            {PIPELINE_FLOW.flatMap((p, i) => {
              const node = (
                <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '.5rem .25rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}>
                    <span style={{ color: 'white', fontWeight: 800, fontSize: '.75rem', textAlign: 'center', lineHeight: 1.2 }}>{p.label}</span>
                  </div>
                </div>
              );
              if (i < PIPELINE_FLOW.length - 1) {
                return [node, <div key={`sep-${p.id}`} style={{ color: '#d1d5db', fontSize: '1.2rem', flexShrink: 0 }}>→</div>];
              }
              return [node];
            })}
          </div>
        </div>
      </Card>

      {/* Options */}
      <Card title="⚙️ Options d'exécution" color="#7c3aed">
        <Toggle label="Stop on error"
          hint="Arrêter toute la chaîne si un pipeline échoue"
          value={v.stop_on_error !== false}
          onChange={val => o('stop_on_error', val)} />
      </Card>

      <div style={{
        padding: '.75rem 1rem', background: '#f5f3ff', borderRadius: 8,
        fontSize: '.78rem', color: '#5b21b6', lineHeight: 1.6,
      }}>
        <strong>ℹ️ Configuration individuelle :</strong> Pour configurer chaque pipeline en détail,
        utilisez les cartes "MLops Orchestrator — Mode Training", "Dataset Versioning Pipeline", etc.
        dans la liste principale.
      </div>
    </div>
  );
}

/* ── Router: pick the right component ───────────────────────────────────── */
export function PipelineConfigUI({ pipeline, values, onChange }) {
  const id = pipeline.id;
  const props = { values, onChange };

  if (id === 'pipeline-dataset')    return <DatasetConfig    {...props} />;
  if (id === 'pipeline-validation') return <ValidationConfig {...props} />;
  if (id === 'pipeline-training')   return <TrainingConfig   {...props} />;
  if (id === 'pipeline-registry')   return <RegistryConfig   {...props} />;
  if (id === 'pipeline-serving')    return <ServingConfig    {...props} />;
  if (id === 'pipeline-monitoring') return <MonitoringConfig {...props} />;
  if (id === 'orchestrator-predict') return <PredictConfig   {...props} />;
  if (id.startsWith('orchestrator')) return <OrchestratorConfig {...props} />;

  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
      <p>Pas d'éditeur graphique pour ce pipeline.</p>
      <p style={{ fontSize: '.82rem' }}>Utilisez l'onglet <strong>Code</strong> pour modifier le script.</p>
    </div>
  );
}

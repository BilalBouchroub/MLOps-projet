# ============================================================
#  MALOPS - Prédiction CWSI + Classification Stress Hydrique
# ============================================================

import os
import glob
import json
import joblib
import numpy as np
import pandas as pd
from clearml import Task
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

def _load_config(name):
    path = os.path.join(os.path.expanduser('~/malops-project'), 'pipeline_config.json')
    if not os.path.exists(path):
        return {}
    with open(path) as _f:
        return json.load(_f).get(name, {})

_cfg = _load_config('predict')

# ─────────────────────────────────────────────────────────────
# 1. CLASSIFICATION DU STRESS HYDRIQUE
# ─────────────────────────────────────────────────────────────
def classify_stress(cwsi):
    if cwsi < 0.2:   return 0, 'Pas de stress',  '#1a9850'
    elif cwsi < 0.4: return 1, 'Stress léger',   '#fee08b'
    elif cwsi < 0.6: return 2, 'Stress modéré',  '#fd8d3c'
    elif cwsi < 0.8: return 3, 'Stress sévère',  '#e31a1c'
    else:            return 4, 'Stress extrême', '#800026'

# ─────────────────────────────────────────────────────────────
# 2. CHARGEMENT DES DONNÉES
# ─────────────────────────────────────────────────────────────
DATA_DIR  = os.path.expanduser('~/malops-project/')
csv_files = sorted([f for f in glob.glob(os.path.join(DATA_DIR, 'Maroc_ENV_Features_*.csv'))
                    if 'Zone.Identifier' not in f])

print(f"Chargement de {len(csv_files)} fichiers CSV...")
df = pd.concat([pd.read_csv(f) for f in csv_files], ignore_index=True)

# Nettoyage
DROP_COLS = ['system:index', '.geo', 'TIR', 'LandCover']
df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
df['LST'] = df['LST'] * 0.1 - 273.15
df = df[(df['LST'] > -10) & (df['LST'] < 70)]

FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
df = df.dropna(subset=FEATURES + ['year', 'month'])
df['year'] = df['year'].astype(int)

# Calcul CWSI
lst_stats = df.groupby('month')['LST'].agg(
    LST_wet=lambda x: np.percentile(x, 5),
    LST_dry=lambda x: np.percentile(x, 95)
).reset_index()
df = df.merge(lst_stats, on='month', how='left')
df['CWSI'] = ((df['LST'] - df['LST_wet']) /
              (df['LST_dry'] - df['LST_wet'])).clip(0, 1)

# ─────────────────────────────────────────────────────────────
# 3. SPLIT TEMPOREL
# ─────────────────────────────────────────────────────────────
_train_end = int(_cfg.get('train_end_year', 2019))
_test_start = int(_cfg.get('test_start_year', 2022))
train_df = df[df['year'] <= _train_end]
test_df  = df[df['year'] >= _test_start]

X_train = train_df[FEATURES].values
y_train = train_df['CWSI'].values
X_test  = test_df[FEATURES].values
y_test  = test_df['CWSI'].values

scaler     = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
X_test_sc  = scaler.transform(X_test)

# ─────────────────────────────────────────────────────────────
# 4. CHARGEMENT OU ENTRAÎNEMENT DU MODÈLE
# ─────────────────────────────────────────────────────────────
model_path = os.path.join(DATA_DIR, 'best_model.pkl')

if os.path.exists(model_path):
    print("Chargement du meilleur modèle sauvegardé...")
    model = joblib.load(model_path)
else:
    print("Aucun modèle sauvegardé trouvé, entraînement Random Forest...")
    model = RandomForestRegressor(n_estimators=200, max_depth=10,
                                   random_state=42, n_jobs=-1)
    model.fit(X_train_sc, y_train)
    joblib.dump(model, model_path)

# ─────────────────────────────────────────────────────────────
# 5. PRÉDICTION
# ─────────────────────────────────────────────────────────────
task = Task.init(
    project_name='MALOPS',
    task_name='Prédiction CWSI + Classification Stress',
    tags=['CWSI', 'prediction', 'stress-hydrique']
)

print("Prédiction en cours...")
cwsi_pred = model.predict(X_test_sc)

r2   = r2_score(y_test, cwsi_pred)
rmse = np.sqrt(mean_squared_error(y_test, cwsi_pred))
mae  = mean_absolute_error(y_test, cwsi_pred)

logger = task.get_logger()
logger.report_single_value('test/R2',   r2)
logger.report_single_value('test/RMSE', rmse)
logger.report_single_value('test/MAE',  mae)

print(f"\nMétriques sur Test :")
print(f"  R²   : {r2:.4f}")
print(f"  RMSE : {rmse:.4f}")
print(f"  MAE  : {mae:.4f}")

# ─────────────────────────────────────────────────────────────
# 6. CLASSIFICATION DU STRESS
# ─────────────────────────────────────────────────────────────
print("\nClassification du stress hydrique...")

# Garde latitude/longitude si disponibles dans test_df
lat_lon_cols = [c for c in ['latitude', 'longitude'] if c in test_df.columns]
results_df = test_df[['year', 'month', 'NDVI', 'NDWI', 'MSI',
                       'LST', 'Precipitation', 'SoilMoisture',
                       'ET0', 'CWSI'] + lat_lon_cols].copy()

results_df['CWSI_predit']    = cwsi_pred
results_df['stress_niveau']  = results_df['CWSI_predit'].apply(lambda x: classify_stress(x)[0])
results_df['stress_label']   = results_df['CWSI_predit'].apply(lambda x: classify_stress(x)[1])
results_df['stress_couleur'] = results_df['CWSI_predit'].apply(lambda x: classify_stress(x)[2])

# ─────────────────────────────────────────────────────────────
# 7. STATISTIQUES
# ─────────────────────────────────────────────────────────────
print("\n── Distribution du stress hydrique (2022-2024) ──")
stress_dist  = results_df['stress_label'].value_counts()
total        = len(results_df)
stress_order = ['Pas de stress', 'Stress léger', 'Stress modéré',
                'Stress sévère', 'Stress extrême']

for label in stress_order:
    if label in stress_dist:
        count = stress_dist[label]
        pct   = count / total * 100
        print(f"  {label:<20} : {count:>6} ({pct:.1f}%)")
        logger.report_single_value(f'stress/{label}', pct)

print("\n── CWSI moyen par année ──")
yearly = results_df.groupby('year').agg(
    CWSI_moyen=('CWSI_predit', 'mean'),
    stress_dominant=('stress_label', lambda x: x.mode()[0])
).reset_index()

for _, row in yearly.iterrows():
    print(f"  {int(row['year'])} → CWSI: {row['CWSI_moyen']:.3f} | {row['stress_dominant']}")
    logger.report_scalar('CWSI_annuel', 'moyen',
                         value=row['CWSI_moyen'], iteration=int(row['year']))

print("\n── CWSI moyen par mois ──")
MOIS    = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
monthly = results_df.groupby('month')['CWSI_predit'].mean()

for m, cwsi_val in monthly.items():
    print(f"  {MOIS[m-1]} → CWSI: {cwsi_val:.3f}")
    logger.report_scalar('CWSI_mensuel', 'moyen', value=cwsi_val, iteration=m)

# ─────────────────────────────────────────────────────────────
# 8. EXPORT CSV
# ─────────────────────────────────────────────────────────────
output_path = os.path.join(DATA_DIR, 'malops_predictions_stress.csv')
results_df.to_csv(output_path, index=False)
print(f"\nRésultats exportés → {output_path}")

task.upload_artifact('predictions_stress', output_path)
task.close()

print("\nOuvre http://localhost:8080 pour voir les résultats !")
print("CSV prêt pour la carte Leaflet : malops_predictions_stress.csv")
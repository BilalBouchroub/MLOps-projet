# ============================================================
#  MLOPS - Détection du Stress Hydrique au Maroc
#  Target   : CWSI (Crop Water Stress Index)
#  Features : NDVI, NDWI, MSI, LST, Precipitation, SoilMoisture, ET0
#  Split    : Train 1990-2019 | Val 2020-2021 | Test 2022-2024
#  Modèles  : Random Forest, XGBoost, LightGBM, AdaBoost, GRU
#  Tracking : ClearML
# ============================================================
import joblib
import os
import glob
import pandas as pd
import numpy as np
from clearml import Task
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor, AdaBoostRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
import xgboost as xgb
import lightgbm as lgb
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# ─────────────────────────────────────────────────────────────
# 1. CHARGEMENT ET FUSION DE TOUS LES CSV (1990-2024)
# ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.expanduser('~/malops-project/')

csv_files = sorted(glob.glob(os.path.join(DATA_DIR, 'Maroc_ENV_Features_*.csv')))
# Ignorer les fichiers Zone.Identifier
csv_files = [f for f in csv_files if 'Zone.Identifier' not in f]

print(f"Fichiers CSV trouvés : {len(csv_files)}")

dfs = []
for f in csv_files:
    df_tmp = pd.read_csv(f)
    dfs.append(df_tmp)

df = pd.concat(dfs, ignore_index=True)
print(f"Dataset total : {df.shape[0]} lignes, {df.shape[1]} colonnes")
print(f"Colonnes : {list(df.columns)}")

# ─────────────────────────────────────────────────────────────
# 2. NETTOYAGE
# ─────────────────────────────────────────────────────────────
# Supprimer colonnes inutiles
DROP_COLS = ['system:index', '.geo', 'TIR', 'LandCover']
df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

# LST est en dixièmes de Kelvin → convertir en °C
# LST_raw * 0.1 - 273.15
df['LST'] = df['LST'] * 0.1 - 273.15

# Supprimer valeurs aberrantes LST (hors -10°C / 70°C pour le Maroc)
df = df[(df['LST'] > -10) & (df['LST'] < 70)]

# Supprimer lignes avec NaN dans les features clés
FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
df = df.dropna(subset=FEATURES + ['year', 'month'])

print(f"Après nettoyage : {df.shape[0]} lignes")

# ─────────────────────────────────────────────────────────────
# 3. CALCUL DU CWSI
#    CWSI = (LST - LST_wet) / (LST_dry - LST_wet)
#    LST_wet = percentile 5  de LST par mois (surface bien irriguée)
#    LST_dry = percentile 95 de LST par mois (surface sèche)
#    Clamp entre 0 et 1
# ─────────────────────────────────────────────────────────────
lst_stats = df.groupby('month')['LST'].agg(
    LST_wet=lambda x: np.percentile(x, 5),
    LST_dry=lambda x: np.percentile(x, 95)
).reset_index()

df = df.merge(lst_stats, on='month', how='left')

df['CWSI'] = (df['LST'] - df['LST_wet']) / (df['LST_dry'] - df['LST_wet'])
df['CWSI'] = df['CWSI'].clip(0, 1)

print(f"\nCWSI calculé :")
print(df['CWSI'].describe())

# ─────────────────────────────────────────────────────────────
# 4. SPLIT TEMPOREL
#    Train      : 1990 – 2019
#    Validation : 2020 – 2021
#    Test       : 2022 – 2024
# ─────────────────────────────────────────────────────────────
df['year'] = df['year'].astype(int)

train_df = df[df['year'] <= 2019]
val_df   = df[(df['year'] >= 2020) & (df['year'] <= 2021)]
test_df  = df[df['year'] >= 2022]

print(f"\nTrain : {len(train_df)} lignes ({train_df['year'].min()}-{train_df['year'].max()})")
print(f"Val   : {len(val_df)}   lignes ({val_df['year'].min()}-{val_df['year'].max()})")
print(f"Test  : {len(test_df)}  lignes ({test_df['year'].min()}-{test_df['year'].max()})")

TARGET = 'CWSI'

X_train = train_df[FEATURES].values
y_train = train_df[TARGET].values
X_val   = val_df[FEATURES].values
y_val   = val_df[TARGET].values
X_test  = test_df[FEATURES].values
y_test  = test_df[TARGET].values

# Normalisation
scaler    = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
X_val_sc   = scaler.transform(X_val)
X_test_sc  = scaler.transform(X_test)

# ─────────────────────────────────────────────────────────────
# 5. FONCTION UTILITAIRE : log métriques ClearML
# ─────────────────────────────────────────────────────────────
def log_metrics(task, y_true, y_pred, split='test'):
    r2   = r2_score(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae  = mean_absolute_error(y_true, y_pred)

    logger = task.get_logger()
    logger.report_single_value(f'{split}/R2',   r2)
    logger.report_single_value(f'{split}/RMSE', rmse)
    logger.report_single_value(f'{split}/MAE',  mae)

    print(f"\n── {split.upper()} ──")
    print(f"  R²   : {r2:.4f}")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  MAE  : {mae:.4f}")
    return r2, rmse, mae

# ─────────────────────────────────────────────────────────────
# 6. MODÈLE 1 — RANDOM FOREST
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODÈLE 1 : Random Forest")
print("="*50)

task_rf = Task.init(project_name='MALOPS', task_name='Random Forest',
                    tags=['CWSI', 'RF'])
task_rf.connect({'n_estimators': 200, 'max_depth': 10, 'random_state': 42})

rf = RandomForestRegressor(n_estimators=200, max_depth=10,
                           random_state=42, n_jobs=-1)
rf.fit(X_train_sc, y_train)

log_metrics(task_rf, y_val,  rf.predict(X_val_sc),  split='val')
r2_rf, rmse_rf, mae_rf = log_metrics(task_rf, y_test, rf.predict(X_test_sc), split='test')
task_rf.close()

# ─────────────────────────────────────────────────────────────
# 7. MODÈLE 2 — XGBOOST
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODÈLE 2 : XGBoost")
print("="*50)

task_xgb = Task.init(project_name='MALOPS', task_name='XGBoost',
                     tags=['CWSI', 'XGB'])
task_xgb.connect({'n_estimators': 200, 'max_depth': 6,
                  'learning_rate': 0.1, 'random_state': 42})

xgb_model = xgb.XGBRegressor(n_estimators=200, max_depth=6,
                               learning_rate=0.1, random_state=42,
                               verbosity=0)
xgb_model.fit(X_train_sc, y_train,
              eval_set=[(X_val_sc, y_val)], verbose=False)

log_metrics(task_xgb, y_val,  xgb_model.predict(X_val_sc),  split='val')
r2_xgb, rmse_xgb, mae_xgb = log_metrics(task_xgb, y_test,
                                          xgb_model.predict(X_test_sc), split='test')
task_xgb.close()

# ─────────────────────────────────────────────────────────────
# 8. MODÈLE 3 — LIGHTGBM
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODÈLE 3 : LightGBM")
print("="*50)

task_lgb = Task.init(project_name='MALOPS', task_name='LightGBM',
                     tags=['CWSI', 'LGB'])
task_lgb.connect({'n_estimators': 200, 'max_depth': 6,
                  'learning_rate': 0.1, 'random_state': 42})

lgb_model = lgb.LGBMRegressor(n_estimators=200, max_depth=6,
                                learning_rate=0.1, random_state=42,
                                verbosity=-1)
lgb_model.fit(X_train_sc, y_train,
              eval_set=[(X_val_sc, y_val)])

log_metrics(task_lgb, y_val,  lgb_model.predict(X_val_sc),  split='val')
r2_lgb, rmse_lgb, mae_lgb = log_metrics(task_lgb, y_test,
                                          lgb_model.predict(X_test_sc), split='test')
task_lgb.close()

# ─────────────────────────────────────────────────────────────
# 9. MODÈLE 4 — ADABOOST
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODÈLE 4 : AdaBoost")
print("="*50)

task_ada = Task.init(project_name='MALOPS', task_name='AdaBoost',
                     tags=['CWSI', 'ADA'])
task_ada.connect({'n_estimators': 100, 'learning_rate': 1.0, 'random_state': 42})

ada_model = AdaBoostRegressor(
    estimator=DecisionTreeRegressor(max_depth=4),
    n_estimators=100, learning_rate=1.0, random_state=42
)
ada_model.fit(X_train_sc, y_train)

log_metrics(task_ada, y_val,  ada_model.predict(X_val_sc),  split='val')
r2_ada, rmse_ada, mae_ada = log_metrics(task_ada, y_test,
                                         ada_model.predict(X_test_sc), split='test')
task_ada.close()

# ─────────────────────────────────────────────────────────────
# 10. MODÈLE 5 — GRU
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODÈLE 5 : GRU")
print("="*50)

task_gru = Task.init(project_name='MALOPS', task_name='GRU',
                     tags=['CWSI', 'GRU', 'deep-learning'])
task_gru.connect({'hidden_size': 64, 'num_layers': 2,
                  'epochs': 30, 'batch_size': 64, 'lr': 0.001})

HIDDEN = 64
LAYERS = 2
EPOCHS = 30
BATCH  = 64
LR     = 0.001

X_tr_t = torch.tensor(X_train_sc, dtype=torch.float32).unsqueeze(1)
X_va_t = torch.tensor(X_val_sc,   dtype=torch.float32).unsqueeze(1)
X_te_t = torch.tensor(X_test_sc,  dtype=torch.float32).unsqueeze(1)
y_tr_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
y_va_t = torch.tensor(y_val,   dtype=torch.float32).unsqueeze(1)

train_loader = DataLoader(TensorDataset(X_tr_t, y_tr_t),
                          batch_size=BATCH, shuffle=False)

class GRUModel(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers,
                          batch_first=True, dropout=0.3)
        self.fc  = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.gru(x)
        return self.fc(out[:, -1, :])

device    = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
gru       = GRUModel(len(FEATURES), HIDDEN, LAYERS).to(device)
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(gru.parameters(), lr=LR)
logger_gru = task_gru.get_logger()

for epoch in range(EPOCHS):
    gru.train()
    total_loss = 0
    for xb, yb in train_loader:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        loss = criterion(gru(xb), yb)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    gru.eval()
    with torch.no_grad():
        val_pred = gru(X_va_t.to(device)).cpu().numpy().flatten()
        val_r2   = r2_score(y_val, val_pred)
        val_rmse = np.sqrt(mean_squared_error(y_val, val_pred))

    avg_loss = total_loss / len(train_loader)
    logger_gru.report_scalar('loss', 'train', value=avg_loss,  iteration=epoch)
    logger_gru.report_scalar('R2',   'val',   value=val_r2,    iteration=epoch)
    logger_gru.report_scalar('RMSE', 'val',   value=val_rmse,  iteration=epoch)

    if (epoch + 1) % 5 == 0:
        print(f"  Epoch {epoch+1}/{EPOCHS} | Loss: {avg_loss:.4f} | Val R²: {val_r2:.4f}")

gru.eval()
with torch.no_grad():
    test_pred_gru = gru(X_te_t.to(device)).cpu().numpy().flatten()

r2_gru, rmse_gru, mae_gru = log_metrics(task_gru, y_test, test_pred_gru, split='test')
task_gru.close()

# ─────────────────────────────────────────────────────────────
# 11. COMPARAISON FINALE
# ─────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("COMPARAISON FINALE (R² sur Test)")
print("="*50)

results = {
    'Random Forest': (r2_rf,  rmse_rf,  mae_rf),
    'XGBoost'      : (r2_xgb, rmse_xgb, mae_xgb),
    'LightGBM'     : (r2_lgb, rmse_lgb, mae_lgb),
    'AdaBoost'     : (r2_ada, rmse_ada, mae_ada),
    'GRU'          : (r2_gru, rmse_gru, mae_gru),
}

print(f"\n  {'Modèle':<20} {'R²':>8} {'RMSE':>8} {'MAE':>8}")
print("  " + "-"*46)
for name, (r2, rmse, mae) in sorted(results.items(),
                                     key=lambda x: x[1][0], reverse=True):
    print(f"  {name:<20} {r2:>8.4f} {rmse:>8.4f} {mae:>8.4f}")

best = max(results, key=lambda x: results[x][0])
print(f"\n  Meilleur modèle : {best} (R² = {results[best][0]:.4f})")
print("\nOuvre http://localhost:8080 → projet MALOPS pour comparer visuellement !")



# Sauvegarde du meilleur modèle
models = {
    'Random Forest': rf,
    'XGBoost'      : xgb_model,
    'LightGBM'     : lgb_model,
    'AdaBoost'     : ada_model,
}

best_name = max(results, key=lambda x: results[x][0])
print(f"\nSauvegarde du meilleur modèle : {best_name}")

# Sauvegarde modèle + scaler + nom
if best_name != 'GRU':
    joblib.dump(models[best_name], 
                os.path.join(DATA_DIR, 'best_model.pkl'))
else:
    torch.save(gru.state_dict(), 
               os.path.join(DATA_DIR, 'best_model_gru.pt'))

joblib.dump(scaler, os.path.join(DATA_DIR, 'best_scaler.pkl'))

# Sauvegarde le nom du meilleur modèle
with open(os.path.join(DATA_DIR, 'best_model_name.txt'), 'w') as f:
    f.write(best_name)

print("Modèle sauvegardé dans ~/malops-project/best_model.pkl")
# ============================================================
#  MALOPS - Pipeline Automatisé ClearML (CORRIGÉ)
#  Génère : model_RandomForest.pkl, model_XGBoost.pkl,
#           model_LightGBM.pkl, model_AdaBoost.pkl,
#           model_GRU/, best_model.pkl, best_scaler.pkl
# ============================================================

import os
from clearml import PipelineDecorator, Task
from clearml.automation.controller import PipelineDecorator

DATA_DIR = os.path.expanduser('~/malops-project/')


# ─────────────────────────────────────────────────────────────
# ÉTAPE 1 : Chargement et nettoyage des données
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=True,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['cleaned_path']
)
def step_load_data() -> str:
    import os, glob
    import pandas as pd
    import numpy as np

    DATA_DIR  = os.path.expanduser('~/malops-project/')
    csv_files = sorted([f for f in glob.glob(
        os.path.join(DATA_DIR, 'Maroc_ENV_Features_*.csv'))
        if 'Zone.Identifier' not in f])

    print(f"Chargement de {len(csv_files)} fichiers CSV...")
    df = pd.concat([pd.read_csv(f) for f in csv_files], ignore_index=True)

    DROP_COLS = ['system:index', '.geo', 'TIR', 'LandCover']
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
    df['LST'] = df['LST'] * 0.1 - 273.15
    df = df[(df['LST'] > -10) & (df['LST'] < 70)]

    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST',
                'Precipitation', 'SoilMoisture', 'ET0']
    df = df.dropna(subset=FEATURES + ['year', 'month'])
    df['year'] = df['year'].astype(int)

    output = os.path.join(DATA_DIR, 'data_cleaned.csv')
    df.to_csv(output, index=False)
    print(f"Données nettoyées : {df.shape[0]} lignes → {output}")
    return output


# ─────────────────────────────────────────────────────────────
# ÉTAPE 2 : Calcul CWSI + Split temporel
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=True,
    execution_queue='default',
    task_type=Task.TaskTypes.data_processing,
    return_values=['train_path', 'val_path', 'test_path']
)
def step_compute_cwsi(cleaned_path: str):
    import os
    import pandas as pd
    import numpy as np

    DATA_DIR = os.path.expanduser('~/malops-project/')
    df = pd.read_csv(cleaned_path)

    lst_stats = df.groupby('month')['LST'].agg(
        LST_wet=lambda x: np.percentile(x, 5),
        LST_dry=lambda x: np.percentile(x, 95)
    ).reset_index()
    df = df.merge(lst_stats, on='month', how='left')
    df['CWSI'] = ((df['LST'] - df['LST_wet']) /
                  (df['LST_dry'] - df['LST_wet'])).clip(0, 1)

    train_df = df[df['year'] <= 2019]
    val_df   = df[(df['year'] >= 2020) & (df['year'] <= 2021)]
    test_df  = df[df['year'] >= 2022]

    train_path = os.path.join(DATA_DIR, 'train.csv')
    val_path   = os.path.join(DATA_DIR, 'val.csv')
    test_path  = os.path.join(DATA_DIR, 'test.csv')

    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path,     index=False)
    test_df.to_csv(test_path,   index=False)

    print(f"Train : {len(train_df)} | Val : {len(val_df)} | Test : {len(test_df)}")
    print(f"CWSI — min: {df['CWSI'].min():.3f}  max: {df['CWSI'].max():.3f}  mean: {df['CWSI'].mean():.3f}")
    return train_path, val_path, test_path


# ─────────────────────────────────────────────────────────────
# ÉTAPE 3 : Entraînement — sauvegarde TOUS les modèles
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.training,
    return_values=['model_path', 'scaler_path', 'best_name']
)
def step_train_models(train_path: str, val_path: str):
    import os, json
    import pandas as pd
    import numpy as np
    import joblib
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestRegressor, AdaBoostRegressor
    from sklearn.tree import DecisionTreeRegressor
    from sklearn.metrics import r2_score
    import xgboost as xgb
    import lightgbm as lgb

    DATA_DIR = os.path.expanduser('~/malops-project/')

    # ── Chargement config persistante ────────────────────────
    _cfg_path = os.path.join(DATA_DIR, 'pipeline_config.json')
    _cfg = {}
    if os.path.exists(_cfg_path):
        with open(_cfg_path) as _f:
            _cfg = json.load(_f).get('training', {})

    RF_ENABLED  = bool(_cfg.get('rf_enabled',  True))
    XGB_ENABLED = bool(_cfg.get('xgb_enabled', True))
    LGB_ENABLED = bool(_cfg.get('lgb_enabled', True))
    ADA_ENABLED = bool(_cfg.get('ada_enabled', True))
    GRU_ENABLED = bool(_cfg.get('gru_enabled', True))

    _ALL_FEAT = ['NDVI', 'NDWI', 'MSI', 'LST', 'Precipitation', 'SoilMoisture', 'ET0']
    _FEAT_MAP = {'NDVI': 'feat_ndvi', 'NDWI': 'feat_ndwi', 'MSI': 'feat_msi',
                 'LST': 'feat_lst', 'Precipitation': 'feat_precip',
                 'SoilMoisture': 'feat_soil', 'ET0': 'feat_et0'}
    FEATURES = [f for f in _ALL_FEAT if _cfg.get(_FEAT_MAP[f], True) is not False]
    if not FEATURES:
        FEATURES = _ALL_FEAT
    SEQ_LEN = int(_cfg.get('gru_seq_len', 12))

    train_df = pd.read_csv(train_path)
    val_df   = pd.read_csv(val_path)

    X_train = train_df[FEATURES].values
    y_train = train_df['CWSI'].values
    X_val   = val_df[FEATURES].values
    y_val   = val_df['CWSI'].values

    scaler     = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_val_sc   = scaler.transform(X_val)

    # Sauvegarde immédiate du scaler (toujours nécessaire)
    scaler_path = os.path.join(DATA_DIR, 'best_scaler.pkl')
    joblib.dump(scaler, scaler_path)

    results = {}  # { nom: r2_val }

    # ── Random Forest ────────────────────────────────────────
    if RF_ENABLED:
        rf = RandomForestRegressor(
            n_estimators=int(_cfg.get('rf_n_estimators', 200)),
            max_depth=int(_cfg.get('rf_max_depth', 10)),
            min_samples_split=int(_cfg.get('rf_min_samples', 2)),
            random_state=42, n_jobs=-1)
        rf.fit(X_train_sc, y_train)
        r2 = r2_score(y_val, rf.predict(X_val_sc))
        results['RandomForest'] = r2
        joblib.dump(rf, os.path.join(DATA_DIR, 'model_RandomForest.pkl'))
        print(f"Random Forest  → Val R²: {r2:.4f}  [model_RandomForest.pkl ✓]")

    # ── XGBoost ──────────────────────────────────────────────
    if XGB_ENABLED:
        xgb_m = xgb.XGBRegressor(
            n_estimators=int(_cfg.get('xgb_n_estimators', 200)),
            max_depth=int(_cfg.get('xgb_max_depth', 6)),
            learning_rate=float(_cfg.get('xgb_lr', 0.1)),
            random_state=42, verbosity=0)
        xgb_m.fit(X_train_sc, y_train, verbose=False)
        r2 = r2_score(y_val, xgb_m.predict(X_val_sc))
        results['XGBoost'] = r2
        joblib.dump(xgb_m, os.path.join(DATA_DIR, 'model_XGBoost.pkl'))
        print(f"XGBoost        → Val R²: {r2:.4f}  [model_XGBoost.pkl ✓]")

    # ── LightGBM ─────────────────────────────────────────────
    if LGB_ENABLED:
        lgb_m = lgb.LGBMRegressor(
            n_estimators=int(_cfg.get('lgb_n_estimators', 200)),
            max_depth=int(_cfg.get('lgb_max_depth', 6)),
            learning_rate=float(_cfg.get('lgb_lr', 0.1)),
            random_state=42, verbosity=-1)
        lgb_m.fit(X_train_sc, y_train)
        r2 = r2_score(y_val, lgb_m.predict(X_val_sc))
        results['LightGBM'] = r2
        joblib.dump(lgb_m, os.path.join(DATA_DIR, 'model_LightGBM.pkl'))
        print(f"LightGBM       → Val R²: {r2:.4f}  [model_LightGBM.pkl ✓]")

    # ── AdaBoost ─────────────────────────────────────────────
    if ADA_ENABLED:
        ada = AdaBoostRegressor(
            estimator=DecisionTreeRegressor(max_depth=int(_cfg.get('ada_dt_depth', 4))),
            n_estimators=int(_cfg.get('ada_n_estimators', 100)),
            random_state=42)
        ada.fit(X_train_sc, y_train)
        r2 = r2_score(y_val, ada.predict(X_val_sc))
        results['AdaBoost'] = r2
        joblib.dump(ada, os.path.join(DATA_DIR, 'model_AdaBoost.pkl'))
        print(f"AdaBoost       → Val R²: {r2:.4f}  [model_AdaBoost.pkl ✓]")

    # ── GRU (TensorFlow/Keras) ───────────────────────────────
    if GRU_ENABLED:
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import GRU, Dense, Dropout, Input
            from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

            tf.random.set_seed(42)
            _gru_h = int(_cfg.get('gru_hidden_size', 64))
            _gru_ep = int(_cfg.get('gru_epochs', 100))

            def build_sequences(X, y, seq_len):
                Xs, ys = [], []
                for i in range(seq_len, len(X)):
                    Xs.append(X[i - seq_len:i])
                    ys.append(y[i])
                return np.array(Xs), np.array(ys)

            X_tr_seq, y_tr_seq = build_sequences(X_train_sc, y_train, SEQ_LEN)
            X_vl_seq, y_vl_seq = build_sequences(X_val_sc,   y_val,   SEQ_LEN)

            print(f"\nGRU — séquences train: {X_tr_seq.shape} | val: {X_vl_seq.shape}")

            gru_model = Sequential([
                Input(shape=(SEQ_LEN, len(FEATURES))),
                GRU(_gru_h, return_sequences=True),
                Dropout(0.2),
                GRU(max(_gru_h // 2, 8), return_sequences=False),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(1,  activation='sigmoid')
            ])
            gru_model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
                loss='mse', metrics=['mae']
            )
            gru_model.fit(
                X_tr_seq, y_tr_seq,
                validation_data=(X_vl_seq, y_vl_seq),
                epochs=_gru_ep, batch_size=256,
                callbacks=[
                    EarlyStopping(monitor='val_loss', patience=10,
                                  restore_best_weights=True, verbose=0),
                    ReduceLROnPlateau(monitor='val_loss', factor=0.5,
                                      patience=5, min_lr=1e-5, verbose=0)
                ],
                verbose=1
            )

            r2_gru = r2_score(y_vl_seq,
                              gru_model.predict(X_vl_seq, verbose=0).flatten())
            results['GRU'] = r2_gru
            gru_path = os.path.join(DATA_DIR, 'model_GRU')
            gru_model.save(gru_path)
            print(f"GRU            → Val R²: {r2_gru:.4f}  [model_GRU/ ✓]")

        except Exception as e:
            print(f"GRU ignoré (erreur) : {e}")

    # ── Comparaison et sélection du meilleur ─────────────────
    if not results:
        print("Aucun modèle entraîné (tous désactivés). Fallback RandomForest.")
        from sklearn.ensemble import RandomForestRegressor as _RF
        _rf = _RF(n_estimators=100, random_state=42, n_jobs=-1)
        _rf.fit(X_train_sc, y_train)
        results['RandomForest'] = r2_score(y_val, _rf.predict(X_val_sc))
        joblib.dump(_rf, os.path.join(DATA_DIR, 'model_RandomForest.pkl'))

    print(f"\n── Comparaison Val R² ──")
    for name, r2 in sorted(results.items(), key=lambda x: -x[1]):
        marker = " ← BEST" if name == max(results, key=lambda x: results[x]) else ""
        print(f"  {name:<15} R²={r2:.4f}{marker}")

    best_name = max(results, key=lambda x: results[x])

    # ── Sauvegarde best_model (alias vers le meilleur) ───────
    # ✅ CORRECTION : best_model.pkl pointe toujours vers le
    #    meilleur modèle sklearn, en PLUS des fichiers individuels
    if best_name == 'GRU':
        best_model_path = os.path.join(DATA_DIR, 'model_GRU')
        with open(os.path.join(DATA_DIR, 'best_model_name.txt'), 'w') as f:
            f.write(best_name)
        with open(os.path.join(DATA_DIR, 'best_model_meta.json'), 'w') as f:
            json.dump({'name': best_name,
                       'path': best_model_path,
                       'r2_val': results[best_name],
                       'seq_len': SEQ_LEN}, f)
        print(f"\nBest model (GRU) → {best_model_path}")
    else:
        # Copie du meilleur modèle sklearn vers best_model.pkl
        import shutil
        src = os.path.join(DATA_DIR, f'model_{best_name}.pkl')
        dst = os.path.join(DATA_DIR, 'best_model.pkl')
        shutil.copy2(src, dst)
        with open(os.path.join(DATA_DIR, 'best_model_name.txt'), 'w') as f:
            f.write(best_name)
        print(f"\nBest model ({best_name}) → best_model.pkl ✓")

    # ── Récapitulatif des fichiers générés ───────────────────
    print(f"\n── Fichiers sauvegardés dans {DATA_DIR} ──")
    for fname in sorted(os.listdir(DATA_DIR)):
        fpath = os.path.join(DATA_DIR, fname)
        if (fname.startswith('model_') or fname in
                ['best_model.pkl', 'best_scaler.pkl', 'best_model_name.txt']):
            if os.path.isfile(fpath):
                print(f"  {fname:<40} ({os.path.getsize(fpath):,} bytes)")
            elif os.path.isdir(fpath):
                print(f"  {fname:<40} (dossier SavedModel)")

    model_out = (os.path.join(DATA_DIR, 'model_GRU')
                 if best_name == 'GRU'
                 else os.path.join(DATA_DIR, 'best_model.pkl'))

    return model_out, scaler_path, best_name


# ─────────────────────────────────────────────────────────────
# ÉTAPE 4 : Évaluation sur le set de test
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.component(
    cache=False,
    execution_queue='default',
    task_type=Task.TaskTypes.testing,
    return_values=['r2', 'rmse', 'mae']
)
def step_evaluate(model_path: str, scaler_path: str,
                  test_path: str, best_name: str):
    import os
    import pandas as pd
    import numpy as np
    import joblib
    from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

    DATA_DIR = os.path.expanduser('~/malops-project/')
    FEATURES = ['NDVI', 'NDWI', 'MSI', 'LST',
                'Precipitation', 'SoilMoisture', 'ET0']
    SEQ_LEN  = 12

    scaler    = joblib.load(scaler_path)
    test_df   = pd.read_csv(test_path)
    X_test_sc = scaler.transform(test_df[FEATURES].values)
    y_test    = test_df['CWSI'].values

    if best_name == 'GRU':
        import tensorflow as tf

        def build_sequences(X, y, seq_len):
            Xs, ys = [], []
            for i in range(seq_len, len(X)):
                Xs.append(X[i - seq_len:i])
                ys.append(y[i])
            return np.array(Xs), np.array(ys)

        model     = tf.keras.models.load_model(model_path)
        X_seq, y_test_seq = build_sequences(X_test_sc, y_test, SEQ_LEN)
        cwsi_pred = model.predict(X_seq, verbose=0).flatten()
        y_test    = y_test_seq
    else:
        model     = joblib.load(model_path)
        cwsi_pred = model.predict(X_test_sc)

    r2   = r2_score(y_test, cwsi_pred)
    rmse = np.sqrt(mean_squared_error(y_test, cwsi_pred))
    mae  = mean_absolute_error(y_test, cwsi_pred)

    print(f"\n── Évaluation finale ({best_name}) ──")
    print(f"  R²   : {r2:.4f}")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  MAE  : {mae:.4f}")

    def classify(cwsi):
        if cwsi < 0.2:   return 'Pas de stress'
        elif cwsi < 0.4: return 'Stress léger'
        elif cwsi < 0.6: return 'Stress modéré'
        elif cwsi < 0.8: return 'Stress sévère'
        else:            return 'Stress extrême'

    result_df = test_df.iloc[SEQ_LEN:].copy() if best_name == 'GRU' else test_df.copy()
    result_df['CWSI_predit'] = cwsi_pred
    result_df['stress']      = result_df['CWSI_predit'].apply(classify)

    dist  = result_df['stress'].value_counts()
    total = len(result_df)
    print("\n── Distribution stress hydrique ──")
    for label, count in dist.items():
        print(f"  {label:<20} : {count:>6} ({count/total*100:.1f}%)")

    output = os.path.join(DATA_DIR, 'malops_predictions_stress.csv')
    result_df.to_csv(output, index=False)
    print(f"\nCSV exporté → {output}")

    return float(r2), float(rmse), float(mae)


# ─────────────────────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────────────────────
@PipelineDecorator.pipeline(
    name='MLops Pipeline',
    project='MALOPS',
    version='2.0',
    add_pipeline_tags=True,
    pipeline_execution_queue='default',
)
def malops_pipeline():
    print("═" * 50)
    print("MALOPS Pipeline démarré  (v2.0 — avec GRU)")
    print("═" * 50)

    cleaned_path                       = step_load_data()
    train_path, val_path, test_path    = step_compute_cwsi(cleaned_path)
    model_path, scaler_path, best_name = step_train_models(train_path, val_path)
    r2, rmse, mae                      = step_evaluate(model_path, scaler_path,
                                                        test_path, best_name)

    print(f"\nPipeline terminé !")
    print(f"Meilleur modèle : {best_name}")
    print(f"R²={float(r2):.4f} | RMSE={float(rmse):.4f} | MAE={float(mae):.4f}")
    print("Lance pipeline_registry.py pour versionner le modèle.")


# ─────────────────────────────────────────────────────────────
# LANCEMENT
# ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PipelineDecorator.run_locally()
    malops_pipeline()
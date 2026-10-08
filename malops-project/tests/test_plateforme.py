"""
=============================================================
  MALOPS – Tests Unitaires de la Plateforme MLOps
  Auteur  : Bilal Bouchroub
  Date    : 2026-05-07
  Backend : http://localhost:8001
=============================================================

Lancement :
    cd /home/bilalbouch/malops-project
    /home/bilalbouch/mlops-env/bin/pytest tests/test_plateforme.py -v --tb=short

6 tests couvrant :
  T1 – Authentification JWT
  T2 – Upload & validation de colonnes CSV
  T3 – Prédiction CWSI (RandomForest production)
  T4 – Registre des modèles & version de production
  T5 – Rapport de validation des données
  T6 – Téléchargement sécurisé d'un dataset
"""

import io
import pytest
import requests

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8001"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

# CSV minimal valide pour les tests de prédiction
_VALID_CSV = (
    "NDVI,NDWI,MSI,LST,Precipitation,SoilMoisture,ET0\n"
    "0.45,-0.12,0.35,35.2,12.5,0.28,4.2\n"
    "0.32,-0.08,0.42,38.1,8.3,0.19,5.1\n"
    "0.61,-0.18,0.28,31.4,18.7,0.35,3.8\n"
    "0.55,-0.20,0.31,29.8,22.1,0.40,3.2\n"
    "0.28,-0.05,0.48,41.5,5.2,0.14,6.3\n"
)

# CSV avec colonnes manquantes (pour tester le rejet)
_INVALID_CSV = (
    "NDVI,NDWI,LST\n"
    "0.45,-0.12,35.2\n"
    "0.32,-0.08,38.1\n"
)


# ─────────────────────────────────────────────────────────────
# Fixture partagée : token d'authentification admin
# ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def auth_token():
    """Obtient un token JWT valide une seule fois pour tous les tests."""
    response = requests.post(
        f"{BASE_URL}/auth/token",
        data={"username": ADMIN_USER, "password": ADMIN_PASS},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    assert response.status_code == 200, (
        f"Impossible d'obtenir un token : HTTP {response.status_code}"
    )
    token = response.json().get("access_token")
    assert token, "Champ 'access_token' absent de la réponse"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ─────────────────────────────────────────────────────────────
# T1 – Authentification JWT
# ─────────────────────────────────────────────────────────────
class TestAuthentification:
    """Vérifie le système de connexion et la génération de tokens JWT."""

    def test_login_admin_retourne_token(self):
        """Un login valide doit retourner un token JWT non vide."""
        r = requests.post(
            f"{BASE_URL}/auth/token",
            data={"username": ADMIN_USER, "password": ADMIN_PASS},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert len(body["access_token"]) > 50, "Token trop court, probablement invalide"
        assert body.get("token_type") == "bearer"
        print(f"\n  ✓ Token reçu ({len(body['access_token'])} caractères), rôle : {body.get('role')}")

    def test_login_mauvais_mot_de_passe_refuse(self):
        """Un mot de passe incorrect doit être refusé avec HTTP 401."""
        r = requests.post(
            f"{BASE_URL}/auth/token",
            data={"username": ADMIN_USER, "password": "MAUVAIS_MDP"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        assert r.status_code == 401, (
            f"Attendu 401, reçu {r.status_code} — les mauvais credentials ne sont pas rejetés"
        )
        print(f"\n  ✓ Mauvais mot de passe rejeté (HTTP 401)")

    def test_acces_sans_token_refuse(self):
        """Une route protégée sans token doit retourner HTTP 401 ou 403."""
        r = requests.get(f"{BASE_URL}/datasets/available", timeout=10)
        assert r.status_code in (401, 403), (
            f"Attendu 401/403, reçu {r.status_code} — la route n'est pas protégée"
        )
        print(f"\n  ✓ Accès sans token refusé (HTTP {r.status_code})")


# ─────────────────────────────────────────────────────────────
# T2 – Upload & Validation de fichier CSV
# ─────────────────────────────────────────────────────────────
class TestUploadCSV:
    """Vérifie l'upload et la validation des colonnes d'un fichier CSV."""

    def test_upload_csv_valide(self, auth_headers):
        """Un CSV avec toutes les colonnes requises doit être accepté."""
        files = {"file": ("test_upload_valide.csv",
                          io.BytesIO(_VALID_CSV.encode()), "text/csv")}
        data  = {"region": "Maroc_test"}
        r = requests.post(
            f"{BASE_URL}/datasets/upload",
            headers=auth_headers,
            files=files,
            data=data,
            timeout=30,
        )
        assert r.status_code == 200, f"Upload refusé : {r.text[:200]}"
        body = r.json()
        assert body.get("saved") is True,        "Le fichier n'a pas été sauvegardé"
        assert body.get("can_predict") is True,  "Le fichier devrait permettre la prédiction"
        assert body.get("rows", 0) > 0,          "Nombre de lignes non renseigné"
        missing = body.get("missing_required", [])
        assert len(missing) == 0, f"Colonnes manquantes détectées : {missing}"
        print(f"\n  ✓ Upload accepté — {body['rows']} lignes, "
              f"colonnes OK, fichier : {body['filename']}")

    def test_upload_csv_colonnes_manquantes_signale(self, auth_headers):
        """Un CSV avec colonnes manquantes doit être signalé (can_predict=False)."""
        files = {"file": ("test_invalid.csv",
                          io.BytesIO(_INVALID_CSV.encode()), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/datasets/upload",
            headers=auth_headers,
            files=files,
            timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("can_predict") is False, (
            "Un CSV incomplet ne devrait pas permettre la prédiction"
        )
        missing = body.get("missing_required", [])
        assert len(missing) > 0, "Les colonnes manquantes ne sont pas rapportées"
        print(f"\n  ✓ Colonnes manquantes détectées : {missing}")

    def test_liste_datasets_disponibles(self, auth_headers):
        """La liste des datasets disponibles doit contenir au moins un fichier."""
        r = requests.get(f"{BASE_URL}/datasets/available",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        datasets = r.json().get("datasets", [])
        assert len(datasets) >= 1, "Aucun dataset disponible sur le serveur"
        filenames = [d["filename"] for d in datasets]
        print(f"\n  ✓ {len(datasets)} datasets disponibles — ex : {filenames[0]}")


# ─────────────────────────────────────────────────────────────
# T3 – Prédiction CWSI (modèle RandomForest de production)
# ─────────────────────────────────────────────────────────────
class TestPredictionCWSI:
    """Vérifie le moteur de prédiction du stress hydrique (CWSI)."""

    def test_prediction_sur_csv_valide(self, auth_headers):
        """La prédiction sur un CSV valide doit retourner un CWSI entre 0 et 1."""
        files = {"file": ("pred_test.csv",
                          io.BytesIO(_VALID_CSV.encode()), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/datasets/predict-upload",
            headers=auth_headers,
            files=files,
            timeout=60,
        )
        assert r.status_code == 200, f"Prédiction échouée : {r.text[:200]}"
        body = r.json()
        cwsi = body.get("mean_cwsi")
        assert cwsi is not None,          "Champ 'mean_cwsi' absent"
        assert 0.0 <= cwsi <= 1.0,        f"CWSI hors plage [0,1] : {cwsi}"
        assert body.get("verdict"),       "Verdict absent"
        assert body.get("analyzed_rows", 0) > 0, "Aucune ligne analysée"
        total_pct = (body.get("faible_pct", 0) +
                     body.get("modere_pct", 0) +
                     body.get("severe_pct", 0))
        assert abs(total_pct - 100.0) < 1.0, (
            f"Les pourcentages de stress ne totalisent pas 100% : {total_pct}"
        )
        print(f"\n  ✓ CWSI moyen = {cwsi:.4f} | Verdict : {body['verdict']}")
        print(f"     Distribution — Faible : {body['faible_pct']}% | "
              f"Modéré : {body['modere_pct']}% | Sévère : {body['severe_pct']}%")

    def test_prediction_csv_incomplet_rejete(self, auth_headers):
        """Un CSV sans les colonnes requises doit être refusé (HTTP 400)."""
        files = {"file": ("pred_bad.csv",
                          io.BytesIO(_INVALID_CSV.encode()), "text/csv")}
        r = requests.post(
            f"{BASE_URL}/datasets/predict-upload",
            headers=auth_headers,
            files=files,
            timeout=30,
        )
        assert r.status_code == 400, (
            f"Attendu HTTP 400, reçu {r.status_code} — "
            "un CSV incomplet devrait être refusé"
        )
        print(f"\n  ✓ CSV incomplet rejeté (HTTP 400) — {r.json().get('detail','')[:80]}")


# ─────────────────────────────────────────────────────────────
# T4 – Registre des modèles & version de production
# ─────────────────────────────────────────────────────────────
class TestRegistreModeles:
    """Vérifie l'état du registre de modèles et la version en production."""

    def test_registre_contient_modeles(self, auth_headers):
        """Le registre doit contenir au moins un modèle versionné."""
        r = requests.get(f"{BASE_URL}/models/library",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        models = r.json().get("models", [])
        assert len(models) >= 1, "Aucun modèle dans le registre"
        print(f"\n  ✓ {len(models)} version(s) dans le registre")

    def test_un_modele_en_production(self, auth_headers):
        """Exactement un modèle doit avoir le statut 'production'."""
        r = requests.get(f"{BASE_URL}/models/library",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        models = r.json().get("models", [])
        prod_models = [m for m in models if m.get("status") == "production"]
        assert len(prod_models) == 1, (
            f"Attendu 1 modèle en production, trouvé {len(prod_models)}"
        )
        prod = prod_models[0]
        r2   = prod.get("r2", 0)
        assert r2 >= 0.85, f"R² du modèle de production trop faible : {r2:.4f}"
        print(f"\n  ✓ Modèle de production : {prod['name']} {prod['version']} "
              f"— R²={r2:.4f}")

    def test_metriques_modele_production(self, auth_headers):
        """Les métriques du modèle de production doivent être au-dessus des seuils qualité."""
        r = requests.get(f"{BASE_URL}/training/status",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        data   = r.json()
        models = data.get("models", {})
        best   = data.get("best_model", "")
        assert best, "Aucun meilleur modèle identifié"
        best_metrics = models.get(best, {})
        r2   = best_metrics.get("r2", 0)
        rmse = best_metrics.get("rmse", 999)
        assert r2   >= 0.90, f"R² insuffisant : {r2:.4f} (seuil ≥ 0.90)"
        assert rmse <= 0.10, f"RMSE trop élevé : {rmse:.4f} (seuil ≤ 0.10)"
        print(f"\n  ✓ Meilleur modèle : {best} — R²={r2:.4f}, RMSE={rmse:.6f}")


# ─────────────────────────────────────────────────────────────
# T5 – Rapport de validation des données
# ─────────────────────────────────────────────────────────────
class TestRapportValidation:
    """Vérifie la structure et le contenu du rapport de validation des données."""

    def test_rapport_validation_disponible(self, auth_headers):
        """Le rapport de validation doit être accessible et structuré."""
        r = requests.get(f"{BASE_URL}/validation/report",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200, f"Rapport inaccessible : {r.text[:100]}"
        body = r.json()
        for key in ("schema", "stats", "drift"):
            assert key in body, f"Champ '{key}' manquant dans le rapport"
        print(f"\n  ✓ Rapport de validation disponible — champs : {list(body.keys())}")

    def test_rapport_contient_fichiers_analyses(self, auth_headers):
        """Le rapport doit référencer au moins un fichier CSV analysé."""
        r = requests.get(f"{BASE_URL}/validation/report",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        schema      = r.json().get("schema", {})
        total_files = schema.get("total_files", 0)
        per_file    = schema.get("per_file", {})
        assert total_files >= 1, "Aucun fichier signalé dans le rapport"
        assert len(per_file) >= 1, "Aucun fichier détaillé dans 'per_file'"
        sample_file, sample_info = next(iter(per_file.items()))
        assert "rows"      in sample_info, "Champ 'rows' absent"
        assert "null_rate" in sample_info, "Champ 'null_rate' absent"
        print(f"\n  ✓ {total_files} fichier(s) analysé(s) — ex : {sample_file} "
              f"({sample_info['rows']} lignes, nulls={sample_info['null_rate']*100:.1f}%)")

    def test_detection_drift_presente(self, auth_headers):
        """Le rapport de drift doit contenir au moins une feature analysée."""
        r = requests.get(f"{BASE_URL}/validation/report",
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        drift = r.json().get("drift", {})
        assert len(drift) >= 1, "Aucune feature dans le rapport de drift"
        feature, metrics = next(iter(drift.items()))
        assert "psi"    in metrics, "Champ 'psi' absent"
        assert "ks_pval" in metrics, "Champ 'ks_pval' absent"
        assert "drift"   in metrics, "Champ 'drift' absent"
        drifted = [f for f, m in drift.items() if m.get("drift")]
        print(f"\n  ✓ Drift analysé sur {len(drift)} feature(s) — "
              f"{len(drifted)} en drift détecté")


# ─────────────────────────────────────────────────────────────
# T6 – Téléchargement sécurisé d'un dataset
# ─────────────────────────────────────────────────────────────
class TestTelechargementDataset:
    """Vérifie le téléchargement sécurisé des fichiers CSV."""

    def test_telechargement_avec_token(self, auth_headers):
        """Un fichier existant doit pouvoir être téléchargé avec un token valide."""
        # Récupérer un fichier disponible
        r_list = requests.get(f"{BASE_URL}/datasets/available",
                              headers=auth_headers, timeout=10)
        assert r_list.status_code == 200
        datasets = r_list.json().get("datasets", [])
        assert len(datasets) > 0, "Aucun dataset disponible pour le test"

        filename = datasets[0]["filename"]
        r = requests.get(
            f"{BASE_URL}/datasets/{filename}/download",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, (
            f"Téléchargement échoué pour '{filename}' : HTTP {r.status_code}"
        )
        content = r.content
        assert len(content) > 0, "Fichier téléchargé vide"
        # Vérifier que c'est bien un CSV (commence par une ligne d'en-tête)
        first_line = content.decode("utf-8", errors="ignore").split("\n")[0]
        assert "," in first_line, "Le contenu téléchargé ne ressemble pas à un CSV"
        size_kb = len(content) / 1024
        print(f"\n  ✓ Fichier '{filename}' téléchargé — {size_kb:.1f} KB")

    def test_telechargement_sans_token_refuse(self):
        """Tenter de télécharger sans token doit être refusé (HTTP 401/403)."""
        r = requests.get(
            f"{BASE_URL}/datasets/Maroc_ENV_Features_1990.csv/download",
            timeout=10,
        )
        assert r.status_code in (401, 403), (
            f"Attendu 401/403, reçu {r.status_code} — "
            "le téléchargement non authentifié ne devrait pas être autorisé"
        )
        print(f"\n  ✓ Téléchargement sans token refusé (HTTP {r.status_code})")

    def test_telechargement_fichier_inexistant_404(self, auth_headers):
        """Télécharger un fichier inexistant doit retourner HTTP 404."""
        r = requests.get(
            f"{BASE_URL}/datasets/FICHIER_INEXISTANT_XYZ.csv/download",
            headers=auth_headers,
            timeout=10,
        )
        assert r.status_code == 404, (
            f"Attendu 404, reçu {r.status_code}"
        )
        print(f"\n  ✓ Fichier inexistant → HTTP 404 correctement retourné")

<div align="center">

<img src="malops-frontend/public/stress.png" alt="Illustration du stress hydrique" width="180" />

# 🌿 MALOPS
### Plateforme MLOps de prédiction du stress hydrique au Maroc

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=18&pause=1200&color=16A085&center=true&vCenter=true&width=650&lines=Observer+les+signaux+environnementaux;Estimer+le+stress+hydrique+(CWSI);Suivre+les+donn%C3%A9es%2C+mod%C3%A8les+et+pipelines" alt="Animation de présentation MALOPS" /></a>

<br />

<p>
  <img src="https://cdn.simpleicons.org/python/3776AB" alt="Python" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/fastapi/009688" alt="FastAPI" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/react/61DAFB" alt="React" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/scikitlearn/F7931E" alt="scikit-learn" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/pytorch/EE4C2C" alt="PyTorch" height="38" />&nbsp;&nbsp;
  <img src="images/XGBoost_logo.svg" height="38" />&nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/lightgbm-org/LightGBM/main/docs/logo/LightGBM_logo_no_text.svg" alt="LightGBM" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/postgresql/4169E1" alt="PostgreSQL" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/docker/2496ED" alt="Docker" height="38" />&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/leaflet/199900" alt="Leaflet" height="38" />&nbsp;&nbsp;
  <img src="images/clearml-logo.webp" height="38" />
</p>

<sub>Python · FastAPI · React · scikit-learn · PyTorch · XGBoost · LightGBM · PostgreSQL · Docker · Leaflet · ClearML</sub>

<p><b>De la donnée environnementale à une prédiction exploitable.</b></p>

</div>

---

## 🌱 À propos

MALOPS est une plateforme de suivi et de prédiction du stress hydrique des cultures. Elle réunit une interface web, une API de gestion, des pipelines de données et de modèles, ainsi qu’un service de prédiction CWSI (*Crop Water Stress Index*).

Les scripts travaillent avec des indicateurs tels que **NDVI, NDWI, MSI, LST, précipitations, humidité du sol et ET0**. Le projet inclut des modèles classiques de machine learning et un modèle GRU, avec suivi des expériences via ClearML.

## 🖥️ Galerie des interfaces

J’ai classé les captures d’après les rôles et les écrans visibles dans les images. Les chiffres affichés dans certaines captures sont ceux de l’interface photographiée et ne constituent pas des résultats de référence.

### 🌍 Accueil et connexion

Ces écrans présentent la plateforme et permettent aux différents profils de se connecter.

<div align="center">
  <img src="images/acceuil.png" alt="Page d’accueil HydroVision" width="82%" />
  <p><em>Accueil : présentation d’HydroVision et accès à la démonstration ou à la connexion.</em></p>
  <img src="images/login.png" alt="Connexion à la plateforme" width="82%" />
  <p><em>Connexion : formulaire d’accès aux espaces selon le compte et son rôle.</em></p>
</div>

### 👩‍🌾 Espace client / utilisateur final

**Rôle :** consulter les prédictions et explorer la répartition du stress hydrique sur la carte, par commune ou par région.

<div align="center">
  <img src="images/cart%201.png" alt="Carte du stress hydrique à El Jadida — espace client" width="90%" />
  <p><em>Carte d’El Jadida : résultats CWSI et niveaux de stress par commune.</em></p>
  <img src="images/cart%202.png" alt="Carte choroplèthe du stress hydrique au Maroc — espace client" width="90%" />
  <p><em>Carte du Maroc : comparaison des niveaux de stress hydrique entre régions.</em></p>
  <img src="images/dashboard%20user.png" alt="Dashboard qualité des données" width="90%" />
  <p><em>Dashboard qualité : vue des indicateurs, avertissements et dérives. À noter : la capture affiche le rôle Data Engineer dans le menu latéral.</em></p>
</div>

### 🛡️ Espace administrateur

**Rôle :** superviser la plateforme, administrer les comptes et leurs rôles, et gérer les projets et leurs responsables.

<div align="center">
  <img src="images/dashboard.png" alt="Tableau de bord administrateur" width="82%" />
  <p><em>Dashboard admin : indicateurs de la plateforme, comptes, modèles et dernière exécution de pipeline.</em></p>
  <img src="images/utilisateur.png" alt="Gestion des utilisateurs et des rôles" width="82%" />
  <p><em>Gestion des utilisateurs : consultation des comptes, de leurs rôles et de leur statut.</em></p>
  <img src="images/cree%20utilisateur.png" alt="Formulaire d’affectation des responsables d’un projet" width="58%" />
  <p><em>Gestion de projet : modification du projet et affectation du client, du Data Engineer et du MLOps Engineer responsables.</em></p>
</div>

### 🧹 Espace Data Engineer

**Rôle :** préparer les jeux de données, régler leur validation et surveiller leur qualité avant l’entraînement des modèles.

<div align="center">
  <img src="images/data%20enginner.png" alt="Liste des datasets annuels — Data Engineer" width="82%" />
  <p><em>Dataset Config : liste des fichiers annuels avec leur année, leur taille et les actions disponibles.</em></p>
  <img src="images/dashboard%20user.png" alt="Tableau de bord qualité des données — Data Engineer" width="82%" />
  <p><em>Quality Dashboard (dashboard Data Engineer) : score qualité, fichiers analysés, alertes, dérive par variable et qualité par fichier.</em></p>
</div>

### ⚙️ Espace MLops Engineer

**Rôle :** configurer, lancer et suivre le cycle MLOps : validation, entraînement, registre de modèles, serving, monitoring et prédiction.

<div align="center">
  <img src="images/pipelines%20eng.png" alt="Gestion des pipelines dans l’espace MLops Engineer" width="90%" />
  <p><em>Pipeline Manager : état des chaînes, étapes disponibles et commandes pour lancer ou configurer un pipeline.</em></p>
  <img src="images/pipeline%20conf%201.png" alt="Configuration de la phase dataset dans l’orchestrateur" width="90%" />
  <p><em>Orchestrator Wizard — Dataset : période, régions géographiques et filtres qualité.</em></p>
  <img src="images/pipeline%20conf%202.png" alt="Configuration de la phase monitoring dans l’orchestrateur" width="90%" />
  <p><em>Orchestrator Wizard — Monitoring : seuils d’alerte, fréquence de surveillance et période de référence.</em></p>
  <img src="images/termine%20la%20configuration.png" alt="Résumé de configuration des pipelines avant lancement" width="90%" />
  <p><em>Résumé de configuration : paramètres des étapes du pipeline avant son lancement.</em></p>
</div>

### 🧪 Vues ClearML

**Rôle de ClearML :** suivre les exécutions des pipelines et les artefacts ML associés. Ces écrans sont l’outil de suivi des expériences, pas un espace utilisateur distinct de MALOPS.

<div align="center">
  <img src="images/pipelines.png" alt="Liste des pipelines dans ClearML" width="82%" />
  <p><em>ClearML Pipelines : liste des workflows et nombre d’exécutions par statut.</em></p>
  <img src="images/pipeline%20validation.png" alt="Exécutions du pipeline de validation dans ClearML" width="82%" />
  <p><em>Validation dans ClearML : historique des exécutions et graphe des étapes de validation.</em></p>
  <img src="images/pipeline.png" alt="Détail d’une exécution de pipeline ClearML" width="82%" />
  <p><em>Détail d’une exécution : étapes du pipeline et sortie de la console.</em></p>
  <img src="images/pipeline%20dataset%20virsionning.png" alt="Versions du dataset dans ClearML" width="82%" />
  <p><em>Versions du dataset : historique des versions et informations sur les artefacts enregistrés.</em></p>
</div>

## 🗺️ Vue d’ensemble

```mermaid
flowchart LR
    subgraph Sources[📦 Données et configuration]
        CSV[CSV environnementaux]
        CFG[Configs et registres]
    end

    subgraph MLOps[⚙️ Pipelines MALOPS]
        DS[Versionnement dataset]
        VAL[Validation et dérive]
        TR[Entraînement et évaluation]
        REG[Registre champion / challenger]
        MON[Monitoring]
    end

    subgraph Apps[🚀 Applications]
        UI[Frontend React]
        API[API FastAPI]
        SERV[Serving CWSI]
    end

    CSV --> DS --> VAL --> TR --> REG --> SERV
    CFG --> DS
    REG --> MON
    UI <--> API
    API --> SERV
    SERV --> UI
    TR -. métriques .-> CLEARML[(ClearML)]
    MON -. suivi .-> CLEARML

    classDef data fill:#E8F5E9,stroke:#43A047,color:#173B20
    classDef pipeline fill:#E0F2F1,stroke:#00897B,color:#123B37
    classDef app fill:#E3F2FD,stroke:#1E88E5,color:#123456
    class CSV,CFG data
    class DS,VAL,TR,REG,MON pipeline
    class UI,API,SERV app
```

## 📈 Cycle de vie ML

```mermaid
xychart-beta
    title "Découpage temporel décrit dans train.py"
    x-axis [1990, 2019, 2020, 2021, 2022, 2024]
    y-axis "Phase" 0 --> 3
    bar [1, 1, 2, 2, 3, 3]
```

| Période | Utilisation |
|:--|:--|
| 1990–2019 | Entraînement |
| 2020–2021 | Validation |
| 2022–2027 | Test |

> Le graphique représente le découpage indiqué par `train.py`, pas une mesure de performance des modèles.

## ✨ Fonctionnalités

| Domaine | Ce que contient le projet |
|:--|:--|
| 🧭 Interface | Cartes, tableaux de bord et vues par rôle : client, ingénieur, scientifique et administrateur |
| 🧪 Données | Scan, hachage/versionnement, validation de schéma, statistiques et détection de dérive |
| 🧠 Modèles | Entraînement/évaluation de Random Forest, XGBoost, LightGBM, AdaBoost et GRU |
| 🏆 Registre | Évaluation et promotion de modèles selon la logique champion-challenger |
| 🔮 Prédiction | API pour prédictions CWSI unitaires ou par lot |
| 📡 Observabilité | Suivi d’exécutions et rapports, avec ClearML pour les pipelines concernés |

## 🧰 Technologies

<div align="center">

<img src="https://cdn.simpleicons.org/scikitlearn/F7931E" alt="scikit-learn" height="28" />&nbsp;
<img src="https://cdn.simpleicons.org/pytorch/EE4C2C" alt="PyTorch" height="28" />&nbsp;
<img src="https://cdn.simpleicons.org/postgresql/4169E1" alt="PostgreSQL" height="28" />&nbsp;
<img src="https://cdn.simpleicons.org/leaflet/199900" alt="Leaflet" height="28" />&nbsp;
<img src="https://cdn.simpleicons.org/docker/2496ED" alt="Docker" height="28" />

</div>

## 🗂️ Structure du dépôt

```text
MLOps-projet/
├── malops-frontend/              # Application React
│   ├── public/                   # Cartes GeoJSON et ressources visuelles
│   └── src/
│       ├── pages/                # Vues client, engineer, scientist, admin
│       ├── components/           # Navigation et layouts
│       └── api/                  # Clients HTTP
└── malops-project/               # API et plateforme ML
    ├── backend/                  # FastAPI, routes, modèles SQLAlchemy
    ├── data/                     # Jeux/configurations de projet et rapports
    ├── model_registry/           # Registre de modèles
    ├── serving/                  # API autonome de prédiction CWSI
    ├── tests/                    # Tests du backend
    ├── pipeline_dataset.py       # Versionnement des données
    ├── pipeline_validation.py    # Schéma, statistiques et dérive
    ├── pipeline_training.py      # Entraînement et évaluation
    ├── pipeline_registry.py      # Registre et sélection champion/challenger
    ├── pipeline_serving.py       # Préparation du déploiement
    ├── pipeline_monitoring.py    # Suivi des prédictions et dérives
    └── orchestrator.py           # Exécution coordonnée des étapes
```

## 🚀 Démarrage rapide

### Prérequis

- Python 3.10 ou plus récent et Node.js/npm.
- PostgreSQL pour l’API principale.
- ClearML configuré pour les pipelines qui utilisent le suivi ClearML.
- Dépendances ML adaptées aux étapes utilisées (PyTorch, XGBoost, LightGBM, etc.). Les fichiers de dépendances ne couvrent pas nécessairement toutes les étapes ML.

### 1. Backend

```bash
cd malops-project
python -m venv .venv
source .venv/bin/activate       # Windows : .venv\Scripts\activate
pip install -r backend/requirements.txt
export DATABASE_URL="postgresql://utilisateur:mot_de_passe@localhost:5432/mlops"
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API : `http://localhost:8000` · Documentation : `http://localhost:8000/docs` · Santé : `http://localhost:8000/health`.

Au premier démarrage, le backend initialise un compte de démonstration `admin` / `admin123`. Modifiez ce mot de passe avant toute utilisation partagée ou exposée.

### 2. Frontend

Dans un autre terminal :

```bash
cd malops-frontend
npm install
npm start
```

Interface : `http://localhost:3000`. Le proxy du frontend cible l’API sur `http://localhost:8000`.

### 3. Service de prédiction autonome (optionnel)

```bash
cd malops-project
pip install -r serving/requirements_serving.txt
uvicorn serving.app:app --reload --host 0.0.0.0 --port 8001
```

Documentation : `http://localhost:8001/docs`. Le service attend le manifeste et les fichiers de modèle référencés par `serving/manifest.json`.

## 🔄 Lancer les pipelines

Depuis `malops-project`, après installation des dépendances nécessaires et configuration de ClearML si besoin :

```bash
python orchestrator.py --help
python orchestrator.py --mode full
```

Modes déclarés par l’orchestrateur : `full`, `train`, `monitor`, `dataset`, `predict` et `custom`. Les étapes peuvent aussi être lancées séparément, par exemple :

```bash
python pipeline_validation.py
python pipeline_training.py
```

⚠️ Certains scripts utilisent des chemins propres à l’environnement, dont `~/malops-project/`. Adaptez-les ou placez les données à l’emplacement attendu. Le mode complet peut écrire des artefacts, entraîner des modèles et contacter ClearML.

### ClearML avec Docker Compose

Le fichier `malops-project/docker-compose.yml` référence un fichier `.env` local non fourni dans le dépôt. Après avoir créé ce fichier avec la configuration de votre installation :

```bash
cd malops-project
docker compose up -d
```

## ✅ Vérifications

Frontend :

```bash
cd malops-frontend
npm test
npm run build
```

Backend :

```bash
cd malops-project
python -m pytest
```

## 🔐 Configuration et données

- Gardez les mots de passe, jetons et secrets dans des variables d’environnement ou un `.env` local non versionné.
- Changez les identifiants de démonstration de l’administrateur avant un déploiement.
- Vérifiez les droits de redistribution des CSV et artefacts avant publication.
- Les fichiers de rapports, journaux, modèles et résultats de tuning présents dans le dépôt sont des artefacts d’exécution ; certains peuvent être régénérés par les pipelines.

## 🎨 Palette du projet

| Couleur | Rôle | Hex |
|:--|:--|:--|
| 🌿 Vert | Agriculture et données | `#2E8B57` |
| 💧 Turquoise | Pipelines et eau | `#16A085` |
| 🔵 Bleu | Interface et API | `#1E88E5` |
| 🌾 Ambre | Alertes et stress | `#F4A261` |

<div align="center">

**🌿 Des données à la décision, pour mieux comprendre le stress hydrique.**

</div>

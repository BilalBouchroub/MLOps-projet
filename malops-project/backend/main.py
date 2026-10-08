from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import engine, get_db, Base
from models.user import User as UserModel
from core.security import get_password_hash
from routers import auth, users, predictions, pipelines, model_registry, datasets, training, validation, pipeline_manager, clearml_api, clearml_pipelines, admin_logs, projects

import models.user        # noqa
import models.prediction  # noqa
import models.api_log     # noqa
import models.project     # noqa

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MALOPS Users API",
    version="1.0.0",
    description="API de gestion des utilisateurs MALOPS avec authentification JWT"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(predictions.router)
app.include_router(pipelines.router)
app.include_router(model_registry.router)
app.include_router(datasets.router)
app.include_router(training.router)
app.include_router(validation.router)
app.include_router(pipeline_manager.router)
app.include_router(clearml_api.router)
app.include_router(clearml_pipelines.router)
app.include_router(admin_logs.router)
app.include_router(projects.router)


@app.on_event("startup")
def startup_event():
    # Créer predictions_MALOPS.csv depuis le fichier par défaut si absent
    import os, shutil
    default_csv  = "/home/bilalbouch/malops-project/malops_predictions_stress.csv"
    malops_csv   = "/home/bilalbouch/malops-project/predictions_MALOPS.csv"
    if os.path.exists(default_csv) and not os.path.exists(malops_csv):
        shutil.copy2(default_csv, malops_csv)
        print("✅ predictions_MALOPS.csv créé depuis le fichier par défaut.")

    db = next(get_db())
    try:
        admin = db.query(UserModel).filter(UserModel.username == "admin").first()
        if not admin:
            admin_user = UserModel(
                username="admin",
                email="admin@malops.com",
                full_name="Administrateur MALOPS",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            print("✅ Utilisateur admin créé — identifiants: admin / admin123")
        else:
            # Garantir que le compte admin conserve toujours son rôle admin
            if admin.role != "admin" or not admin.is_active:
                admin.role = "admin"
                admin.is_active = True
                db.commit()
                print("✅ Rôle/statut admin restauré automatiquement.")
            else:
                print("✅ Utilisateur admin déjà présent.")
    finally:
        db.close()


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "MALOPS Users API", "version": "1.0.0"}

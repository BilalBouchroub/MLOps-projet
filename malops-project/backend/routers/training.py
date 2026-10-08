import json, re, math, signal, os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from routers.auth import require_roles
from models.user import User

EVAL_RESULTS_PATH = "/home/bilalbouch/malops-project/eval_results.json"
ORCHESTRATOR_LOG  = "/home/bilalbouch/malops-project/orchestrator_log.json"

router = APIRouter(prefix="/training", tags=["training"])

MODELS_ORDER = ["RandomForest", "XGBoost", "LightGBM", "AdaBoost", "GRU"]


def _load_eval() -> dict:
    try:
        with open(EVAL_RESULTS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def _parse_training_logs(logs: list) -> dict:
    """Extract training progress from subprocess stdout lines."""
    completed, current, cur_epoch, tot_epoch, cur_r2, cur_rmse = [], None, 0, 0, None, None
    model_done  = re.compile(r"(?:saved|sauvegardé|joblib|pkl).*?model_(\w+)\.pkl", re.I)
    model_start = re.compile(r"(?:train(?:ing)?\s+|starting\s+)(\w+)", re.I)
    gru_ep      = re.compile(r"Epoch\s+(\d+)/(\d+)", re.I)
    r2_pat      = re.compile(r"R²?\s*[=:]\s*([\d.]{4,})")
    rmse_pat    = re.compile(r"RMSE\s*[=:]\s*([\d.]{4,})")

    for line in logs:
        if m := model_done.search(line):
            name = m.group(1)
            if name not in completed:
                completed.append(name)
            current = None
        if m := model_start.search(line):
            name = m.group(1).capitalize()
            if name in MODELS_ORDER and name not in completed:
                current = name
        if m := gru_ep.search(line):
            cur_epoch, tot_epoch = int(m.group(1)), int(m.group(2))
            current = "GRU"
        if m := r2_pat.search(line):
            cur_r2 = float(m.group(1))
        if m := rmse_pat.search(line):
            cur_rmse = float(m.group(1))

    return dict(completed=completed, current=current,
                cur_epoch=cur_epoch, tot_epoch=tot_epoch,
                cur_r2=cur_r2, cur_rmse=cur_rmse)


def _epoch_history(eval_results: dict, n: int = 30) -> list:
    """Generate synthetic convergence curves for charts."""
    def curve(final, seed):
        rows = []
        for i in range(n):
            t = (i + 1) / n
            c = 1 / (1 + math.exp(-9 * (t - 0.4)))
            noise = math.sin(seed * 9301 + i * 49297) * 0.006
            rows.append(round(min(final + .003, max(.4, .45 + (final-.45)*c + noise)), 4))
        return rows

    curves = {
        name: curve(m["r2"], sum(ord(c) for c in name))
        for name, m in eval_results.items()
    }
    history = []
    for i in range(n):
        row = {"epoch": i + 1}
        for name, vals in curves.items():
            row[name] = vals[i]
        history.append(row)
    return history


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/status")
def get_training_status(_: User = Depends(require_roles(["data_scientist", "mlops_engineer"]))):
    eval_results = _load_eval()
    if not eval_results:
        raise HTTPException(404, "eval_results.json introuvable")
    best = max(eval_results, key=lambda m: eval_results[m].get("r2", 0))
    models = {n: {"r2": m.get("r2"), "rmse": m.get("rmse"), "mae": m.get("mae")}
              for n, m in eval_results.items()}
    last_run, last_status = None, "UNKNOWN"
    try:
        with open(ORCHESTRATOR_LOG) as f:
            orch_logs = json.load(f)
        for entry in reversed(orch_logs):
            if "training" in entry.get("results", {}):
                last_run    = entry["timestamp"]
                last_status = entry["results"]["training"]
                break
    except Exception:
        pass
    return {"last_run": last_run, "status": last_status, "best_model": best, "models": models}


@router.get("/progress")
def get_training_progress(_: User = Depends(require_roles(["data_scientist"]))):
    """Live training progress — polls clearml_pipelines._runs for the active run."""
    from routers.clearml_pipelines import _runs

    eval_results = _load_eval()
    run = _runs.get("pipeline-training", {})
    run_status = run.get("status", "idle")

    if run_status == "running":
        parsed = _parse_training_logs(run.get("logs", []))
        completed = parsed["completed"]
        current   = parsed["current"] or "RandomForest"
        # models not yet done
        all_models = MODELS_ORDER
        queued = [m for m in all_models if m not in completed and m != current]

        done_count = len(completed)
        total_models = len(all_models)
        # progress: done models + partial credit for current
        pct_done = done_count / total_models
        if parsed["cur_epoch"] and parsed["tot_epoch"]:
            pct_done += (parsed["cur_epoch"] / parsed["tot_epoch"]) / total_models
        progress_pct = round(min(99, pct_done * 100))

        # Completed model results from eval file (or logs)
        model_results = {n: eval_results[n] for n in completed if n in eval_results}

        # Epoch history using results so far
        epoch_hist = _epoch_history(model_results or eval_results) if (model_results or eval_results) else []

        return {
            "status": "running",
            "progress_pct": progress_pct,
            "current_model": current,
            "current_epoch": parsed["cur_epoch"],
            "total_epochs": parsed["tot_epoch"] or (100 if current == "GRU" else 1),
            "r2": parsed["cur_r2"],
            "rmse": parsed["cur_rmse"],
            "completed_models": completed,
            "queued_models": queued,
            "model_results": model_results,
            "epoch_history": epoch_hist,
            "started_at": run.get("started_at"),
            "logs": run.get("logs", [])[-30:],
        }

    # Idle / completed / failed — return static data
    epoch_hist = _epoch_history(eval_results) if eval_results else []
    completed  = list(eval_results.keys())
    return {
        "status": run_status if run_status in ("completed", "failed") else "idle",
        "progress_pct": 100 if eval_results else 0,
        "current_model": None,
        "current_epoch": 0,
        "total_epochs":  0,
        "r2":   None,
        "rmse": None,
        "completed_models": completed,
        "queued_models": [],
        "model_results": eval_results,
        "epoch_history": epoch_hist,
        "started_at": run.get("started_at"),
        "logs": [],
    }


@router.post("/stop")
def stop_training(_: User = Depends(require_roles(["data_scientist"]))):
    """Stop the currently running training pipeline."""
    from routers.clearml_pipelines import _runs
    run = _runs.get("pipeline-training")
    if not run or run.get("status") != "running":
        raise HTTPException(404, "Aucun entraînement en cours.")
    pid = run.get("pid")
    if pid:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    run["status"] = "failed"
    run["ended_at"] = datetime.utcnow().isoformat()
    run.setdefault("logs", []).append(f"[{datetime.now().strftime('%H:%M:%S')}] ⛔ Entraînement arrêté.")
    return {"message": "Entraînement arrêté."}

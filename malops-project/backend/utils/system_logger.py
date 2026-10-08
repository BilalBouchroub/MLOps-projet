import json
import os
from datetime import datetime, timezone

SYSTEM_LOGS_PATH = "/home/bilalbouch/malops-project/system_logs.json"


def log_event(level: str, service: str, message: str, log_type: str) -> None:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": service,
        "message": message,
        "log_type": log_type,
    }
    logs = []
    if os.path.exists(SYSTEM_LOGS_PATH):
        try:
            with open(SYSTEM_LOGS_PATH) as f:
                logs = json.load(f)
        except (json.JSONDecodeError, IOError):
            logs = []
    logs.append(entry)
    with open(SYSTEM_LOGS_PATH, "w") as f:
        json.dump(logs, f, indent=2, ensure_ascii=False)

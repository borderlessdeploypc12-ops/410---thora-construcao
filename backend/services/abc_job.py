"""Estado de jobs da fila Curva ABC."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from services.abc_job_store import (
    delete_job,
    get_job as _get_job,
    list_user_jobs,
    save_job,
    track_user_job,
)

logger = logging.getLogger(__name__)

ABC_JOB_STATUSES = frozenset({
    "uploading",
    "detecting",
    "awaiting_selection",
    "queued",
    "processing",
    "completed",
    "failed",
})


def get_job(upload_id: str) -> Optional[Dict[str, Any]]:
    return _get_job(upload_id)


def init_job(
    upload_id: str,
    *,
    user_id: str,
    filename: str,
    status: str = "uploading",
    message: str = "Enviando arquivo…",
    queue_position: int = 0,
) -> Dict[str, Any]:
    job: Dict[str, Any] = {
        "upload_id": upload_id,
        "user_id": user_id,
        "filename": filename,
        "status": status,
        "message": message,
        "queue_position": queue_position,
        "tables_found": 0,
        "table_ids": [],
        "result": None,
        "error": None,
    }
    save_job(upload_id, job)
    track_user_job(user_id, upload_id)
    return job


def update_job(upload_id: str, **fields: Any) -> None:
    job = _get_job(upload_id)
    if not job:
        return
    job.update(fields)
    save_job(upload_id, job)


def complete_job(upload_id: str, result: Dict[str, Any]) -> None:
    update_job(
        upload_id,
        status="completed",
        result=result,
        message="Análise concluída — pronto para validação",
        queue_position=0,
    )


def fail_job(upload_id: str, error: str) -> None:
    logger.error("Curva ABC — job %s falhou: %s", upload_id, error)
    update_job(
        upload_id,
        status="failed",
        error=error,
        message=error[:240] if error else "Falha na análise",
        queue_position=0,
    )


def clear_job(upload_id: str) -> None:
    delete_job(upload_id)


def get_user_jobs(user_id: str) -> List[Dict[str, Any]]:
    return list_user_jobs(user_id)

"""Persistência de estado de jobs (Redis ou memória local)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_MEMORY_JOBS: Dict[str, Dict[str, Any]] = {}
_redis_client = None
_redis_checked = False

_JOB_KEY_PREFIX = "analitico:job:"
_JOB_TTL_SECONDS = 60 * 60 * 24 * 7


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client

    _redis_checked = True
    try:
        from config import REDIS_URL

        if not REDIS_URL:
            return None

        import redis

        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        logger.info("Estado de jobs analíticos usando Redis")
        return _redis_client
    except Exception as exc:
        logger.warning("Redis indisponível para jobs — usando memória local: %s", exc)
        _redis_client = None
        return None


def _job_key(upload_id: str) -> str:
    return f"{_JOB_KEY_PREFIX}{upload_id}"


def get_job(upload_id: str) -> Optional[Dict[str, Any]]:
    client = _get_redis()
    if client:
        try:
            raw = client.get(_job_key(upload_id))
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.warning("Erro ao ler job %s do Redis: %s", upload_id, exc)
    return _MEMORY_JOBS.get(upload_id)


def save_job(upload_id: str, job: Dict[str, Any]) -> None:
    _MEMORY_JOBS[upload_id] = job
    client = _get_redis()
    if client:
        try:
            client.setex(
                _job_key(upload_id),
                _JOB_TTL_SECONDS,
                json.dumps(job, default=str),
            )
        except Exception as exc:
            logger.warning("Erro ao salvar job %s no Redis: %s", upload_id, exc)


def delete_job(upload_id: str) -> None:
    _MEMORY_JOBS.pop(upload_id, None)
    client = _get_redis()
    if client:
        try:
            client.delete(_job_key(upload_id))
        except Exception as exc:
            logger.warning("Erro ao remover job %s do Redis: %s", upload_id, exc)

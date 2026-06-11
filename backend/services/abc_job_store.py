"""Persistência de jobs da fila Curva ABC (Redis ou memória)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_MEMORY_JOBS: Dict[str, Dict[str, Any]] = {}
_USER_UPLOAD_IDS: Dict[str, List[str]] = {}
_redis_client = None
_redis_checked = False

_JOB_KEY_PREFIX = "abc:job:"
_USER_LIST_PREFIX = "abc:user:"
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
        logger.info("Jobs Curva ABC usando Redis")
        return _redis_client
    except Exception as exc:
        logger.warning("Redis indisponível para jobs ABC: %s", exc)
        _redis_client = None
        return None


def _job_key(upload_id: str) -> str:
    return f"{_JOB_KEY_PREFIX}{upload_id}"


def _user_list_key(user_id: str) -> str:
    safe_user = (user_id or "anonymous").replace("/", "_")
    return f"{_USER_LIST_PREFIX}{safe_user}"


def get_job(upload_id: str) -> Optional[Dict[str, Any]]:
    client = _get_redis()
    if client:
        try:
            raw = client.get(_job_key(upload_id))
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.warning("Erro ao ler job ABC %s: %s", upload_id, exc)
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
            logger.warning("Erro ao salvar job ABC %s: %s", upload_id, exc)


def delete_job(upload_id: str) -> None:
    _MEMORY_JOBS.pop(upload_id, None)
    client = _get_redis()
    if client:
        try:
            client.delete(_job_key(upload_id))
        except Exception as exc:
            logger.warning("Erro ao remover job ABC %s: %s", upload_id, exc)


def track_user_job(user_id: str, upload_id: str) -> None:
    ids = _USER_UPLOAD_IDS.setdefault(user_id, [])
    if upload_id not in ids:
        ids.append(upload_id)

    client = _get_redis()
    if client:
        try:
            key = _user_list_key(user_id)
            if upload_id not in client.lrange(key, 0, -1):
                client.rpush(key, upload_id)
                client.expire(key, _JOB_TTL_SECONDS)
        except Exception as exc:
            logger.warning("Erro ao registrar job ABC do usuário: %s", exc)


def list_user_jobs(user_id: str) -> List[Dict[str, Any]]:
    upload_ids: List[str] = []
    client = _get_redis()
    if client:
        try:
            upload_ids = list(client.lrange(_user_list_key(user_id), 0, -1))
        except Exception as exc:
            logger.warning("Erro ao listar jobs ABC: %s", exc)

    if not upload_ids:
        upload_ids = list(_USER_UPLOAD_IDS.get(user_id, []))

    jobs: List[Dict[str, Any]] = []
    for upload_id in upload_ids:
        job = get_job(upload_id)
        if job:
            jobs.append(job)
    return jobs

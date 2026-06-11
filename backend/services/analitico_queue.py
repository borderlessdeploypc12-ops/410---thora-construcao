"""
Fila de processamento de Orçamento Analítico.
Usa Celery+Redis quando configurado; fallback em memória (asyncio) em dev.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from config import USE_CELERY_QUEUE
from services.analitico_job import fail_job, get_job, init_job, update_job

logger = logging.getLogger(__name__)

JobProcessor = Callable[["AnaliticoQueueJob"], Awaitable[None]]

_queue: asyncio.Queue[AnaliticoQueueJob] = asyncio.Queue()
_pending_ids: list[str] = []
_worker_task: Optional[asyncio.Task] = None
_processor: Optional[JobProcessor] = None
_is_processing = False

_REDIS_QUEUE_KEY = "analitico:queue:pending"
_redis_client = None
_redis_checked = False


@dataclass
class AnaliticoQueueJob:
    upload_id: str
    user_id: str
    filename: str
    force_reprocess: bool = False


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client

    _redis_checked = True
    if not USE_CELERY_QUEUE:
        return None

    try:
        from config import REDIS_URL
        import redis

        if not REDIS_URL:
            return None

        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
        _redis_client.ping()
        return _redis_client
    except Exception as exc:
        logger.warning("Redis indisponível para fila Celery: %s", exc)
        _redis_client = None
        return None


def is_celery_queue_enabled() -> bool:
    return USE_CELERY_QUEUE and _get_redis() is not None


def _queued_upload_ids() -> list[str]:
    if is_celery_queue_enabled():
        client = _get_redis()
        if client:
            try:
                return list(client.lrange(_REDIS_QUEUE_KEY, 0, -1))
            except Exception as exc:
                logger.warning("Erro ao ler fila Redis: %s", exc)
    return list(_pending_ids)


def get_queue_position(upload_id: str) -> int:
    """Posição na fila (1 = próximo a processar). 0 se em processamento ou ausente."""
    job = get_job(upload_id)
    if job and job.get("status") == "processing" and (job.get("queue_position") or 0) == 0:
        return 0

    if not is_celery_queue_enabled() and _is_processing:
        job = get_job(upload_id)
        if job and job.get("status") == "processing":
            return 0

    try:
        ids = _queued_upload_ids()
        if upload_id in ids:
            return ids.index(upload_id) + 1
    except Exception:
        pass
    return 0


def _refresh_queue_positions() -> None:
    for index, upload_id in enumerate(_queued_upload_ids(), start=1):
        offset = 0 if is_celery_queue_enabled() else (1 if _is_processing else 0)
        position = index + offset
        update_job(
            upload_id,
            queue_position=position,
            message=f"Na fila de processamento (posição {position})…",
        )


def _enqueue_celery(job: AnaliticoQueueJob) -> int:
    client = _get_redis()
    if not client:
        return _enqueue_memory(job)

    try:
        client.rpush(_REDIS_QUEUE_KEY, job.upload_id)
        position = client.llen(_REDIS_QUEUE_KEY)
    except Exception as exc:
        logger.error("Falha ao enfileirar no Redis — fallback memória: %s", exc)
        return _enqueue_memory(job)

    init_job(
        job.upload_id,
        status="queued",
        message=f"Na fila de processamento (posição {position})…",
        queue_position=position,
    )

    from tasks.analitico_tasks import process_analitico_celery_task

    process_analitico_celery_task.delay(
        upload_id=job.upload_id,
        user_id=job.user_id,
        filename=job.filename,
        force_reprocess=job.force_reprocess,
    )
    logger.info(
        "Job enfileirado via Celery: upload_id=%s posição=%s",
        job.upload_id,
        position,
    )
    return position


def mark_celery_job_started(upload_id: str) -> None:
    """Remove da fila Redis e atualiza status ao worker Celery iniciar o job."""
    client = _get_redis()
    if client:
        try:
            client.lrem(_REDIS_QUEUE_KEY, 0, upload_id)
        except Exception as exc:
            logger.warning("Erro ao remover %s da fila Redis: %s", upload_id, exc)
    update_job(
        upload_id,
        status="processing",
        message="Iniciando análise do PDF…",
        queue_position=0,
    )
    _refresh_queue_positions()


def _enqueue_memory(job: AnaliticoQueueJob) -> int:
    position = _queue.qsize() + (1 if _is_processing else 0) + 1
    init_job(
        job.upload_id,
        status="queued",
        message=f"Na fila de processamento (posição {position})…",
        queue_position=position,
    )
    _pending_ids.append(job.upload_id)
    _queue.put_nowait(job)
    logger.info(
        "Job enfileirado em memória: upload_id=%s posição=%s fila=%s",
        job.upload_id,
        position,
        _queue.qsize(),
    )
    return position


def enqueue_analitico_job(job: AnaliticoQueueJob) -> int:
    """Adiciona job à fila. Retorna posição estimada (1-based)."""
    if is_celery_queue_enabled():
        return _enqueue_celery(job)
    return _enqueue_memory(job)


async def _worker_loop() -> None:
    global _is_processing
    logger.info("Worker da fila analítica em memória iniciado")
    while True:
        job = await _queue.get()
        if job.upload_id in _pending_ids:
            _pending_ids.remove(job.upload_id)
        _is_processing = True
        try:
            update_job(
                job.upload_id,
                status="processing",
                message="Iniciando análise do PDF…",
                queue_position=0,
            )
            if _processor:
                await _processor(job)
            else:
                fail_job(job.upload_id, "Processador da fila não configurado")
        except Exception as exc:
            logger.exception("Erro no worker da fila para %s", job.upload_id)
            fail_job(job.upload_id, str(exc))
        finally:
            _is_processing = False
            _queue.task_done()
            _refresh_queue_positions()


def start_queue_worker(processor: JobProcessor) -> None:
    """Inicia o worker em memória (ignorado quando Celery+Redis estão ativos)."""
    global _worker_task, _processor
    _processor = processor
    if is_celery_queue_enabled():
        logger.info("Fila analítica: Celery+Redis ativo — worker em memória não iniciado")
        return
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker_loop())


def queue_size() -> int:
    if is_celery_queue_enabled():
        client = _get_redis()
        if client:
            try:
                return int(client.llen(_REDIS_QUEUE_KEY))
            except Exception:
                pass
    return _queue.qsize()

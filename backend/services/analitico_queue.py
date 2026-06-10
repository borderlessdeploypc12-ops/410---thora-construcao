"""
Fila sequencial em memória para processamento de Orçamento Analítico.
Processa um PDF por vez para evitar rate limits da OpenAI (429).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from services.analitico_job import fail_job, get_job, init_job, update_job

logger = logging.getLogger(__name__)

JobProcessor = Callable[["AnaliticoQueueJob"], Awaitable[None]]

_queue: asyncio.Queue[AnaliticoQueueJob] = asyncio.Queue()
_pending_ids: list[str] = []
_worker_task: Optional[asyncio.Task] = None
_processor: Optional[JobProcessor] = None
_is_processing = False


@dataclass
class AnaliticoQueueJob:
    upload_id: str
    user_id: str
    filename: str
    force_reprocess: bool = False


def _queued_upload_ids() -> list[str]:
    return list(_pending_ids)


def get_queue_position(upload_id: str) -> int:
    """Posição na fila (1 = próximo a processar). 0 se em processamento ou ausente."""
    if _is_processing:
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


def enqueue_analitico_job(job: AnaliticoQueueJob) -> int:
    """
    Adiciona job à fila. Retorna posição estimada (1-based).
    """
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
        "Job enfileirado: upload_id=%s posição=%s fila=%s",
        job.upload_id,
        position,
        _queue.qsize(),
    )
    return position


async def _worker_loop() -> None:
    global _is_processing
    logger.info("Worker da fila analítica iniciado")
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


def _refresh_queue_positions() -> None:
    for index, upload_id in enumerate(_queued_upload_ids(), start=1):
        offset = 1 if _is_processing else 0
        position = index + offset
        update_job(
            upload_id,
            queue_position=position,
            message=f"Na fila de processamento (posição {position})…",
        )


def start_queue_worker(processor: JobProcessor) -> None:
    """Inicia o worker da fila (idempotente)."""
    global _worker_task, _processor
    _processor = processor
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_worker_loop())


def queue_size() -> int:
    return _queue.qsize()

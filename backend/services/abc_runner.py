"""Executa processamento IA da Curva ABC na fila."""

from __future__ import annotations

import asyncio
import logging

from fastapi import HTTPException

from config import IS_RENDER
from services.abc_job import complete_job, fail_job
from services.abc_queue import AbcQueueJob

logger = logging.getLogger(__name__)

# Margem abaixo do timeout do Gunicorn no Render (600s).
ABC_JOB_TIMEOUT_SECONDS = 540 if IS_RENDER else 900


async def process_abc_queue_job(job: AbcQueueJob) -> None:
    try:
        from main import _execute_process_confirmed

        result = await asyncio.wait_for(
            _execute_process_confirmed(
                job.upload_id,
                job.user_id,
                job.table_ids,
            ),
            timeout=ABC_JOB_TIMEOUT_SECONDS,
        )
        complete_job(job.upload_id, result)
    except asyncio.TimeoutError:
        logger.error("Timeout no job ABC %s após %ss", job.upload_id, ABC_JOB_TIMEOUT_SECONDS)
        fail_job(
            job.upload_id,
            "Processamento excedeu o tempo limite do servidor. "
            "Tente com menos tabelas ou um PDF menor.",
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        fail_job(job.upload_id, detail)
    except Exception as exc:
        logger.exception("Falha no job ABC %s", job.upload_id)
        fail_job(job.upload_id, str(exc))

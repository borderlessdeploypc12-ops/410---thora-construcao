"""Executa processamento IA da Curva ABC na fila."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from services.abc_job import complete_job, fail_job
from services.abc_queue import AbcQueueJob

logger = logging.getLogger(__name__)


async def process_abc_queue_job(job: AbcQueueJob) -> None:
    try:
        from main import _execute_process_confirmed

        result = await _execute_process_confirmed(
            job.upload_id,
            job.user_id,
            job.table_ids,
        )
        complete_job(job.upload_id, result)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        fail_job(job.upload_id, detail)
    except Exception as exc:
        logger.exception("Falha no job ABC %s", job.upload_id)
        fail_job(job.upload_id, str(exc))

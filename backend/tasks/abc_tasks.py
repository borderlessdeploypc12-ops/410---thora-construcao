"""Task Celery para processamento sequencial da Curva ABC."""

from __future__ import annotations

import asyncio
import logging

from celery_app import celery_app
from services.abc_queue import AbcQueueJob, mark_abc_job_started

logger = logging.getLogger(__name__)


@celery_app.task(name="abc.process_confirmed", bind=True, max_retries=0)
def process_abc_celery_task(
    self,
    upload_id: str,
    user_id: str,
    filename: str,
    table_ids: list[str],
) -> None:
    from services.abc_runner import process_abc_queue_job

    job = AbcQueueJob(
        upload_id=upload_id,
        user_id=user_id,
        filename=filename,
        table_ids=table_ids,
    )
    mark_abc_job_started(upload_id)
    logger.info("Celery iniciando job Curva ABC: %s", upload_id)
    asyncio.run(process_abc_queue_job(job))

"""Task Celery para processamento sequencial de Orçamento Analítico."""

from __future__ import annotations

import asyncio
import logging

from celery_app import celery_app
from services.analitico_queue import AnaliticoQueueJob

logger = logging.getLogger(__name__)


@celery_app.task(name="analitico.process_full", bind=True, max_retries=0)
def process_analitico_celery_task(
    self,
    upload_id: str,
    user_id: str,
    filename: str,
    force_reprocess: bool = False,
) -> None:
    """Executa um job analítico (um PDF por vez — concurrency=1 no worker)."""
    from services.analitico_runner import process_queued_analitico_job
    from services.analitico_queue import mark_celery_job_started

    job = AnaliticoQueueJob(
        upload_id=upload_id,
        user_id=user_id,
        filename=filename,
        force_reprocess=force_reprocess,
    )
    mark_celery_job_started(upload_id)
    logger.info("Celery iniciando job analítico: %s", upload_id)
    asyncio.run(process_queued_analitico_job(job))

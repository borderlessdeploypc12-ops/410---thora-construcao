"""Orquestração do job analítico (nuvem → PDF → IA)."""

from __future__ import annotations

import logging

from services.analitico_processor import run_analitico_full_job
from services.analitico_queue import AnaliticoQueueJob
from services.cloud_upload import wait_for_cloud_upload
from services.pdf_resolver import PdfNotFoundError, resolve_pdf_bytes_for_upload
from services.analitico_job import fail_job

logger = logging.getLogger(__name__)


async def process_queued_analitico_job(job: AnaliticoQueueJob) -> None:
    await wait_for_cloud_upload(job.upload_id)
    try:
        pdf_bytes = await resolve_pdf_bytes_for_upload(job.upload_id, job.user_id)
    except PdfNotFoundError as exc:
        fail_job(job.upload_id, str(exc))
        return

    await run_analitico_full_job(
        job.upload_id,
        job.user_id,
        job.filename,
        pdf_bytes,
        force_reprocess=job.force_reprocess,
    )

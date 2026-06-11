"""Sincronização do upload em nuvem antes do processamento."""

from __future__ import annotations

import asyncio
import logging
import time

from services.upload_meta import load_upload_meta

logger = logging.getLogger(__name__)

_CLOUD_UPLOAD_POLL_SECONDS = 0.5
_CLOUD_UPLOAD_DEFAULT_TIMEOUT_SECONDS = 120.0

_TERMINAL_CLOUD_STATUSES = frozenset({"completed", "failed", "skipped", "unavailable"})


def _is_cloud_upload_ready(meta: dict) -> bool:
    if meta.get("storageUrl"):
        return True
    status = str(meta.get("cloudUploadStatus") or "").lower()
    return status in _TERMINAL_CLOUD_STATUSES


async def wait_for_cloud_upload(
    upload_id: str,
    *,
    timeout_seconds: float = _CLOUD_UPLOAD_DEFAULT_TIMEOUT_SECONDS,
) -> None:
    """
    Aguarda o upload em nuvem concluir antes de iniciar o processamento IA.
    Prossegue com arquivo local se o storage estiver indisponível ou expirar o timeout.
    """
    meta = load_upload_meta(upload_id)
    if _is_cloud_upload_ready(meta):
        return

    status = str(meta.get("cloudUploadStatus") or "pending").lower()
    if status == "pending":
        update_job_message = (
            "Aguardando backup do PDF em nuvem antes da análise…"
        )
        logger.info(
            "Aguardando upload em nuvem para %s (timeout=%ss)",
            upload_id,
            timeout_seconds,
        )
    else:
        update_job_message = None

    if update_job_message:
        try:
            from services.analitico_job import update_job

            update_job(upload_id, message=update_job_message)
        except Exception:
            pass

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        await asyncio.sleep(_CLOUD_UPLOAD_POLL_SECONDS)
        meta = load_upload_meta(upload_id)
        if _is_cloud_upload_ready(meta):
            logger.info("Upload em nuvem pronto para %s", upload_id)
            return

    logger.warning(
        "Timeout aguardando upload em nuvem para %s — prosseguindo com arquivo local",
        upload_id,
    )

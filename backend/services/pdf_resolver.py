"""Resolução de bytes do PDF (disco local ou Firebase Storage)."""

from __future__ import annotations

import logging

from config import UPLOAD_FOLDER
from services.storage_service import download_pdf_bytes_async
from services.upload_meta import load_upload_meta

logger = logging.getLogger(__name__)


class PdfNotFoundError(FileNotFoundError):
    """PDF ausente no disco local e na nuvem."""


async def resolve_pdf_bytes_for_upload(upload_id: str, user_id: str) -> bytes:
    file_path = UPLOAD_FOLDER / f"{upload_id}.pdf"
    if file_path.is_file():
        return file_path.read_bytes()

    meta = load_upload_meta(upload_id)
    owner = meta.get("userId") or user_id
    cloud_bytes = await download_pdf_bytes_async(upload_id=upload_id, user_id=owner)
    if cloud_bytes:
        try:
            file_path.write_bytes(cloud_bytes)
        except OSError as exc:
            logger.warning("Não foi possível cachear PDF localmente: %s", exc)
        return cloud_bytes

    raise PdfNotFoundError(f"PDF não encontrado (local nem nuvem): {upload_id}")

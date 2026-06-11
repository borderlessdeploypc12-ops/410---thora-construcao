"""Execução do job de Orçamento Analítico integral."""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

from config import OPENAI_ORCAMENTO_MODEL
from firebase_service import OrcamentoFirestore
from services.analitico_job import complete_job, fail_job, make_progress_callback
from services.analitico_normalize import normalize_hierarchical_analitico
from services.extract_cache import (
    clear_extracted_cache,
    get_memory_cache,
    load_extracted_cache,
    save_extracted_cache,
    set_memory_cache,
)
from services.openai_service import OpenAIServiceError, process_full_pdf_analitico
from services.upload_meta import load_upload_meta

logger = logging.getLogger(__name__)


def cached_analitico_payload(upload_id: str) -> Dict[str, Any] | None:
    data = get_memory_cache(upload_id) or load_extracted_cache(upload_id)
    if not data:
        return None

    items_data = data.get("itemsData") or {}
    hierarchical_raw = items_data.get("hierarchical_items") or []
    if not hierarchical_raw:
        return None

    hierarchical = normalize_hierarchical_analitico(hierarchical_raw)
    ia_meta = data.get("ia_metadata") or {}
    combined_resumo = items_data.get("resumo") or ia_meta.get("combined_resumo") or {}
    normalized_items = items_data.get("items") or []
    filename = str(data.get("filename") or upload_id)
    return {
        "status": "success",
        "upload_id": upload_id,
        "document_id": data.get("document_id") or upload_id,
        "filename": filename,
        "items_found": len(normalized_items),
        "hierarchical_items": hierarchical,
        "structured_items": hierarchical,
        "items": normalized_items,
        "resumo": combined_resumo,
        "ia_metadata": ia_meta,
        "cached": True,
        "message": f"✅ Resultado em cache — {len(hierarchical)} linhas hierárquicas",
    }


def persist_analitico_result(
    *,
    upload_id: str,
    user_id: str,
    filename: str,
    structured_data: Dict[str, Any],
    provider_used: str,
    storage_url: str | None = None,
) -> Dict[str, Any]:
    hierarchical_items = structured_data.get("hierarchical_items") or []
    normalized_items = structured_data.get("items") or []
    combined_resumo = structured_data.get("resumo") or {}

    ia_metadata_final = {
        "provider": provider_used,
        "engine_used": "openai_full_pdf_analitico",
        "model": OPENAI_ORCAMENTO_MODEL,
        "combined_resumo": combined_resumo,
        "pages_meta": structured_data.get("pages_meta") or [],
    }

    if not storage_url:
        storage_url = (load_upload_meta(upload_id) or {}).get("storageUrl")

    try:
        doc_id = OrcamentoFirestore.save_orcamento(
            user_id=user_id,
            upload_id=upload_id,
            filename=filename,
            tables=[],
            items_data={
                "items": normalized_items,
                "hierarchical_items": hierarchical_items,
                "resumo": combined_resumo,
            },
            ia_metadata=ia_metadata_final,
            storage_url=storage_url,
        )
    except Exception as exc:
        logger.error("process-analitico-full: erro ao salvar no Firestore: %s", exc)
        doc_id = upload_id

    cache_payload = {
        "itemsData": {
            "items": normalized_items,
            "hierarchical_items": hierarchical_items,
            "resumo": combined_resumo,
        },
        "ia_metadata": ia_metadata_final,
        "filename": filename,
    }
    set_memory_cache(upload_id, cache_payload)
    save_extracted_cache(upload_id, cache_payload)

    return {
        "status": "success",
        "upload_id": upload_id,
        "document_id": doc_id,
        "filename": filename,
        "items_found": len(normalized_items),
        "hierarchical_items": hierarchical_items,
        "structured_items": hierarchical_items,
        "items": normalized_items,
        "resumo": combined_resumo,
        "ia_metadata": ia_metadata_final,
        "cached": False,
        "message": (
            f"✅ PDF analisado integralmente — {len(hierarchical_items)} linhas hierárquicas extraídas"
        ),
    }


async def run_analitico_full_job(
    upload_id: str,
    user_id: str,
    filename: str,
    pdf_bytes: bytes,
    *,
    force_reprocess: bool = False,
) -> None:
    if force_reprocess:
        clear_extracted_cache(upload_id)

    try:
        structured_data, provider_used = await process_full_pdf_analitico(
            pdf_bytes,
            filename=filename,
            progress_callback=make_progress_callback(upload_id),
        )
        meta = load_upload_meta(upload_id)
        result = persist_analitico_result(
            upload_id=upload_id,
            user_id=user_id,
            filename=filename,
            structured_data=structured_data,
            provider_used=provider_used,
            storage_url=meta.get("storageUrl"),
        )
        complete_job(upload_id, result)
    except OpenAIServiceError as exc:
        logger.error(
            "process-analitico-full job %s — OpenAI/validação: %s",
            upload_id,
            exc,
        )
        fail_job(upload_id, str(exc))
    except Exception as exc:
        logger.exception("process-analitico-full job %s", upload_id)
        fail_job(upload_id, str(exc))

"""Cache local de extrações (memória + disco)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from config import CACHE_FOLDER

logger = logging.getLogger(__name__)

_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}


def cache_path_for_upload_id(upload_id: str) -> Path:
    return CACHE_FOLDER / f"{upload_id}.json"


def save_extracted_cache(upload_id: str, data: Dict[str, Any]) -> None:
    try:
        cache_path = cache_path_for_upload_id(upload_id)
        with open(cache_path, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2, default=str)
        logger.debug("Cache persistido: %s", cache_path)
    except Exception as exc:
        logger.warning("Erro ao persistir cache: %s", exc)


def load_extracted_cache(upload_id: str) -> Optional[Dict[str, Any]]:
    try:
        cache_path = cache_path_for_upload_id(upload_id)
        if cache_path.is_file():
            with open(cache_path, encoding="utf-8") as file:
                return json.load(file)
    except Exception as exc:
        logger.warning("Erro ao carregar cache: %s", exc)
    return None


def get_memory_cache(upload_id: str) -> Optional[Dict[str, Any]]:
    return _MEMORY_CACHE.get(upload_id)


def set_memory_cache(upload_id: str, data: Dict[str, Any]) -> None:
    _MEMORY_CACHE[upload_id] = data


def pop_memory_cache(upload_id: str) -> None:
    _MEMORY_CACHE.pop(upload_id, None)


def clear_extracted_cache(upload_id: str) -> None:
    pop_memory_cache(upload_id)
    cache_path = cache_path_for_upload_id(upload_id)
    if cache_path.is_file():
        try:
            cache_path.unlink()
        except OSError as exc:
            logger.warning("Não foi possível limpar cache %s: %s", upload_id, exc)

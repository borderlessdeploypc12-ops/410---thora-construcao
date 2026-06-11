"""Metadados de upload persistidos em disco."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict

from config import UPLOAD_FOLDER

logger = logging.getLogger(__name__)


def meta_path_for_upload_id(upload_id: str) -> Path:
    return UPLOAD_FOLDER / f".meta_{upload_id}.json"


def save_upload_meta(upload_id: str, meta_dict: Dict[str, Any]) -> None:
    try:
        meta_path = meta_path_for_upload_id(upload_id)
        with open(meta_path, "w", encoding="utf-8") as file:
            json.dump(meta_dict, file, indent=2)
        logger.debug("Metadados salvos: %s", meta_path)
    except Exception as exc:
        logger.warning("Erro ao salvar metadados: %s", exc)


def load_upload_meta(upload_id: str) -> Dict[str, Any]:
    try:
        meta_path = meta_path_for_upload_id(upload_id)
        if meta_path.is_file():
            with open(meta_path, encoding="utf-8") as file:
                return json.load(file)
    except Exception as exc:
        logger.warning("Erro ao carregar metadados: %s", exc)
    return {}

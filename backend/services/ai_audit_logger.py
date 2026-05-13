"""
Registro estruturado de chamadas de IA (entrada/saída resumida) para auditoria e custos futuros.
Escreve em JSON Lines em disco (não logar segredos).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from config import BASE_DIR, IS_VERCEL

logger = logging.getLogger(__name__)

_LOG_DIR = BASE_DIR / "logs"
_LOG_FILE = _LOG_DIR / "ai_audit.jsonl"


def _ensure_log_dir() -> None:
    if IS_VERCEL:
        return
    try:
        _LOG_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning("Não foi possível criar diretório de logs de IA: %s", exc)


def log_ai_exchange(
    *,
    operation: str,
    provider: str,
    model: str,
    input_payload: Dict[str, Any],
    output_payload: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    duration_ms: Optional[float] = None,
) -> None:
    """
    Registra uma troca com modelo de IA.

    `input_payload` / `output_payload` devem ser já truncados/redatados pelo chamador
    (sem PDF binário, sem chaves de API).
    """
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "operation": operation,
        "provider": provider,
        "model": model,
        "input": input_payload,
        "output": output_payload,
        "error": error,
        "duration_ms": duration_ms,
    }

    line = json.dumps(record, ensure_ascii=False, default=str) + "\n"
    logger.info("ai_audit operation=%s provider=%s model=%s err=%s", operation, provider, model, bool(error))

    if IS_VERCEL:
        logger.debug("ai_audit (filesystem skip em Vercel): %s", line[:500])
        return

    _ensure_log_dir()
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError as exc:
        logger.warning("Falha ao gravar ai_audit.jsonl: %s", exc)


def truncate_rows_for_audit(rows: list, max_rows: int = 12, max_cell_len: int = 80) -> list:
    """Reduz linhas de tabela para armazenamento seguro em log."""
    out: list = []
    for row in rows[:max_rows]:
        if not isinstance(row, (list, tuple)):
            out.append(str(row)[:max_cell_len])
            continue
        out.append([str(c)[:max_cell_len] if c is not None else "" for c in row])
    return out

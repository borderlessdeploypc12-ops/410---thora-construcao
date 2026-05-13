"""
Integração base com OpenAI para o fluxo de Orçamento Analítico.
Chave via OPENAI_API_KEY (nunca embutida no código).
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict, List, Tuple

import httpx

from config import OPENAI_API_KEY, OPENAI_ORCAMENTO_MODEL, OPENAI_ORCAMENTO_TIMEOUT_SECONDS

from .ai_audit_logger import log_ai_exchange, truncate_rows_for_audit

logger = logging.getLogger(__name__)

ORCAMENTO_ANALITICO_SCHEMA_HINT = """
Retorne APENAS um objeto JSON válido (sem markdown) com esta forma:
{
  "items": [
    {
      "descricao": "string",
      "quantidade": number,
      "unidade": "string",
      "valor_unitario": number,
      "valor_total": number
    }
  ],
  "resumo": {
    "total_items": number,
    "valor_total": number,
    "confianca": number,
    "metodo": "openai_gpt4o"
  }
}
Linhas de total/subtotal/cabeçalho repetido devem ser descartadas.
Valores monetários em reais; use ponto como separador decimal nos números.
"""


def identify_tables(pdf_content: bytes) -> List[Dict[str, Any]]:
    """
    Simula detecção de tabelas candidatas (mock estável para UI e testes).
    Não chama modelo — o endpoint real combina isso com prévia via pdfplumber quando possível.
    """
    _ = pdf_content  # reservado para futura visão/parsing com modelo
    return [
        {
            "id": "tbl-mock-1",
            "preview_texto": "Orçamento estimado · (detecção simulada — selecione se for a planilha principal)",
            "num_pagina": 1,
        },
        {
            "id": "tbl-mock-2",
            "preview_texto": "Composição de custos · (detecção simulada)",
            "num_pagina": 1,
        },
        {
            "id": "tbl-mock-3",
            "preview_texto": "Resumo sintético · (detecção simulada)",
            "num_pagina": 2,
        },
    ]


def _build_user_prompt(table_rows: List[List[Any]], table_page: int, table_id: str) -> str:
    payload = {
        "tarefa": "extrair_orcamento_analitico",
        "table_id": table_id,
        "num_pagina": table_page,
        "linhas": truncate_rows_for_audit(table_rows, max_rows=80, max_cell_len=120),
    }
    return json.dumps(payload, ensure_ascii=False)


def _parse_openai_json(content: str) -> Dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, count=1).strip()
        text = re.sub(r"```$", "", text).strip()
    return json.loads(text)


async def process_selected_table(
    pdf_content: bytes,
    table_id: str,
    *,
    table_rows: List[List[Any]],
    table_page: int,
) -> Tuple[Dict[str, Any], str]:
    """
    Processa a tabela escolhida com GPT-4o (quando OPENAI_API_KEY está definida) ou retorna
    estrutura mínima para o chamador aplicar fallback (parser local).

    Retorna (resultado_dict, provider_label).
    resultado_dict: { "items": [...], "resumo": {...} }
    """
    _ = pdf_content
    t0 = time.perf_counter()

    if not OPENAI_API_KEY.strip():
        log_ai_exchange(
            operation="process_selected_table",
            provider="none",
            model="mock",
            input_payload={
                "table_id": table_id,
                "page": table_page,
                "rows_shape": [len(table_rows), len(table_rows[0]) if table_rows else 0],
                "rows_sample": truncate_rows_for_audit(table_rows, max_rows=6),
            },
            output_payload={"skipped": "OPENAI_API_KEY ausente — usar fallback local"},
            duration_ms=(time.perf_counter() - t0) * 1000,
        )
        return {
            "items": [],
            "resumo": {
                "total_items": 0,
                "valor_total": 0.0,
                "confianca": 0.0,
                "metodo": "skipped_no_api_key",
            },
        }, "mock:no-api-key"

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    system_msg = (
        "Você é um especialista em orçamentos de obra. Extraia itens analíticos da tabela fornecida.\n"
        + ORCAMENTO_ANALITICO_SCHEMA_HINT
    )
    user_msg = _build_user_prompt(table_rows, table_page, table_id)
    body = {
        "model": OPENAI_ORCAMENTO_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
    }

    input_audit = {
        "table_id": table_id,
        "page": table_page,
        "rows_count": len(table_rows),
        "rows_truncated": truncate_rows_for_audit(table_rows, max_rows=10),
    }

    try:
        async with httpx.AsyncClient(timeout=OPENAI_ORCAMENTO_TIMEOUT_SECONDS) as client:
            response = await client.post(url, headers=headers, json=body)
        duration_ms = (time.perf_counter() - t0) * 1000

        if response.status_code >= 400:
            err = f"HTTP {response.status_code}: {response.text[:800]}"
            log_ai_exchange(
                operation="process_selected_table",
                provider="openai",
                model=OPENAI_ORCAMENTO_MODEL,
                input_payload=input_audit,
                error=err,
                duration_ms=duration_ms,
            )
            raise RuntimeError(err)

        data = response.json()
        choices = data.get("choices") or []
        raw = (choices[0].get("message") or {}).get("content") or ""
        parsed = _parse_openai_json(raw)
        items = parsed.get("items")
        resumo = parsed.get("resumo")
        if not isinstance(items, list):
            raise ValueError("Resposta sem lista 'items'")
        if not isinstance(resumo, dict):
            resumo = {
                "total_items": len(items),
                "valor_total": sum(float(i.get("valor_total") or 0) for i in items if isinstance(i, dict)),
                "confianca": 0.75,
                "metodo": "openai_gpt4o",
            }

        log_ai_exchange(
            operation="process_selected_table",
            provider="openai",
            model=OPENAI_ORCAMENTO_MODEL,
            input_payload=input_audit,
            output_payload={
                "items_count": len(items),
                "resumo": resumo,
                "raw_chars": len(raw),
            },
            duration_ms=duration_ms,
        )
        return {"items": items, "resumo": resumo}, f"openai:{OPENAI_ORCAMENTO_MODEL}"

    except (httpx.HTTPError, json.JSONDecodeError, ValueError, KeyError, RuntimeError) as exc:
        duration_ms = (time.perf_counter() - t0) * 1000
        log_ai_exchange(
            operation="process_selected_table",
            provider="openai",
            model=OPENAI_ORCAMENTO_MODEL,
            input_payload=input_audit,
            error=str(exc)[:1200],
            duration_ms=duration_ms,
        )
        raise

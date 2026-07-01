from typing import Any

from pydantic import BaseModel, Field


class ExportXlsxRequest(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list)
    modelos_selecionados: dict[str, bool] | None = None
    nome_projeto: str | None = None
    template: str = "novacap"
    colunas: list[str] | None = None
    compare_ids: list[str] | None = None

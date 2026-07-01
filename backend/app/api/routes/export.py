import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.api.deps import get_current_user_id
from app.config import TEMP_DIR
from app.domain.schemas.export import ExportXlsxRequest
from services.xlsx_export import save_export_workbook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export-xlsx")
async def export_xlsx(
    payload: ExportXlsxRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Gera XLSX com abas conforme modelos selecionados (Curva ABC, Analítico, Sintético)."""
    del user_id  # reservado para comparativo multi-usuário no futuro

    items = payload.items or []
    if not items:
        raise HTTPException(status_code=400, detail="Nenhum item para exportar.")

    try:
        file_path, filename = save_export_workbook(
            items,
            payload.modelos_selecionados,
            TEMP_DIR,
            nome_projeto=payload.nome_projeto,
            template=payload.template or "novacap",
            colunas=payload.colunas,
            compare_budgets=None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("export-xlsx: falha ao gerar planilha")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar Excel: {exc}",
        ) from exc

    logger.info(
        "export-xlsx: %s (%s itens, modelos=%s)",
        filename,
        len(items),
        payload.modelos_selecionados,
    )

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

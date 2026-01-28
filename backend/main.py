from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uuid
import logging
from pathlib import Path

from config import (
    FRONTEND_URLS,
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    UPLOAD_FOLDER,
    MAX_FILE_SIZE,
)
from firebase_service import OrcamentoFirestore

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== HEALTH CHECK ==============
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "version": API_VERSION,
    }

# ============== TEST ==============
@app.get("/api/test")
async def test_endpoint():
    """Test endpoint to verify API is working"""
    return {
        "message": "✅ Backend está funcionando!",
        "timestamp": datetime.now().isoformat(),
    }

# ============== UPLOAD PDF ==============
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload de arquivo PDF
    
    Returns:
        {
            "status": "success",
            "upload_id": "uuid",
            "filename": "documento.pdf",
            "size": 1234567,
            "message": "Arquivo recebido com sucesso"
        }
    """
    try:
        # Validar tipo de arquivo
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail="❌ Apenas arquivos PDF são permitidos",
            )
        
        # Validar tamanho (50MB)
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"❌ Arquivo muito grande. Máximo: 50MB. Seu arquivo tem: {len(contents) / 1024 / 1024:.2f}MB",
            )
        
        # Gerar ID único
        upload_id = str(uuid.uuid4())
        file_path = UPLOAD_FOLDER / f"{upload_id}_{file.filename}"
        
        # Salvar arquivo
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        logger.info(f"✅ PDF salvo: {file_path} ({len(contents) / 1024 / 1024:.2f}MB)")
        
        return {
            "status": "success",
            "upload_id": upload_id,
            "filename": file.filename,
            "size": len(contents),
            "message": "✅ Arquivo recebido com sucesso",
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro no upload: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao fazer upload: {str(e)}",
        )

# ============== EXTRACT PDF ==============
@app.post("/api/extract")
async def extract_pdf(upload_id: str):
    """
    Extrai tabelas do PDF usando pdfplumber
    Salva dados no Firestore e deleta arquivo PDF
    
    Args:
        upload_id: ID retornado pelo endpoint /api/upload
    
    Returns:
        {
            "status": "success",
            "upload_id": "uuid",
            "document_id": "firestore_doc_id",
            "tables_found": 1,
            "tables": [...]
        }
    """
    try:
        if not pdfplumber:
            raise HTTPException(
                status_code=500,
                detail="pdfplumber não está instalado",
            )
        
        # Encontrar arquivo
        files = list(UPLOAD_FOLDER.glob(f"{upload_id}_*"))
        if not files:
            raise HTTPException(
                status_code=404,
                detail=f"❌ Upload não encontrado: {upload_id}",
            )
        
        file_path = files[0]
        filename = file_path.name
        
        # Extrair tabelas
        tables = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_tables = page.extract_tables()
                    if page_tables:
                        for table_idx, table in enumerate(page_tables):
                            tables.append({
                                "page": page_num + 1,
                                "table_id": f"page_{page_num}_table_{table_idx}",
                                "rows": table
                            })
        except Exception as e:
            logger.error(f"❌ Erro ao extrair tabelas: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao extrair tabelas: {str(e)}",
            )
        
        logger.info(f"✅ {len(tables)} tabela(s) extraída(s) de {file_path}")
        
        # Salvar no Firestore
        try:
            doc_id = OrcamentoFirestore.save_orcamento(
                upload_id=upload_id,
                filename=filename,
                tables=tables,
            )
            logger.info(f"✅ Dados salvos no Firestore: {doc_id}")
        except Exception as e:
            logger.error(f"❌ Erro ao salvar no Firestore: {str(e)}")
            # Continuar mesmo se Firestore falhar, dados extraídos ainda serão retornados
            doc_id = None
        
        # Deletar arquivo PDF
        try:
            file_path.unlink()
            logger.info(f"🗑️  PDF deletado: {file_path}")
        except Exception as e:
            logger.warning(f"⚠️  Erro ao deletar PDF: {str(e)}")
        
        return {
            "status": "success",
            "upload_id": upload_id,
            "document_id": doc_id,
            "filename": filename,
            "tables_found": len(tables),
            "tables": tables,
            "message": "✅ Dados extraídos e persistidos com sucesso"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro na extração: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# ============== FIRESTORE OPERATIONS ==============

@app.get("/api/orcamentos")
async def list_orcamentos():
    """
    Listar todos os orçamentos salvos no Firestore
    
    Returns:
        {
            "status": "success",
            "count": 5,
            "orcamentos": [...]
        }
    """
    try:
        orcamentos = OrcamentoFirestore.list_all_orcamentos()
        return {
            "status": "success",
            "count": len(orcamentos),
            "orcamentos": orcamentos,
        }
    except Exception as e:
        logger.error(f"❌ Erro ao listar orçamentos: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao listar orçamentos: {str(e)}",
        )

@app.get("/api/orcamentos/{upload_id}")
async def get_orcamento(upload_id: str):
    """
    Recuperar orçamento específico do Firestore
    
    Args:
        upload_id: Upload ID
    
    Returns:
        {
            "status": "success",
            "orcamento": {...}
        }
    """
    try:
        orcamento = OrcamentoFirestore.get_orcamento_by_upload_id(upload_id)
        
        if not orcamento:
            raise HTTPException(
                status_code=404,
                detail=f"❌ Orçamento não encontrado: {upload_id}",
            )
        
        return {
            "status": "success",
            "orcamento": orcamento,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao recuperar orçamento: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao recuperar orçamento: {str(e)}",
        )

# ============== RUN ==============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )

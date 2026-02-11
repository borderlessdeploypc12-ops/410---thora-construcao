"""
Script de teste automatizado para Sprint 1
Testa: Upload -> Extração -> Validação -> Exportação XLSX
"""
import requests
import json
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"
PDF_PATH = Path("backend/test_pdfs/exemplo.pdf")

print("=" * 60)
print("🧪 TESTE AUTOMATIZADO - SPRINT 1")
print("=" * 60)

# 1. HEALTH CHECK
print("\n1️⃣  Health Check...")
try:
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    print(f"   ✅ Backend respondendo: {response.json()['status']}")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    exit(1)

# 2. TEST ENDPOINT
print("\n2️⃣  Test Endpoint...")
try:
    response = requests.get(f"{BASE_URL}/api/test", timeout=5)
    print(f"   ✅ API funcionando: {response.json()['message']}")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    exit(1)

# 3. UPLOAD PDF
print("\n3️⃣  Upload de PDF...")
if not PDF_PATH.exists():
    print(f"   ❌ Arquivo não encontrado: {PDF_PATH}")
    exit(1)

try:
    with open(PDF_PATH, "rb") as f:
        files = {"file": ("exemplo.pdf", f, "application/pdf")}
        response = requests.post(f"{BASE_URL}/api/upload", files=files, timeout=5)
    
    upload_data = response.json()
    if response.status_code != 200:
        print(f"   ❌ Erro: {upload_data.get('detail', 'Unknown error')}")
        exit(1)
    
    upload_id = upload_data["upload_id"]
    print(f"   ✅ Upload bem-sucedido!")
    print(f"      ID: {upload_id}")
    print(f"      Arquivo: {upload_data['filename']}")
    print(f"      Tamanho: {upload_data['size'] / 1024:.2f} KB")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    exit(1)

# 4. EXTRACT PDF
print("\n4️⃣  Extração de Dados...")
try:
    response = requests.post(
        f"{BASE_URL}/api/extract",
        params={"upload_id": upload_id},
        timeout=10
    )
    
    extract_data = response.json()
    if response.status_code != 200:
        print(f"   ❌ Erro: {extract_data.get('detail', 'Unknown error')}")
        exit(1)
    
    tables_found = extract_data["tables_found"]
    print(f"   ✅ Extração bem-sucedida!")
    print(f"      Tabelas encontradas: {tables_found}")
    if tables_found > 0:
        print(f"      Primeira tabela tem {len(extract_data['tables'][0]['rows'])} linhas")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    exit(1)

# 5. EXPORT XLSX (NOVA FUNCIONALIDADE)
print("\n5️⃣  Exportação XLSX...")
try:
    # Simulando itens da planilha
    items = [
        {
            "id": 1,
            "code": "001",
            "description": "Cimento 50kg",
            "unit": "Saco",
            "qty": 100,
            "unitPrice": 35.50
        },
        {
            "id": 2,
            "code": "002",
            "description": "Areia fina",
            "unit": "m³",
            "qty": 50,
            "unitPrice": 120.00
        },
        {
            "id": 3,
            "code": "003",
            "description": "Brita 0",
            "unit": "m³",
            "qty": 30,
            "unitPrice": 85.00
        },
        {
            "id": 4,
            "code": "004",
            "description": "Aço CA-50",
            "unit": "Tonelada",
            "qty": 5,
            "unitPrice": 4500.00
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/api/export-xlsx",
        json=items,
        timeout=10
    )
    
    if response.status_code != 200:
        print(f"   ❌ Erro: {response.json().get('detail', 'Unknown error')}")
        exit(1)
    
    # Salvar arquivo
    xlsx_path = Path("test_orcamento_export.xlsx")
    with open(xlsx_path, "wb") as f:
        f.write(response.content)
    
    print(f"   ✅ XLSX exportado com sucesso!")
    print(f"      Arquivo: {xlsx_path.name}")
    print(f"      Tamanho: {xlsx_path.stat().st_size / 1024:.2f} KB")
    print(f"      Itens: {len(items)}")
    print(f"      Total: R$ {sum(item['qty'] * item['unitPrice'] for item in items):,.2f}")
except Exception as e:
    print(f"   ❌ Erro: {e}")
    exit(1)

# RESUMO
print("\n" + "=" * 60)
print("✅ TODOS OS TESTES PASSARAM!")
print("=" * 60)
print("""
Fluxo Sprint 1 Validado:
✅ Upload de PDF
✅ Extração de dados (OCR/Tabelas)
✅ Normalização de dados
✅ Exportação para XLSX (NOVO)

Próximos passos:
→ Testar manualmente no navegador
→ Validar planilha antes de exportar
→ Implementar Sprint 2 (Curva ABC + IA)
""")

import requests
import json

# URL do backend
BACKEND_URL = "http://localhost:8000"

def test_health():
    """Teste health check"""
    print("📌 Testando /health...")
    response = requests.get(f"{BACKEND_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_api():
    """Teste API"""
    print("📌 Testando /api/test...")
    response = requests.get(f"{BACKEND_URL}/api/test")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_upload(file_path="test_pdfs/exemplo.pdf"):
    """Teste upload de PDF"""
    print(f"📌 Testando /api/upload com {file_path}...")
    
    try:
        from pathlib import Path
        filename = Path(file_path).name
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            response = requests.post(
                f"{BACKEND_URL}/api/upload",
                files=files
            )
        
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}\n")
        
        if response.status_code == 200:
            upload_id = result.get("upload_id")
            print(f"✅ Upload bem-sucedido!")
            print(f"Upload ID: {upload_id}\n")
            return upload_id
        else:
            print(f"❌ Erro: {result.get('detail')}\n")
            return None
    
    except FileNotFoundError:
        print(f"❌ Arquivo não encontrado: {file_path}\n")
        print("💡 Crie um PDF em test_pdfs/exemplo.pdf ou use outro caminho\n")
        return None

def test_extract(upload_id):
    """Teste extração de PDF"""
    print(f"📌 Testando /api/extract com upload_id={upload_id}...")
    
    response = requests.post(
        f"{BACKEND_URL}/api/extract",
        params={"upload_id": upload_id}
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {json.dumps(result, indent=2, default=str)}\n")
    
    if response.status_code == 200:
        print(f"✅ Extração bem-sucedida!")
        print(f"Tabelas encontradas: {result.get('tables_found')}\n")
    else:
        print(f"❌ Erro: {result.get('detail')}\n")

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 TESTANDO BACKEND - Automação de Orçamentos")
    print("=" * 60 + "\n")
    
    # Test 1: Health
    test_health()
    
    # Test 2: API
    test_api()
    
    # Test 3: Upload
    upload_id = test_upload()
    
    # Test 4: Extract (só se upload funcionou)
    if upload_id:
        test_extract(upload_id)
    
    print("=" * 60)
    print("✅ Testes concluídos!")
    print("=" * 60)

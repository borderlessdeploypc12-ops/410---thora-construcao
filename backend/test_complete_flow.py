"""
Script de teste completo do fluxo de upload e extração
Testa com PDF real e valida todos os endpoints
"""

import requests
import json
from pathlib import Path
import time

BASE_URL = "http://localhost:8000"

def test_health():
    """Testa se o backend está online"""
    print("\n" + "="*60)
    print("🏥 TESTE 1: Health Check")
    print("="*60)
    
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    print("✅ Backend está online!")
    return True

def test_upload(pdf_path):
    """Testa upload de PDF"""
    print("\n" + "="*60)
    print("📤 TESTE 2: Upload de PDF")
    print("="*60)
    
    if not Path(pdf_path).exists():
        print(f"❌ Arquivo não encontrado: {pdf_path}")
        return None
    
    print(f"Enviando: {pdf_path}")
    print(f"Tamanho: {Path(pdf_path).stat().st_size / 1024 / 1024:.2f} MB")
    
    with open(pdf_path, 'rb') as f:
        files = {'file': (Path(pdf_path).name, f, 'application/pdf')}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Upload ID: {data['upload_id']}")
        print(f"Filename: {data['filename']}")
        print(f"Size: {data['size'] / 1024 / 1024:.2f} MB")
        print("✅ Upload bem-sucedido!")
        return data['upload_id']
    else:
        print(f"❌ Erro: {response.text}")
        return None

def test_extract(upload_id):
    """Testa extração de dados do PDF"""
    print("\n" + "="*60)
    print("🔍 TESTE 3: Extração de Dados")
    print("="*60)
    
    print(f"Extraindo dados do upload: {upload_id}")
    print("Aguarde... isso pode levar alguns segundos...")
    
    start_time = time.time()
    response = requests.post(
        f"{BASE_URL}/api/extract",
        params={'upload_id': upload_id},
        timeout=300  # 5 minutos timeout
    )
    elapsed = time.time() - start_time
    
    print(f"Tempo de extração: {elapsed:.1f}s")
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n📊 RESULTADOS DA EXTRAÇÃO:")
        print(f"  • Tabelas encontradas: {data.get('tables_found', 0)}")
        print(f"  • Items extraídos: {data.get('items_found', 0)}")
        
        if 'resumo' in data:
            resumo = data['resumo']
            print(f"\n💰 RESUMO FINANCEIRO:")
            print(f"  • Total de itens: {resumo.get('total_items', 0)}")
            print(f"  • Valor total: R$ {resumo.get('valor_total', 0):,.2f}")
            print(f"  • Confiança: {resumo.get('confianca', 0):.1%}")
            print(f"  • Método: {resumo.get('metodo', 'N/A')}")
        
        if 'items' in data and data['items']:
            print(f"\n📋 PRIMEIROS 5 ITENS:")
            for i, item in enumerate(data['items'][:5], 1):
                print(f"\n  {i}. {item.get('descricao', 'N/A')[:60]}")
                print(f"     Qtd: {item.get('quantidade', 0)} {item.get('unidade', 'un')}")
                print(f"     Valor Unit.: R$ {item.get('valor_unitario', 0):,.2f}")
                print(f"     Valor Total: R$ {item.get('valor_total', 0):,.2f}")
        
        print("\n✅ Extração bem-sucedida!")
        
        # Salvar resultado em arquivo JSON
        output_file = 'test_extraction_result.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Resultado salvo em: {output_file}")
        
        return data
    else:
        print(f"❌ Erro na extração: {response.text}")
        return None

def test_curva_abc(upload_id):
    """Testa endpoint de Curva ABC"""
    print("\n" + "="*60)
    print("📈 TESTE 4: Curva ABC")
    print("="*60)
    
    print(f"Buscando análise ABC do upload: {upload_id}")
    
    response = requests.get(f"{BASE_URL}/api/curva-abc/{upload_id}")
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        items = data.get('items', [])
        summary = data.get('summary', {})
        
        print(f"\n📊 ANÁLISE CURVA ABC:")
        print(f"  • Total de itens: {summary.get('total', 0)}")
        print(f"  • Classe A: {summary.get('countA', 0)} itens ({summary.get('percentA', 0)}% do valor)")
        print(f"  • Classe B: {summary.get('countB', 0)} itens ({summary.get('percentB', 0)}% do valor)")
        print(f"  • Classe C: {summary.get('countC', 0)} itens ({summary.get('percentC', 0)}% do valor)")
        print(f"  • Valor Total: R$ {summary.get('total', 0):,.2f}")
        
        print("\n✅ Curva ABC calculado!")
        return data
    else:
        print(f"⚠️  Curva ABC não disponível: {response.text}")
        return None

def main():
    """Executa todos os testes"""
    print("\n" + "="*70)
    print("🚀 TESTE COMPLETO DO SISTEMA DE ORÇAMENTOS")
    print("="*70)
    
    try:
        # 1. Health check
        test_health()
        
        # 2. Upload PDF (usar o PDF fornecido)
        pdf_path = r"C:\Users\lucas\Downloads\Planilha Orçamentária Referencial - Sem Desoneração.pdf"
        upload_id = test_upload(pdf_path)
        
        if not upload_id:
            print("\n❌ Teste falhou no upload. Abortando...")
            return
        
        # 3. Extração
        extract_data = test_extract(upload_id)
        
        if not extract_data:
            print("\n❌ Teste falhou na extração. Abortando...")
            return
        
        # 4. Curva ABC
        test_curva_abc(upload_id)
        
        print("\n" + "="*70)
        print("✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ ERRO DURANTE OS TESTES: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

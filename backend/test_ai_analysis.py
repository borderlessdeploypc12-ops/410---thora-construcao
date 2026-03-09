#!/usr/bin/env python3
"""
Script de teste para análise de PDF com IA
Testa:
1. Upload de PDF
2. Extração de tabelas
3. Análise com Gemini
"""

import requests
import json
from pathlib import Path
import time

API_URL = "http://localhost:8000"
PDF_PATH = Path(r"C:\Users\lucas\Downloads\Planilha Orçamentária Referencial - Sem Desoneração.pdf")

def test_workflow():
    print("=" * 60)
    print("🚀 TESTE: Upload + Extração + Análise com IA")
    print("=" * 60)
    
    # 1. UPLOAD
    print("\n1️⃣  UPLOAD de PDF...")
    if not PDF_PATH.exists():
        print(f"❌ PDF não encontrado: {PDF_PATH}")
        return
    
    with open(PDF_PATH, "rb") as f:
        files = {"file": (PDF_PATH.name, f, "application/pdf")}
        response = requests.post(f"{API_URL}/api/upload", files=files)
    
    if response.status_code != 200:
        print(f"❌ Erro no upload: {response.text}")
        return
    
    upload_data = response.json()
    upload_id = upload_data["upload_id"]
    print(f"✅ Upload bem-sucedido!")
    print(f"   Upload ID: {upload_id}")
    print(f"   Tamanho: {upload_data['size'] / 1024 / 1024:.2f} MB")
    
    # 2. EXTRAÇÃO
    print(f"\n2️⃣  EXTRAÇÃO de tabelas...")
    response = requests.post(f"{API_URL}/api/extract?upload_id={upload_id}")
    
    if response.status_code != 200:
        print(f"❌ Erro na extração: {response.text}")
        return
    
    extract_data = response.json()
    tables_found = extract_data.get("tables_found", 0)
    print(f"✅ Extração concluída!")
    print(f"   Tabelas encontradas: {tables_found}")
    
    if tables_found > 0:
        first_table = extract_data["tables"][0]
        print(f"   Primeira tabela:")
        print(f"     - Página: {first_table.get('page')}")
        print(f"     - Linhas: {len(first_table.get('rows', []))}")
        print(f"     - Colunas: {first_table.get('columns')}")
    
    # 3. ANÁLISE COM IA
    print(f"\n3️⃣  ANÁLISE com IA (Gemini)...")
    time.sleep(1)  # Pequena pausa
    
    analyze_payload = {
        "upload_id": upload_id,
        "focus": "all"
    }
    
    response = requests.post(
        f"{API_URL}/api/analyze-with-ai",
        json=analyze_payload
    )
    
    if response.status_code != 200:
        print(f"❌ Erro na análise: {response.status_code}")
        print(f"   {response.text}")
        return
    
    analysis = response.json()
    print(f"✅ Análise com IA concluída!")
    
    # Mostrar resultados
    analysis_data = analysis.get("analysis", {})
    structure = analysis_data.get("structure", {})
    items = analysis_data.get("items", [])
    summary = analysis_data.get("summary", {})
    
    print(f"\n📊 RESULTADOS DA ANÁLISE:")
    print(f"\n  Estrutura reconhecida:")
    print(f"    - Coluna descrição: {structure.get('coluna_descricao', '?')}")
    print(f"    - Coluna quantidade: {structure.get('coluna_quantidade', '?')}")
    print(f"    - Coluna unidade: {structure.get('coluna_unidade', '?')}")
    print(f"    - Coluna valor unitário: {structure.get('coluna_valor_unitario', '?')}")
    print(f"    - Confiança: {structure.get('confianca', 0)*100:.1f}%")
    
    print(f"\n  Itens reconhecidos: {len(items)}")
    if items:
        print(f"\n  Primeiros 5 itens:")
        for i, item in enumerate(items[:5], 1):
            print(f"    {i}. {item.get('descricao', 'N/A')[:50]}")
            print(f"       Qtd: {item.get('quantidade', 0)} {item.get('unidade', '?')}")
            print(f"       Valor: R$ {item.get('valor_total', 0):,.2f}")
    
    print(f"\n  Resumo:")
    print(f"    - Total de itens: {summary.get('total_items', 0)}")
    print(f"    - Valor total: R$ {summary.get('valor_total', 0):,.2f}")
    print(f"    - Confiança da análise: {summary.get('confianca_analise', 0)*100:.1f}%")
    
    if summary.get('avisos'):
        print(f"\n  ⚠️  Avisos:")
        for aviso in summary['avisos'][:3]:
            print(f"     - {aviso}")
    
    print("\n" + "=" * 60)
    print("✅ TESTE CONCLUÍDO COM SUCESSO!")
    print("=" * 60)

if __name__ == "__main__":
    test_workflow()

#!/usr/bin/env pwsh
# Script simplificado para instalar e rodar tudo

Set-Location "c:\Borderless\410\410---thora-construcao\backend"

Write-Host "Instalando dependencias..." -ForegroundColor Yellow

# Instalar apenas essenciais
python -m pip install --upgrade pip -q
python -m pip install fastapi uvicorn pdfplumber openpyxl firebase-admin python-multipart requests -q

Write-Host "OK - Dependencias instaladas" -ForegroundColor Green

# Rodar
python main.py

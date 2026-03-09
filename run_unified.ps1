#!/usr/bin/env pwsh

# Script para rodar Frontend + Backend na mesma porta (8000)
# Windows PowerShell

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 Thora Construction - Unified Server" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Mudar para o diretório do script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommandPath
Set-Location $ScriptDir

# Python da venv do workspace
$PythonExe = Join-Path $ScriptDir "..\.venv\Scripts\python.exe"
if (!(Test-Path $PythonExe)) {
    Write-Host "❌ Python da venv não encontrado em $PythonExe" -ForegroundColor Red
    exit 1
}

# Step 1: Verificar se frontend foi buildado
if (!(Test-Path "frontend\dist")) {
    Write-Host "[1/3] 📦 Building frontend..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build
    Pop-Location
    Write-Host "✅ Frontend buildado!" -ForegroundColor Green
} else {
    Write-Host "[1/3] ✅ Frontend já está buildado" -ForegroundColor Green
}

Write-Host ""

# Step 2: Verificar e instalar dependências do backend
Write-Host "[2/3] 🔧 Preparando backend..." -ForegroundColor Yellow
Push-Location backend

# Verificar se FastAPI está instalado
$fastapi_test = & $PythonExe -c "import fastapi" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Instalando dependências..." -ForegroundColor Yellow
    & $PythonExe -m pip install -q -r requirements.txt
    Write-Host "  ✅ Dependências instaladas!" -ForegroundColor Green
} else {
    Write-Host "  ✅ Dependências já estão instaladas" -ForegroundColor Green
}

Pop-Location

Write-Host ""

# Step 3: Rodar backend
Write-Host "[3/3] 🚀 Iniciando servidor unificado..." -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✨ Servidor rodando em: http://localhost:8000" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Push-Location backend
& $PythonExe main.py
Pop-Location

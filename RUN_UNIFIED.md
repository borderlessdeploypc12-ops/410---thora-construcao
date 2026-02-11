# 🚀 Rodar Frontend + Backend na Mesma Porta (8000)

## Configuração

O projeto foi configurado para servir **frontend e backend na mesma porta 8000**.

### Como Funciona

1. **Frontend buildado** → Arquivos em `frontend/dist`
2. **Backend serve tudo** → FastAPI serve arquivos estáticos do frontend (dist) + APIs

### Requisitos

- Python 3.8+
- Node.js 16+
- npm

## Passo 1: Buildarcfrontend (se não fazer ainda)

```bash
cd frontend
npm install
npm run build
```

Isso cria a pasta `frontend/dist` com o frontend otimizado.

## Passo 2: Instalar Dependências do Backend

```bash
cd backend
pip install -r requirements.txt
```

## Passo 3: Rodar Backend = Frontend + API

```bash
cd backend
python main.py
```

## ✅ Pronto!

Acesse a aplicação em: **http://localhost:8000**

---

## Estrutura de Roteamento

```
http://localhost:8000/
├── / (GET)              → Serve index.html (Frontend)
├── /assets/             → Serve assets do frontend (CSS, JS)
├── /api/upload          → Upload de PDF (API Backend)
├── /api/extract         → Extração de dados (API Backend)
├── /api/export-xlsx     → Exportação XLSX (API Backend)
├── /health              → Health check (API Backend)
└── /* (fallback)        → Serve index.html para rotas do  SPA
```

---

## Mudanças Implementadas

### API URL Dinâmica
- **Desenvolvimento** (`npm run dev`): API em `localhost:8000`
- **Produção** (build+backend): API na mesma origem

Arquivo: `frontend/src/services/api.ts`

### Backend Serve Estáticos
- **Novo**: FastAPI agora monta arquivos em `/assets`
- **Novo**: Fallback para `index.html` (SPA routing)

Arquivo: `backend/main.py`

---

## Troubleshooting

### Porta 8000 em uso?

```powershell
# Matar processos Python/Node
Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*"} | Stop-Process -Force
```

### Frontend não carrega?

1. Verifique se `frontend/dist` existe
2. Rode `npm run build` novamente
3. Reinicie o backend

### CSS/JS não carregam?

1. Abra DevTools (F12)
2. Verifique a aba Network
3. Confirme se `/assets/` está retornando 200 OK

---

## Um Click Deploy

Para ambientes de produção (Render, Heroku, etc):

```bash
# 1. Buildarcfrontend
cd frontend && npm run build

# 2. Backend já será servido na porta definida
cd backend && python main.py
```

O backend automaticamente servará o frontend se a pasta `dist` existir.

---

## Próximas Etapas

- [ ] Implementar Sprint 2 (Curva ABC + IA)
- [ ] Melhorar chunk size do frontend (code splitting)
- [ ] Adicionar service worker para PWA
- [ ] Configurar cache com headers HTTP

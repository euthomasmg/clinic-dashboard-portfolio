# Clinic Dashboard Portfolio

Projeto de portfolio com um dashboard para clinicas, separado em front-end e back-end.

## Estrutura
- `front-end/`: app Next.js (React) com a interface do dashboard.
- `back-end/`: API FastAPI (Python) com modelos, rotas e integracoes.

## Como rodar

### Front-end
```bash
cd front-end
npm install
npm run dev
```
Acesse http://localhost:3000.

### Back-end
```bash
cd back-end
python -m uvicorn app.main:app --reload
```
Docs da API: http://127.0.0.1:8000/docs

## Notas
- Ajuste variaveis em `back-end/.env.local` se necessario.

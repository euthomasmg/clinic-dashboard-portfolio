python -m uvicorn app.main:app --reload //rodar no terminal na pasta raiz do projeto

http://127.0.0.1:8000/docs

# Setup

1. Criar ambiente virtual

Windows (bash):
```bash
python -m venv venv

source venv/Scripts/activate

pip install -r requirements.txt

no terminal e dentro da pasta back-end
uvicorn app.main:app --reload 

database.py = como conectar.

models.py = o que existe no banco (tabelas).

schemas.py = o que a API recebe/entrega.

auth.py = como lidar com segurança (senhas, tokens).

main.py = rotas que juntam tudo e expõem para o mundo.
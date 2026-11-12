# front-end

amigas, pra subir o front e testar com o back façam isso:

## 1. instalar

precisa do Node 20.19 ou mais novo (`node -v` pra ver qual vocês têm).

```bash
git clone https://github.com/leticiajuvencio/automacaocontabil.git
cd automacaocontabil
git checkout front-end
cd front-end
npm install
```

o `git checkout front-end` é só enquanto o PR não entrou na main.

## 2. rodar só o front (sem back)

no arquivo `.env` deixa assim:

```
VITE_MODO_DEMO=true
```

e roda:

```bash
npm run dev
```

abre em http://localhost:5173 e entra com `admin@frasson.com.br` / senha `frasson`.
nesse modo os dados são de exemplo e ficam salvos só no navegador de vocês.
pra voltar pros dados do começo: F12 > Application > Local Storage > apaga o `automacao-contabil:demo`.

## 3. testar com o back

1. sobe o back na porta 3333
2. no `.env` troca pra `VITE_MODO_DEMO=false`
3. para o front (ctrl + c) e roda `npm run dev` de novo

o Vite repassa tudo que começa com `/api` pro back em http://localhost:3333, então as rotas do back têm que começar com `/api` (tipo `POST /api/auth/login`). não precisa configurar CORS.
se o back estiver em outra porta, troca no `vite.config.ts`.

pra conseguir entrar, o usuário tem que existir na tabela `usuarios_sistema`.

## o que o back precisa responder

- `src/api/consultas.ts`: todas as rotas que o front chama
- `src/api/tipos.ts`: o formato de cada resposta
- `src/mocks/handlers.ts`: um exemplo de resposta pra cada rota (é o que o modo demo usa)
- `docs/banco-sugestao.sql`: o que falta no banco pra guardar contas, regras e o vínculo com o Domínio

o PDF é lido no próprio front, então o back só recebe o arquivo e as linhas já lidas e guarda no banco.

## deu erro?

- erro 500 ou "Não foi possível falar com o servidor": o back não tá rodando na 3333
- voltou sozinho pra tela de login: o back respondeu 401 (token inválido ou vencido)
- mudou o `.env` e nada aconteceu: para e roda o `npm run dev` de novo

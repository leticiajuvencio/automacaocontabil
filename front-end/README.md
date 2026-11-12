
amigas, pra subir o front e testar com o back façam isso:

## instalar

precisa do Node 20.19 ou mais novo (`node -v` pra ver qual vocês tem)

```bash
git clone https://github.com/leticiajuvencio/automacaocontabil.git
cd automacaocontabil
git checkout front-end
cd front-end
npm install
```

o `git checkout front-end` é só enquanto o PR não entrou na main.

## rodar só o front 

no arquivo `.env` deixa assim:

```
VITE_MODO_DEMO=true
```

e roda:

```bash
npm run dev
```

abre em http://localhost:5173 e entra com admin@frasson.com.br / senha frasson
nesse modo os dados são de exemplo e ficam salvos só no navegador de vocês.
pra voltar pros dados do começo: F12 > Application > Local Storage > apaga o: automacao-contabil:demo.

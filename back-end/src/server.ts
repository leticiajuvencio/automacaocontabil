import { mkdirSync } from 'node:fs'
import { criarApp } from './app.js'
import { env } from './env.js'

// cria a pasta dos PDFs, se ainda não existir
mkdirSync(env.UPLOAD_DIR, { recursive: true })

criarApp().listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT}/api`)
})

import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import { env } from './env.js'
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js'

// mensagens de validação do zod em português
z.config(z.locales.pt())

// Monta o Express (separado do server.ts para dar para testar sem abrir porta)
export function criarApp() {
  const app = express()

  app.use(helmet()) // cabeçalhos de segurança
  app.use(cors({ origin: env.CORS_ORIGIN }))
  // a revisão manda todos os lançamentos de uma vez, por isso o limite maior
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use(rotaNaoEncontrada)
  app.use(tratarErros)

  return app
}

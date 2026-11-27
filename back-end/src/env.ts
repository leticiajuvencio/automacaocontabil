import 'dotenv/config'
import { z } from 'zod'

// Lê o .env e confere se está tudo certo antes de subir a API
const schema = z.object({
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().default(15),
  // API do Domínio. Sem o client ID e o secret, a tela do Domínio avisa que falta configurar.
  DOMINIO_CLIENT_ID: z.string().default(''),
  DOMINIO_CLIENT_SECRET: z.string().default(''),
  DOMINIO_AMBIENTE: z.enum(['homologacao', 'producao']).default('homologacao'),
})

const resultado = schema.safeParse(process.env)
if (!resultado.success) {
  console.error('Erro no arquivo .env:', resultado.error.issues.map((i) => `${i.path} - ${i.message}`))
  process.exit(1)
}

export const env = resultado.data

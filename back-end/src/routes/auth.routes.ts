import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError } from '../lib/httpError.js'
import { gerarToken } from '../middlewares/auth.js'

export const authRoutes = Router()

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

// POST /api/auth/login -> confere e-mail e senha e devolve o token
authRoutes.post('/login', async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body)

  const usuario = await prisma.usuarioSistema.findUnique({ where: { email } })
  // a senha está salva como hash, então quem compara é o bcrypt
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
    throw new HttpError(401, 'E-mail ou senha incorretos.')
  }

  res.json({
    token: gerarToken(usuario.id),
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      admin: usuario.admin,
      dataCadastro: usuario.dataCadastro.toISOString(),
    },
  })
})

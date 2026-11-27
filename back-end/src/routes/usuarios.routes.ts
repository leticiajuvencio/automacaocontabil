import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { HttpError } from '../lib/httpError.js'
import { usuarioPublico } from '../lib/respostas.js'
import { idParam } from '../lib/validacao.js'

// Só administradores chegam aqui (exigirAdmin no app.ts)
export const usuariosRoutes = Router()

const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(100, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(150, 'E-mail muito longo.'),
  senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(72, 'Senha longa demais.'),
  admin: z.boolean(),
})

// GET /api/usuarios -> quem pode entrar no sistema
usuariosRoutes.get('/', async (_req, res) => {
  const usuarios = await prisma.usuarioSistema.findMany({ select: usuarioPublico, orderBy: { nome: 'asc' } })
  res.json(usuarios)
})

// POST /api/usuarios -> cadastra com uma senha provisória
usuariosRoutes.post('/', async (req, res) => {
  const dados = novoUsuarioSchema.parse(req.body)

  const jaExiste = await prisma.usuarioSistema.findUnique({ where: { email: dados.email } })
  if (jaExiste) throw new HttpError(409, 'Já existe um usuário com este e-mail.')

  // no banco vai só o hash da senha
  const usuario = await prisma.usuarioSistema.create({
    data: { ...dados, senha: await bcrypt.hash(dados.senha, 10) },
    select: usuarioPublico,
  })
  res.status(201).json(usuario)
})

// DELETE /api/usuarios/:id -> tira o acesso
usuariosRoutes.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  if (id === req.usuario!.id) throw new HttpError(409, 'Você não pode excluir o próprio usuário.')

  const usuario = await prisma.usuarioSistema.findUnique({
    where: { id },
    include: { _count: { select: { arquivos: true } } },
  })
  if (!usuario) throw new HttpError(404, 'Usuário não encontrado.')
  // os extratos guardam quem enviou, então quem já enviou fica no histórico
  if (usuario._count.arquivos > 0) throw new HttpError(409, 'Este usuário já enviou extratos e não pode ser excluído.')

  await prisma.usuarioSistema.delete({ where: { id } })
  res.status(204).end()
})

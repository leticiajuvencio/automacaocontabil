import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { HttpError } from '../lib/httpError.js'

// Coloca no Request quem está logado
declare global {
  namespace Express {
    interface Request {
      usuario?: { id: number; nome: string; admin: boolean }
    }
  }
}

// Cria o token de login (vale por 8 horas, um dia de trabalho)
export function gerarToken(usuarioId: number): string {
  return jwt.sign({}, env.JWT_SECRET, { subject: String(usuarioId), expiresIn: '8h' })
}

// Middleware: só deixa passar quem mandou um token válido no cabeçalho
export async function exigirLogin(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) throw new HttpError(401, 'Faça login para continuar.')

  let usuarioId: number
  try {
    const dados = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload
    usuarioId = Number(dados.sub)
  } catch {
    throw new HttpError(401, 'Sessão expirada. Entre de novo.')
  }
  if (!Number.isInteger(usuarioId)) throw new HttpError(401, 'Sessão expirada. Entre de novo.')

  // o usuário pode ter sido excluído depois de fazer login
  const usuario = await prisma.usuarioSistema.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, admin: true },
  })
  if (!usuario) throw new HttpError(401, 'Sessão expirada. Entre de novo.')

  req.usuario = usuario
  next()
}

// Middleware: só administrador passa (vem depois do exigirLogin)
export function exigirAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario?.admin) throw new HttpError(403, 'Só administradores podem fazer isso.')
  next()
}

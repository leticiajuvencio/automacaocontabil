import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ZodError } from 'zod'
import { env } from '../env.js'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../lib/httpError.js'

// Quando nenhuma rota respondeu
export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: 'Rota não encontrada.' })
}

// Todo erro das rotas cai aqui e vira { erro: "mensagem" }, que é o que o front mostra
export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction) {
  // erros que nós mesmas lançamos (404, 409...)
  if (erro instanceof HttpError) {
    res.status(erro.status).json({ erro: erro.message })
    return
  }

  // dados que não passaram na validação do zod
  if (erro instanceof ZodError) {
    res.status(400).json({ erro: erro.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  // problemas no envio de arquivos (PDF do extrato ou XML das notas)
  if (erro instanceof multer.MulterError) {
    if (erro.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ erro: `O arquivo passa do limite de ${env.UPLOAD_MAX_MB} MB.` })
    } else if (erro.code === 'LIMIT_FIELD_VALUE') {
      res.status(413).json({ erro: 'Os dados enviados são grandes demais.' })
    } else if (erro.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ erro: 'Arquivos demais de uma vez.' })
    } else {
      res.status(400).json({ erro: 'Arquivo enviado no campo errado.' })
    }
    return
  }

  // JSON quebrado ou grande demais no corpo da requisição
  if (erro instanceof Error && 'type' in erro) {
    if (erro.type === 'entity.parse.failed') {
      res.status(400).json({ erro: 'Os dados enviados não estão em JSON válido.' })
      return
    }
    if (erro.type === 'entity.too.large') {
      res.status(413).json({ erro: 'Os dados enviados são grandes demais.' })
      return
    }
  }

  // valor repetido numa coluna UNIQUE (ex.: e-mail ou CNPJ)
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
    res.status(409).json({ erro: 'Já existe um cadastro com esses dados.' })
    return
  }

  // qualquer outro erro: mostra no terminal e responde 500
  console.error(erro)
  res.status(500).json({ erro: 'Erro interno. Tente de novo em instantes.' })
}

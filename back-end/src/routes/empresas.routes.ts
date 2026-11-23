import { unlink } from 'node:fs/promises'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { cnpjValido, formatarCnpj } from '../lib/cnpj.js'
import { HttpError } from '../lib/httpError.js'
import { empresaParaApi, incluirEmpresa } from '../lib/respostas.js'
import { idParam, texto } from '../lib/validacao.js'

export const empresasRoutes = Router()

const contaSchema = z.object({
  banco: texto(60),
  agencia: texto(20),
  conta: texto(30),
  codigo: texto(20),
})

const regraSchema = z.object({
  termo: texto(100),
  descricao: texto(150),
  conta: texto(20),
  historico: texto(20),
})

// opções do TXT e do Excel (OpcoesArquivo do front)
const opcoesSchema = z.object({
  separador: z.enum([';', '|', 'tab']),
  codificacao: z.enum(['ansi', 'utf8']),
  iniciaLote: z.enum(['cada', 'vazio']),
  filial: texto(20),
  centroCustoDebito: texto(20),
  centroCustoCredito: texto(20),
  cabecalho: z.boolean(),
  semAcentos: z.boolean(),
  maiusculas: z.boolean(),
  documentoNoComplemento: z.boolean(),
  abaImportacao: z.boolean(),
  abaExtrato: z.boolean(),
  abaResumo: z.boolean(),
})

const empresaSchema = z.object({
  razaoSocial: z.string().trim().min(1, 'Informe a razão social.').max(150, 'Razão social muito longa.'),
  // vem com ou sem máscara; vazio vira null e o resto é salvo como 00.000.000/0000-00
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === '' || cnpjValido(v), 'CNPJ inválido.')
    .transform((v) => (v === '' ? null : formatarCnpj(v))),
  codigoDominio: texto(20),
  contaEntrada: texto(20),
  historicoEntrada: texto(20),
  contaSaida: texto(20),
  historicoSaida: texto(20),
  rendeFacil: z.enum(['ignorar', 'contabilizar']),
  contaAplicacao: texto(20),
  contas: z.array(contaSchema).max(50),
  regras: z.array(regraSchema).max(500),
  opcoes: opcoesSchema,
})

async function buscarEmpresa(id: number) {
  const empresa = await prisma.empresaCliente.findUnique({ where: { id }, include: incluirEmpresa })
  if (!empresa) throw new HttpError(404, 'Empresa não encontrada.')
  return empresa
}

// Não deixa duas empresas com o mesmo CNPJ
async function conferirCnpjRepetido(cnpj: string | null, idAtual?: number) {
  if (!cnpj) return
  const outra = await prisma.empresaCliente.findUnique({ where: { cnpj } })
  if (outra && outra.id !== idAtual) throw new HttpError(409, `Já existe uma empresa com esse CNPJ (${outra.razaoSocial}).`)
}

// a regra guarda a posição dela na lista, porque vale a primeira que bater
function regrasComOrdem(regras: z.infer<typeof regraSchema>[]) {
  return regras.map((regra, ordem) => ({ ...regra, ordem }))
}

// GET /api/empresas -> todas as empresas, em ordem alfabética
empresasRoutes.get('/', async (_req, res) => {
  const empresas = await prisma.empresaCliente.findMany({ include: incluirEmpresa })
  empresas.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'))
  res.json(empresas.map(empresaParaApi))
})

// GET /api/empresas/:id -> uma empresa com contas e regras
empresasRoutes.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  res.json(empresaParaApi(await buscarEmpresa(id)))
})

// POST /api/empresas -> cadastra
empresasRoutes.post('/', async (req, res) => {
  const { contas, regras, ...dados } = empresaSchema.parse(req.body)
  await conferirCnpjRepetido(dados.cnpj)

  const empresa = await prisma.empresaCliente.create({
    data: {
      ...dados,
      contas: { create: contas },
      regras: { create: regrasComOrdem(regras) },
    },
    include: incluirEmpresa,
  })
  res.status(201).json(empresaParaApi(empresa))
})

// PUT /api/empresas/:id -> salva a empresa inteira (contas e regras são trocadas pelas que vieram)
empresasRoutes.put('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { contas, regras, ...dados } = empresaSchema.parse(req.body)
  await buscarEmpresa(id)
  await conferirCnpjRepetido(dados.cnpj, id)

  const empresa = await prisma.empresaCliente.update({
    where: { id },
    data: {
      ...dados,
      contas: { deleteMany: {}, create: contas },
      regras: { deleteMany: {}, create: regrasComOrdem(regras) },
    },
    include: incluirEmpresa,
  })
  res.json(empresaParaApi(empresa))
})

// DELETE /api/empresas/:id -> exclui a empresa e todos os extratos dela (o front avisa antes)
empresasRoutes.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  await buscarEmpresa(id)

  const extratos = await prisma.arquivoProcessado.findMany({ where: { empresaId: id }, select: { caminhoArquivo: true } })
  // as linhas saem junto com o extrato, e as contas e regras junto com a empresa (onDelete: Cascade)
  await prisma.$transaction([
    prisma.arquivoProcessado.deleteMany({ where: { empresaId: id } }),
    prisma.empresaCliente.delete({ where: { id } }),
  ])

  // por último apaga os PDFs da pasta uploads
  await Promise.all(extratos.map((x) => unlink(x.caminhoArquivo).catch(() => {})))
  res.status(204).end()
})

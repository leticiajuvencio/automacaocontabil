import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { brParaDate, dataBrValida } from '../lib/datas.js'
import { HttpError } from '../lib/httpError.js'
import { extratoParaApi, incluirExtrato, incluirResumo, resumoParaApi } from '../lib/respostas.js'
import { idParam, texto } from '../lib/validacao.js'

export const extratosRoutes = Router()

// O PDF é lido no front. Aqui chegam o arquivo (para guardar) e o que o front leu dele.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    // o campo "dados" leva o texto do PDF e todos os lançamentos
    fieldSize: 20 * 1024 * 1024,
    files: 1,
  },
})

const statusSchema = z.enum(['processando', 'revisao', 'concluido', 'erro'])

const lancamentoSchema = z.object({
  data: z.string().refine(dataBrValida, 'Data inválida no lançamento (use dd/mm/aaaa).'),
  historico: texto(1000),
  detalhe: texto(1000),
  documento: texto(60),
  valor: z.number().nonnegative('O valor do lançamento não pode ser negativo.').max(9_999_999_999_999),
  tipo: z.enum(['C', 'D']),
  origemTipo: z.enum(['extrato', 'saldo', 'secao', 'deduzido', 'manual']),
  revisado: z.boolean(),
  incluir: z.boolean(),
  contrapartida: texto(20),
})

const infoSchema = z.object({
  banco: texto(200),
  cliente: texto(200),
  documento: texto(200),
  agencia: texto(200),
  conta: texto(200),
  periodo: texto(200),
  saldoAnterior: z.number().nullable(),
  saldoFinal: z.number().nullable(),
})

const novoExtratoSchema = z.object({
  empresaId: z.number().int().positive('Escolha a empresa cliente.'),
  competencia: z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Competência inválida (use mm/aaaa).'),
  banco: texto(60),
  metodo: texto(100),
  aviso: texto(5000),
  info: infoSchema,
  textoPdf: z.string().max(5_000_000),
  lancamentos: z.array(lancamentoSchema).max(10_000),
})

const revisaoSchema = z.object({
  status: statusSchema,
  // id negativo = linha que a pessoa incluiu na revisão
  lancamentos: z.array(lancamentoSchema.extend({ id: z.number().int() })).max(10_000),
})

const filtrosSchema = z.object({
  empresaId: z.coerce.number().int().positive().optional(),
  competencia: z.string().optional(),
  status: statusSchema.optional(),
})

// "dd/mm/aaaa" do front vira a coluna DATE do banco
function linhaParaBanco({ data, ...resto }: z.infer<typeof lancamentoSchema>) {
  return { ...resto, dataMovimento: brParaDate(data) }
}

async function buscarExtrato(id: number) {
  const extrato = await prisma.arquivoProcessado.findUnique({ where: { id }, include: incluirExtrato })
  if (!extrato) throw new HttpError(404, 'Extrato não encontrado.')
  return extrato
}

// GET /api/extratos -> lista para o painel (sem as linhas e sem o texto do PDF)
extratosRoutes.get('/', async (req, res) => {
  const filtros = filtrosSchema.parse(req.query)
  const extratos = await prisma.arquivoProcessado.findMany({
    where: filtros,
    include: incluirResumo,
    orderBy: { dataUpload: 'desc' },
  })
  res.json(extratos.map(resumoParaApi))
})

// GET /api/extratos/:id -> um extrato com todos os lançamentos
extratosRoutes.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  res.json(extratoParaApi(await buscarExtrato(id)))
})

// POST /api/extratos -> guarda o PDF e o que o front leu dele
extratosRoutes.post('/', upload.single('arquivo'), async (req, res) => {
  const pdf = req.file
  if (!pdf) throw new HttpError(400, 'Envie o PDF do extrato no campo "arquivo".')
  // todo PDF começa com "%PDF-"
  if (pdf.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(415, 'O arquivo enviado não é um PDF.')

  let json: unknown
  try {
    json = JSON.parse(String(req.body.dados))
  } catch {
    throw new HttpError(400, 'Faltaram os dados do extrato (campo "dados" em JSON).')
  }
  const dados = novoExtratoSchema.parse(json)

  const empresa = await prisma.empresaCliente.findUnique({ where: { id: dados.empresaId } })
  if (!empresa) throw new HttpError(400, 'Empresa não encontrada.')

  // 1) salva o PDF na pasta uploads com um nome único
  const caminhoArquivo = path.join(env.UPLOAD_DIR, `${randomUUID()}.pdf`)
  await writeFile(caminhoArquivo, pdf.buffer)

  // o multer lê o nome do arquivo como latin1; assim os acentos voltam certos
  const nomeArquivo = Buffer.from(pdf.originalname, 'latin1').toString('utf8').slice(0, 255)

  // 2) grava o extrato e os lançamentos; se o banco der erro, o PDF não fica sobrando
  try {
    const extrato = await prisma.arquivoProcessado.create({
      data: {
        empresaId: dados.empresaId,
        usuarioId: req.usuario!.id,
        nomeArquivo,
        caminhoArquivo,
        // sem nenhum lançamento lido, o extrato já entra como erro
        status: dados.lancamentos.length > 0 ? 'revisao' : 'erro',
        competencia: dados.competencia,
        banco: dados.banco,
        metodo: dados.metodo,
        aviso: dados.aviso,
        info: dados.info,
        textoPdf: dados.textoPdf,
        linhas: { createMany: { data: dados.lancamentos.map(linhaParaBanco) } },
      },
      include: incluirExtrato,
    })
    res.status(201).json(extratoParaApi(extrato))
  } catch (erro) {
    await unlink(caminhoArquivo).catch(() => {})
    throw erro
  }
})

// PUT /api/extratos/:id -> salva a revisão (status + a lista inteira de lançamentos)
extratosRoutes.put('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { status, lancamentos } = revisaoSchema.parse(req.body)

  const atual = await prisma.arquivoProcessado.findUnique({ where: { id }, select: { linhas: { select: { id: true } } } })
  if (!atual) throw new HttpError(404, 'Extrato não encontrado.')

  // linha com id deste extrato é atualizada; o resto (id negativo) é linha nova
  const idsAtuais = new Set(atual.linhas.map((l) => l.id))
  const mantidas = lancamentos.filter((l) => idsAtuais.has(l.id))
  const novas = lancamentos.filter((l) => !idsAtuais.has(l.id))

  // tudo numa transação: ou salva a revisão inteira ou nada
  await prisma.$transaction([
    prisma.arquivoProcessado.update({ where: { id }, data: { status } }),
    // as que sumiram da lista foram excluídas na revisão
    prisma.linhaExtrato.deleteMany({ where: { arquivoId: id, id: { notIn: mantidas.map((l) => l.id) } } }),
    ...mantidas.map(({ id: idLinha, ...l }) => prisma.linhaExtrato.update({ where: { id: idLinha }, data: linhaParaBanco(l) })),
    prisma.linhaExtrato.createMany({ data: novas.map(({ id: _id, ...l }) => ({ ...linhaParaBanco(l), arquivoId: id })) }),
  ])

  res.json(extratoParaApi(await buscarExtrato(id)))
})

// DELETE /api/extratos/:id -> apaga o extrato, as linhas e o PDF
extratosRoutes.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const extrato = await buscarExtrato(id)
  await prisma.arquivoProcessado.delete({ where: { id } })
  await unlink(extrato.caminhoArquivo).catch(() => {})
  res.status(204).end()
})

// GET /api/extratos/:id/pdf -> devolve o PDF original para conferir
extratosRoutes.get('/:id/pdf', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const extrato = await prisma.arquivoProcessado.findUnique({ where: { id }, select: { caminhoArquivo: true } })
  if (!extrato) throw new HttpError(404, 'Extrato não encontrado.')

  const caminho = path.resolve(extrato.caminhoArquivo)
  if (!existsSync(caminho)) throw new HttpError(404, 'O PDF deste extrato não está mais na pasta uploads.')
  res.type('application/pdf').sendFile(caminho)
})

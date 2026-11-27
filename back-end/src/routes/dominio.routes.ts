import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../db.js'
import { env } from '../env.js'
import { HttpError } from '../lib/httpError.js'
import { empresaParaApi, envioParaApi, incluirEmpresa, incluirEnvio } from '../lib/respostas.js'
import { idParam } from '../lib/validacao.js'
import { ativarChave, consultarLote, conferirChave, dominioConfigurado, enviarXml } from '../services/dominio.js'

// /api/dominio -> situação da conexão e envios de XML
export const dominioRoutes = Router()
// /api/empresas/:id/dominio -> vínculo de uma empresa com o Domínio
export const vinculoRoutes = Router({ mergeParams: true })

// XML de nota é pequeno; o limite baixo evita encher a memória com 50 arquivos de uma vez
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 50 },
})

const chaveSchema = z.object({
  chave: z.string().trim().min(1, 'Cole a chave gerada no Onvio.').max(500, 'Chave longa demais.'),
})

// todo XML começa com "<" (às vezes depois de espaços ou do BOM)
function pareceXml(conteudo: Buffer) {
  return /^﻿?\s*</.test(conteudo.subarray(0, 100).toString('utf8'))
}

async function buscarEmpresa(id: number) {
  const empresa = await prisma.empresaCliente.findUnique({ where: { id } })
  if (!empresa) throw new HttpError(404, 'Empresa não encontrada.')
  return empresa
}

// ---------- Conexão e envios ----------

// GET /api/dominio/status
dominioRoutes.get('/status', async (_req, res) => {
  const token = await prisma.tokenDominio.findUnique({ where: { id: 1 } })
  const tokenValido = token && token.expiraEm > new Date()

  res.json({
    configurado: dominioConfigurado(),
    ambiente: env.DOMINIO_AMBIENTE,
    tokenGeradoEm: tokenValido ? token.geradoEm.toISOString() : null,
    empresasVinculadas: await prisma.empresaCliente.count({ where: { dominioAtivadoEm: { not: null } } }),
  })
})

// GET /api/dominio/envios -> mais novo primeiro
dominioRoutes.get('/envios', async (_req, res) => {
  const envios = await prisma.envioDominio.findMany({ include: incluirEnvio, orderBy: { enviadoEm: 'desc' } })
  res.json(envios.map(envioParaApi))
})

// POST /api/dominio/envios -> manda os XML de uma empresa vinculada em um lote
dominioRoutes.post('/envios', upload.array('arquivos'), async (req, res) => {
  const arquivos = (req.files ?? []) as Express.Multer.File[]
  if (arquivos.length === 0) throw new HttpError(400, 'Escolha pelo menos um XML.')
  if (!arquivos.every((a) => pareceXml(a.buffer))) throw new HttpError(415, 'Só dá para enviar arquivos XML.')

  const empresa = await buscarEmpresa(Number(req.body.empresaId) || 0)
  if (!empresa.dominioChave) throw new HttpError(400, 'Esta empresa não está vinculada ao Domínio.')

  // o multer lê o nome do arquivo como latin1; assim os acentos voltam certos
  const nomes = arquivos.map((a) => Buffer.from(a.originalname, 'latin1').toString('utf8'))
  const lote = await enviarXml(
    empresa.dominioChave,
    arquivos.map((a, i) => ({ nome: nomes[i]!, conteudo: a.buffer })),
  )

  const envio = await prisma.envioDominio.create({
    data: { id: lote.id, empresaId: empresa.id, arquivos: nomes, mensagem: lote.mensagem },
    include: incluirEnvio,
  })
  res.status(201).json(envioParaApi(envio))
})

// POST /api/dominio/envios/:id/consultar -> pergunta ao Domínio como está o lote
dominioRoutes.post('/envios/:id/consultar', async (req, res) => {
  const { id } = z.object({ id: z.string().max(40) }).parse(req.params)
  const envio = await prisma.envioDominio.findUnique({ where: { id }, include: { empresa: true } })
  if (!envio) throw new HttpError(404, 'Envio não encontrado.')
  if (!envio.empresa.dominioChave) throw new HttpError(400, 'A empresa deste envio foi desvinculada do Domínio.')

  const mensagem = await consultarLote(envio.empresa.dominioChave, id)
  const atualizado = await prisma.envioDominio.update({
    where: { id },
    data: { mensagem, consultadoEm: new Date() },
    include: incluirEnvio,
  })
  res.json(envioParaApi(atualizado))
})

// ---------- Vínculo da empresa ----------

// POST /api/empresas/:id/dominio/conferir -> mostra de quem é a chave antes de ativar
vinculoRoutes.post('/conferir', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { chave } = chaveSchema.parse(req.body)
  await buscarEmpresa(id)
  res.json(await conferirChave(chave))
})

// POST /api/empresas/:id/dominio/ativar -> troca a chave pela integrationKey e guarda na empresa
vinculoRoutes.post('/ativar', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { chave } = chaveSchema.parse(req.body)
  await buscarEmpresa(id)

  const conferida = await conferirChave(chave)
  const integrationKey = await ativarChave(chave)

  // a integrationKey fica só no banco; para o front vai só "ativo" e os nomes
  const empresa = await prisma.empresaCliente.update({
    where: { id },
    data: {
      dominioChave: integrationKey,
      dominioEscritorio: conferida.escritorio,
      dominioNome: conferida.cliente,
      dominioCnpj: conferida.cnpj,
      dominioAtivadoEm: new Date(),
    },
    include: incluirEmpresa,
  })
  res.json(empresaParaApi(empresa))
})

// DELETE /api/empresas/:id/dominio -> desliga a integração desta empresa
vinculoRoutes.delete('/', async (req, res) => {
  const { id } = idParam.parse(req.params)
  await buscarEmpresa(id)

  const empresa = await prisma.empresaCliente.update({
    where: { id },
    data: { dominioChave: null, dominioEscritorio: '', dominioNome: '', dominioCnpj: '', dominioAtivadoEm: null },
    include: incluirEmpresa,
  })
  res.json(empresaParaApi(empresa))
})

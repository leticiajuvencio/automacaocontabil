import { prisma } from '../db.js'
import { env } from '../env.js'
import { formatarCnpj } from '../lib/cnpj.js'
import { HttpError } from '../lib/httpError.js'

// Fala com a API do Domínio (Onvio), seguindo a "Documentação Integração API para ERPs"
// da Central de Soluções da Domínio. Endereços e audience são os da documentação.
const URL_TOKEN = 'https://auth.thomsonreuters.com/oauth/token'
const URL_API = 'https://api.onvio.com.br/dominio'
const AUDIENCE = '409f91f6-dc17-44c8-a5d8-e0a1bafd8b67'

export function dominioConfigurado() {
  return env.DOMINIO_CLIENT_ID !== '' && env.DOMINIO_CLIENT_SECRET !== ''
}

// fetch que transforma "sem internet / API fora do ar" numa mensagem para a tela
async function pedir(url: string, opcoes: RequestInit) {
  try {
    return await fetch(url, opcoes)
  } catch {
    throw new HttpError(502, 'Não foi possível falar com a API do Domínio. Tente de novo em instantes.')
  }
}

// O token vale 24 h e a Domínio pede para gerar só 1 por dia para o sistema inteiro
// (quem pede demais é bloqueado). Por isso ele fica salvo no banco e é reaproveitado.
async function tokenDoDia(): Promise<string> {
  if (!dominioConfigurado()) {
    throw new HttpError(503, 'O back-end ainda não tem o client ID e o client secret da Domínio.')
  }

  // usa o salvo enquanto faltarem mais de 10 minutos para vencer
  const salvo = await prisma.tokenDominio.findUnique({ where: { id: 1 } })
  if (salvo && salvo.expiraEm.getTime() - Date.now() > 10 * 60 * 1000) return salvo.token

  const credenciais = Buffer.from(`${env.DOMINIO_CLIENT_ID}:${env.DOMINIO_CLIENT_SECRET}`).toString('base64')
  const resposta = await pedir(URL_TOKEN, {
    method: 'POST',
    headers: { Authorization: `Basic ${credenciais}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.DOMINIO_CLIENT_ID,
      client_secret: env.DOMINIO_CLIENT_SECRET,
      audience: AUDIENCE,
    }),
  })
  if (!resposta.ok) throw new HttpError(502, 'A Domínio não liberou o token. Confira o client ID e o client secret.')

  const { access_token, expires_in } = (await resposta.json()) as { access_token: string; expires_in: number }
  const token = { token: access_token, geradoEm: new Date(), expiraEm: new Date(Date.now() + expires_in * 1000) }
  await prisma.tokenDominio.upsert({ where: { id: 1 }, create: { id: 1, ...token }, update: token })
  return access_token
}

// Chamada à API com o token do dia e a chave no cabeçalho x-integration-key.
// erroChave é a mensagem para quando a Domínio recusa (chave errada, lote que não existe...).
async function chamarApi<T>(caminho: string, chave: string, erroChave: string, opcoes: RequestInit = {}): Promise<T> {
  const token = await tokenDoDia()
  const resposta = await pedir(URL_API + caminho, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'x-integration-key': chave },
  })

  if (resposta.status >= 400 && resposta.status < 500) {
    console.error(`Domínio respondeu ${resposta.status} em ${caminho}:`, await resposta.text())
    throw new HttpError(400, erroChave)
  }
  if (!resposta.ok) throw new HttpError(502, 'A API do Domínio está com problema. Tente de novo em instantes.')
  return (await resposta.json()) as T
}

// GET activation/info: mostra de quem é a chave que o contador gerou no Onvio
export async function conferirChave(chave: string) {
  const dados = await chamarApi<{ accountantOfficeName: string; clientName: string; clientNationalIdentity: string }>(
    '/integration/v1/activation/info',
    chave,
    'O Domínio não reconheceu esta chave. Confira se copiou a chave inteira.',
  )
  return {
    escritorio: dados.accountantOfficeName,
    cliente: dados.clientName,
    cnpj: formatarCnpj(dados.clientNationalIdentity),
  }
}

// POST activation/enable: troca a chave do contador pela integrationKey, que é a usada nos envios
export async function ativarChave(chave: string) {
  const dados = await chamarApi<{ integrationKey: string }>(
    '/integration/v1/activation/enable',
    chave,
    'O Domínio não aceitou ativar esta chave.',
    { method: 'POST' },
  )
  return dados.integrationKey
}

interface Status {
  code: string
  message: string
}

interface Lote {
  id: string
  status: Status
  filesExpanded?: { apiStatus?: Status }[]
}

// O que aparece na tela: o status de cada arquivo (ex.: "Arquivo armazenado na API.")
// ou, enquanto não tiver, o status do lote (ex.: "Aguardando processamento...")
function mensagemDoLote(lote: Lote) {
  const porArquivo = new Set(lote.filesExpanded?.map((arquivo) => arquivo.apiStatus?.message).filter(Boolean))
  return porArquivo.size > 0 ? [...porArquivo].join(' / ') : lote.status.message
}

// POST invoice/v3/batches: manda os XML de uma empresa em um lote
export async function enviarXml(integrationKey: string, arquivos: { nome: string; conteudo: Buffer }[]) {
  const formulario = new FormData()
  for (const arquivo of arquivos) {
    formulario.append('file[]', new Blob([arquivo.conteudo], { type: 'application/xml' }), arquivo.nome)
  }
  // boxeFile = true só se o escritório contratou o BOX-e; não muda nada na importação
  formulario.append('query', new Blob([JSON.stringify({ boxeFile: false })], { type: 'application/json' }))

  const lote = await chamarApi<Lote>(
    '/invoice/v3/batches',
    integrationKey,
    'O Domínio recusou o envio. Confira se a empresa continua vinculada.',
    { method: 'POST', body: formulario },
  )
  return { id: lote.id, mensagem: mensagemDoLote(lote) }
}

// GET invoice/v3/batches/{id}: confere se os XML foram armazenados
export async function consultarLote(integrationKey: string, id: string) {
  const lote = await chamarApi<Lote>(
    `/invoice/v3/batches/${encodeURIComponent(id)}`,
    integrationKey,
    'O Domínio não encontrou este envio.',
  )
  return mensagemDoLote(lote)
}

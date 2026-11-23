/**
 * Testes da API de ponta a ponta, num banco só de teste (DATABASE_URL_TEST no .env).
 * A API do Domínio é simulada: o fetch vira uma função que responde
 * igual aos exemplos da documentação da Domínio.
 */
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import type { Express } from 'express'
import pg from 'pg'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const urlTeste = process.env.DATABASE_URL_TEST

// cria o banco de teste (se ainda não existir) e roda as migrations nele
async function prepararBanco(url: string) {
  const nomeBanco = new URL(url).pathname.slice(1)
  const postgres = new URL(url)
  postgres.pathname = '/postgres'
  postgres.search = ''

  const cliente = new pg.Client({ connectionString: postgres.toString() })
  await cliente.connect()
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco])
  if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${nomeBanco}"`)
  await cliente.end()

  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'ignore' })
}

// ---------- API do Domínio de mentira ----------

const pedidosAoDominio: { url: string; metodo: string; chave: string | null; token: string | null }[] = []

function json(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json' } })
}

async function dominioFalso(url: string | URL | Request, opcoes: RequestInit = {}) {
  const endereco = String(url)
  const cabecalhos = new Headers(opcoes.headers)
  const chave = cabecalhos.get('x-integration-key')
  pedidosAoDominio.push({ url: endereco, metodo: opcoes.method ?? 'GET', chave, token: cabecalhos.get('authorization') })

  if (endereco.endsWith('/oauth/token')) return json({ access_token: 'token-do-dia', expires_in: 86400, token_type: 'Bearer' })
  if (chave === 'chave-errada') return json({ message: 'Invalid key' }, 401)
  if (endereco.endsWith('/activation/info')) {
    return json({
      accountantOfficeName: 'CONTABILIDADE FRASSON',
      accountantOfficeNationalIdentity: '31624642000195',
      clientName: 'PADARIA SAO JOSE',
      clientNationalIdentity: '11222333000181',
    })
  }
  if (endereco.endsWith('/activation/enable')) return json({ integrationKey: 'integration-key-teste' })
  if (endereco.endsWith('/invoice/v3/batches')) {
    const aguardando = 'Aguardando processamento. Por favor aguarde o arquivo ser processado.'
    return json({ id: 'LOTE0001', status: { code: 'S1', message: aguardando }, filesExpanded: [] }, 201)
  }
  if (endereco.endsWith('/invoice/v3/batches/LOTE0001')) {
    return json({
      id: 'LOTE0001',
      status: { code: 'S2', message: 'Processado.' },
      filesExpanded: [{ apiStatus: { code: 'SA2', message: 'Arquivo armazenado na API.' } }],
    })
  }
  return json({ message: 'Not found' }, 404)
}

// ---------- dados de exemplo ----------

const empresa = {
  razaoSocial: 'Padaria São José',
  cnpj: '11.222.333/0001-81',
  codigoDominio: '105',
  contaEntrada: '1501',
  historicoEntrada: '3',
  contaSaida: '2401',
  historicoSaida: '4',
  rendeFacil: 'ignorar',
  contaAplicacao: '',
  contas: [{ banco: 'Banco do Brasil', agencia: '1234-5', conta: '98765-4', codigo: '13' }],
  regras: [
    { termo: 'TED RECEBIDA', descricao: 'Recebimento de clientes', conta: '1102', historico: '' },
    { termo: 'TED', descricao: 'Pagamento a fornecedores', conta: '2110', historico: '' },
  ],
  opcoes: {
    separador: ';',
    codificacao: 'ansi',
    iniciaLote: 'cada',
    filial: '',
    centroCustoDebito: '',
    centroCustoCredito: '',
    cabecalho: false,
    semAcentos: true,
    maiusculas: true,
    documentoNoComplemento: false,
    abaImportacao: true,
    abaExtrato: true,
    abaResumo: true,
  },
}

function lancamento(data: string, historico: string, valor: number, tipo: 'C' | 'D') {
  return { data, historico, detalhe: '', documento: '', valor, tipo, origemTipo: 'extrato', revisado: false, incluir: true, contrapartida: '' }
}

const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

describe.skipIf(!urlTeste)('API', () => {
  let app: Express
  let tokenAdmin: string
  let empresaId: number
  let extratoId: number

  const comAdmin = () => ({ Authorization: `Bearer ${tokenAdmin}` })

  async function entrar(email: string, senha: string): Promise<string> {
    const resposta = await request(app).post('/api/auth/login').send({ email, senha })
    return resposta.body.token
  }

  function dadosDoExtrato(lancamentos = [lancamento('02/08/2026', 'PIX RECEBIDO', 350, 'C'), lancamento('02/08/2026', 'TARIFA', 45.9, 'D'), lancamento('10/08/2026', 'TED RECEBIDA', 5000, 'C')]) {
    return JSON.stringify({
      empresaId,
      competencia: '08/2026',
      banco: 'Banco do Brasil',
      metodo: 'Leitor do Banco do Brasil',
      aviso: '',
      info: { banco: 'Banco do Brasil', cliente: 'PADARIA SAO JOSE', documento: '11.222.333/0001-81', agencia: '1234-5', conta: '98765-4', periodo: '01/08/2026 a 31/08/2026', saldoAnterior: 1500, saldoFinal: 6804.1 },
      textoPdf: 'texto que o front leu do PDF',
      lancamentos,
    })
  }

  beforeAll(async () => {
    await prepararBanco(urlTeste!)
    // precisa vir antes de importar o app, porque o env.ts lê o process.env ao carregar
    Object.assign(process.env, {
      DATABASE_URL: urlTeste,
      UPLOAD_DIR: 'uploads/teste',
      DOMINIO_CLIENT_ID: 'client-id-teste',
      DOMINIO_CLIENT_SECRET: 'client-secret-teste',
      DOMINIO_AMBIENTE: 'homologacao',
    })
    vi.stubGlobal('fetch', dominioFalso)

    const { prisma } = await import('../src/db.js')
    await prisma.$executeRawUnsafe(
      'TRUNCATE envios_dominio, token_dominio, linhas_extrato, arquivos_processados, regras_empresa, contas_bancarias, empresas_clientes, usuarios_sistema RESTART IDENTITY CASCADE',
    )
    await prisma.usuarioSistema.create({
      data: { nome: 'Admin Teste', email: 'admin@teste.com', senha: await bcrypt.hash('senha-admin', 10), admin: true },
    })

    mkdirSync('uploads/teste', { recursive: true })
    const { criarApp } = await import('../src/app.js')
    app = criarApp()
  }, 120_000)

  afterAll(async () => {
    const { prisma } = await import('../src/db.js')
    await prisma.$disconnect()
    rmSync('uploads/teste', { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  describe('login', () => {
    it('recusa senha errada', async () => {
      const r = await request(app).post('/api/auth/login').send({ email: 'admin@teste.com', senha: 'errada' })
      expect(r.status).toBe(401)
      expect(r.body.erro).toBe('E-mail ou senha incorretos.')
    })

    it('entra e devolve o token e o usuário sem a senha', async () => {
      const r = await request(app).post('/api/auth/login').send({ email: ' ADMIN@teste.com ', senha: 'senha-admin' })
      expect(r.status).toBe(200)
      expect(r.body.usuario).toMatchObject({ nome: 'Admin Teste', admin: true })
      expect(r.body.usuario.senha).toBeUndefined()
      tokenAdmin = r.body.token
    })

    it('sem token ou com token falso não entra', async () => {
      expect((await request(app).get('/api/empresas')).status).toBe(401)
      expect((await request(app).get('/api/empresas').set('Authorization', 'Bearer falso')).status).toBe(401)
    })
  })

  describe('erros viram mensagem, nunca erro 500', () => {
    it('id grande demais para o banco', async () => {
      const r = await request(app).get('/api/empresas/99999999999').set(comAdmin())
      expect(r.status).toBe(400)
    })

    it('JSON quebrado', async () => {
      const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
      expect(r.status).toBe(400)
      expect(r.body.erro).toBe('Os dados enviados não estão em JSON válido.')
    })

    it('token sem usuário dentro', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign({}, process.env.JWT_SECRET!)
      const r = await request(app).get('/api/empresas').set('Authorization', `Bearer ${token}`)
      expect(r.status).toBe(401)
    })
  })

  describe('usuários', () => {
    let comumId: number

    it('admin cadastra usuário', async () => {
      const r = await request(app).post('/api/usuarios').set(comAdmin()).send({ nome: 'Maria', email: 'maria@teste.com', senha: '123456', admin: false })
      expect(r.status).toBe(201)
      expect(r.body.senha).toBeUndefined()
      comumId = r.body.id
    })

    it('não deixa e-mail repetido nem senha curta', async () => {
      const repetido = await request(app).post('/api/usuarios').set(comAdmin()).send({ nome: 'Outra', email: 'MARIA@teste.com', senha: '123456', admin: false })
      expect(repetido.status).toBe(409)

      const curta = await request(app).post('/api/usuarios').set(comAdmin()).send({ nome: 'Outra', email: 'outra@teste.com', senha: '123', admin: false })
      expect(curta.status).toBe(400)
      expect(curta.body.erro).toBe('A senha precisa ter pelo menos 6 caracteres.')
    })

    it('quem não é admin não vê os usuários', async () => {
      const tokenMaria = await entrar('maria@teste.com', '123456')
      const r = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenMaria}`)
      expect(r.status).toBe(403)
    })

    it('admin não exclui a si mesmo, mas exclui os outros', async () => {
      const lista = await request(app).get('/api/usuarios').set(comAdmin())
      const eu = lista.body.find((u: { email: string }) => u.email === 'admin@teste.com')
      expect((await request(app).delete(`/api/usuarios/${eu.id}`).set(comAdmin())).status).toBe(409)
      expect((await request(app).delete(`/api/usuarios/${comumId}`).set(comAdmin())).status).toBe(204)
    })
  })

  describe('empresas', () => {
    it('cadastra com contas e regras', async () => {
      const r = await request(app).post('/api/empresas').set(comAdmin()).send(empresa)
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ razaoSocial: 'Padaria São José', cnpj: '11.222.333/0001-81', totalExtratos: 0, dominio: { ativo: false } })
      expect(r.body.regras.map((x: { termo: string }) => x.termo)).toEqual(['TED RECEBIDA', 'TED'])
      empresaId = r.body.id
    })

    it('recusa CNPJ inválido e CNPJ repetido', async () => {
      const invalido = await request(app).post('/api/empresas').set(comAdmin()).send({ ...empresa, cnpj: '11.222.333/0001-80' })
      expect(invalido.status).toBe(400)
      expect(invalido.body.erro).toBe('CNPJ inválido.')

      const repetido = await request(app).post('/api/empresas').set(comAdmin()).send({ ...empresa, cnpj: '11222333000181' })
      expect(repetido.status).toBe(409)
    })

    it('aceita empresa sem CNPJ', async () => {
      const r = await request(app).post('/api/empresas').set(comAdmin()).send({ ...empresa, razaoSocial: 'Açougue Bom Corte', cnpj: '' })
      expect(r.status).toBe(201)
      expect(r.body.cnpj).toBe('')
    })

    it('salva as regras na ordem que vieram', async () => {
      const r = await request(app).put(`/api/empresas/${empresaId}`).set(comAdmin()).send({ ...empresa, regras: [...empresa.regras].reverse(), contas: [] })
      expect(r.status).toBe(200)
      expect(r.body.regras.map((x: { termo: string }) => x.termo)).toEqual(['TED', 'TED RECEBIDA'])
      expect(r.body.contas).toEqual([])
    })

    it('lista em ordem alfabética', async () => {
      const r = await request(app).get('/api/empresas').set(comAdmin())
      expect(r.body.map((e: { razaoSocial: string }) => e.razaoSocial)).toEqual(['Açougue Bom Corte', 'Padaria São José'])
    })
  })

  describe('extratos', () => {
    it('guarda o PDF e os lançamentos que o front leu', async () => {
      const r = await request(app).post('/api/extratos').set(comAdmin()).attach('arquivo', pdf, 'extrato março.pdf').field('dados', dadosDoExtrato())
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({
        nomeArquivo: 'extrato março.pdf',
        status: 'revisao',
        empresaNome: 'Padaria São José',
        usuarioNome: 'Admin Teste',
        totalLinhas: 3,
        linhasRevisadas: 0,
      })
      expect(r.body.lancamentos[1]).toMatchObject({ data: '02/08/2026', historico: 'TARIFA', valor: 45.9, tipo: 'D' })
      extratoId = r.body.id
    })

    it('recusa arquivo que não é PDF e data que não existe', async () => {
      const naoPdf = await request(app).post('/api/extratos').set(comAdmin()).attach('arquivo', Buffer.from('oi'), 'x.pdf').field('dados', dadosDoExtrato())
      expect(naoPdf.status).toBe(415)

      const dataRuim = await request(app)
        .post('/api/extratos')
        .set(comAdmin())
        .attach('arquivo', pdf, 'x.pdf')
        .field('dados', dadosDoExtrato([lancamento('31/02/2026', 'X', 1, 'C')]))
      expect(dataRuim.status).toBe(400)
    })

    it('lista sem as linhas e com os filtros do painel', async () => {
      const r = await request(app).get('/api/extratos?competencia=08/2026&status=revisao').set(comAdmin())
      expect(r.body).toHaveLength(1)
      expect(r.body[0].lancamentos).toBeUndefined()

      const outraCompetencia = await request(app).get('/api/extratos?competencia=09/2026').set(comAdmin())
      expect(outraCompetencia.body).toHaveLength(0)
    })

    it('salva a revisão: edita, apaga e inclui linhas', async () => {
      const atual = await request(app).get(`/api/extratos/${extratoId}`).set(comAdmin())
      const [pix, , ted] = atual.body.lancamentos

      const r = await request(app)
        .put(`/api/extratos/${extratoId}`)
        .set(comAdmin())
        .send({
          status: 'concluido',
          lancamentos: [
            { ...pix, revisado: true, contrapartida: '1102' },
            { ...ted, revisado: true },
            { ...lancamento('15/08/2026', 'DEPÓSITO', 100, 'C'), id: -1, origemTipo: 'manual', revisado: true },
          ],
        })
      expect(r.status).toBe(200)
      expect(r.body.status).toBe('concluido')
      expect(r.body.lancamentos.map((l: { historico: string }) => l.historico)).toEqual(['PIX RECEBIDO', 'TED RECEBIDA', 'DEPÓSITO'])
      expect(r.body.lancamentos[0]).toMatchObject({ id: pix.id, contrapartida: '1102' })
      expect(r.body.lancamentos[2].id).toBeGreaterThan(0)
      expect(r.body.linhasRevisadas).toBe(3)
    })

    it('devolve o PDF original', async () => {
      const r = await request(app).get(`/api/extratos/${extratoId}/pdf`).set(comAdmin()).responseType('blob')
      expect(r.status).toBe(200)
      expect(Buffer.from(r.body).subarray(0, 5).toString()).toBe('%PDF-')
    })

    it('extrato sem lançamentos entra como erro e pode ser excluído', async () => {
      const r = await request(app).post('/api/extratos').set(comAdmin()).attach('arquivo', pdf, 'vazio.pdf').field('dados', dadosDoExtrato([]))
      expect(r.body.status).toBe('erro')

      expect((await request(app).delete(`/api/extratos/${r.body.id}`).set(comAdmin())).status).toBe(204)
      expect((await request(app).get(`/api/extratos/${r.body.id}`).set(comAdmin())).status).toBe(404)
    })

    it('quem já enviou extrato não pode ser excluído', async () => {
      await request(app).post('/api/usuarios').set(comAdmin()).send({ nome: 'Chefe', email: 'chefe@teste.com', senha: '123456', admin: true })
      const tokenChefe = await entrar('chefe@teste.com', '123456')
      const lista = await request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenChefe}`)
      const admin = lista.body.find((u: { email: string }) => u.email === 'admin@teste.com')

      const r = await request(app).delete(`/api/usuarios/${admin.id}`).set('Authorization', `Bearer ${tokenChefe}`)
      expect(r.status).toBe(409)
    })
  })

  describe('domínio', () => {
    it('mostra a conexão configurada e ainda sem token', async () => {
      const r = await request(app).get('/api/dominio/status').set(comAdmin())
      expect(r.body).toEqual({ configurado: true, ambiente: 'homologacao', tokenGeradoEm: null, empresasVinculadas: 0 })
    })

    it('avisa quando a chave não é reconhecida', async () => {
      const r = await request(app).post(`/api/empresas/${empresaId}/dominio/conferir`).set(comAdmin()).send({ chave: 'chave-errada' })
      expect(r.status).toBe(400)
      expect(r.body.erro).toMatch(/não reconheceu/)
    })

    it('confere a chave e mostra de quem ela é', async () => {
      const r = await request(app).post(`/api/empresas/${empresaId}/dominio/conferir`).set(comAdmin()).send({ chave: 'chave-do-contador' })
      expect(r.body).toEqual({ escritorio: 'CONTABILIDADE FRASSON', cliente: 'PADARIA SAO JOSE', cnpj: '11.222.333/0001-81' })
    })

    it('ativa a integração sem mandar a integrationKey para o front', async () => {
      const r = await request(app).post(`/api/empresas/${empresaId}/dominio/ativar`).set(comAdmin()).send({ chave: 'chave-do-contador' })
      expect(r.status).toBe(200)
      expect(r.body.dominio).toMatchObject({ ativo: true, nomeNoDominio: 'PADARIA SAO JOSE', escritorio: 'CONTABILIDADE FRASSON' })
      expect(JSON.stringify(r.body)).not.toContain('integration-key-teste')
    })

    it('pede o token uma vez só e usa ele nas chamadas', () => {
      expect(pedidosAoDominio.filter((p) => p.url.endsWith('/oauth/token'))).toHaveLength(1)
      const ativacao = pedidosAoDominio.find((p) => p.url.endsWith('/activation/enable'))
      expect(ativacao).toMatchObject({ metodo: 'POST', chave: 'chave-do-contador', token: 'Bearer token-do-dia' })
    })

    it('só envia XML', async () => {
      const r = await request(app).post('/api/dominio/envios').set(comAdmin()).field('empresaId', String(empresaId)).attach('arquivos', pdf, 'nota.pdf')
      expect(r.status).toBe(415)

      const grande = Buffer.concat([Buffer.from('<nfeProc>'), Buffer.alloc(3 * 1024 * 1024, ' ')])
      const r2 = await request(app).post('/api/dominio/envios').set(comAdmin()).field('empresaId', String(empresaId)).attach('arquivos', grande, 'grande.xml')
      expect(r2.status).toBe(413)
      expect(r2.body.erro).toBe('Cada XML pode ter no máximo 2 MB.')
    })

    it('envia os XML com a integrationKey', async () => {
      const r = await request(app)
        .post('/api/dominio/envios')
        .set(comAdmin())
        .field('empresaId', String(empresaId))
        .attach('arquivos', Buffer.from('<?xml version="1.0"?><nfeProc/>'), 'nota 1.xml')
        .attach('arquivos', Buffer.from('<nfeProc/>'), 'nota 2.xml')
      expect(r.status).toBe(201)
      expect(r.body).toMatchObject({ id: 'LOTE0001', empresaNome: 'Padaria São José', arquivos: ['nota 1.xml', 'nota 2.xml'], consultadoEm: null })
      expect(r.body.mensagem).toMatch(/Aguardando processamento/)

      const envio = pedidosAoDominio.find((p) => p.url.endsWith('/invoice/v3/batches'))
      expect(envio).toMatchObject({ metodo: 'POST', chave: 'integration-key-teste' })
    })

    it('consulta o lote e mostra se o XML foi armazenado', async () => {
      const r = await request(app).post('/api/dominio/envios/LOTE0001/consultar').set(comAdmin())
      expect(r.body.mensagem).toBe('Arquivo armazenado na API.')
      expect(r.body.consultadoEm).not.toBeNull()

      const lista = await request(app).get('/api/dominio/envios').set(comAdmin())
      expect(lista.body).toHaveLength(1)
    })

    it('status mostra o token do dia e a empresa vinculada', async () => {
      const r = await request(app).get('/api/dominio/status').set(comAdmin())
      expect(r.body.tokenGeradoEm).not.toBeNull()
      expect(r.body.empresasVinculadas).toBe(1)
    })

    it('desvincula a empresa', async () => {
      const r = await request(app).delete(`/api/empresas/${empresaId}/dominio`).set(comAdmin())
      expect(r.body.dominio.ativo).toBe(false)

      const consulta = await request(app).post('/api/dominio/envios/LOTE0001/consultar').set(comAdmin())
      expect(consulta.status).toBe(400)
    })
  })

  describe('exclusão da empresa', () => {
    it('apaga junto os extratos, os PDFs e os envios dela', async () => {
      expect((await request(app).delete(`/api/empresas/${empresaId}`).set(comAdmin())).status).toBe(204)
      expect((await request(app).get('/api/extratos').set(comAdmin())).body).toHaveLength(0)
      expect((await request(app).get('/api/dominio/envios').set(comAdmin())).body).toHaveLength(0)
      expect((await request(app).get(`/api/extratos/${extratoId}/pdf`).set(comAdmin())).status).toBe(404)
    })
  })
})

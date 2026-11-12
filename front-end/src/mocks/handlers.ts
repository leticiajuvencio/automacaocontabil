// Respostas falsas da API para o modo demonstração.

import { HttpResponse, delay, http } from 'msw'
import type { DadosEmpresa, DadosNovoExtrato, Empresa, Extrato, Lancamento } from '../api/tipos'
import { dadosIniciais, type BancoDemo } from './dados'

export const CHAVE_DEMO = 'automacao-contabil:demo'

function carregar(): BancoDemo {
  try {
    const salvo = localStorage.getItem(CHAVE_DEMO)
    if (salvo) return JSON.parse(salvo)
  } catch {
    // dados corrompidos: começa de novo
  }
  return dadosIniciais()
}

const banco = carregar()
// os PDFs ficam só na memória (somem ao recarregar a página)
const pdfs = new Map<number, File>()

function gravar() {
  try {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify(banco))
  } catch {
    // sem espaço no navegador: segue só na memória
  }
}

function novoId() {
  banco.proximoId += 1
  return banco.proximoId
}

const erro = (status: number, mensagem: string) => HttpResponse.json({ erro: mensagem }, { status })

function usuarioDaRequisicao(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  return banco.usuarios.find((u) => `demo-${u.id}` === token) ?? null
}

function empresaCompleta(e: BancoDemo['empresas'][number]): Empresa {
  return { ...e, totalExtratos: banco.extratos.filter((x) => x.empresaId === e.id).length }
}

function extratoCompleto(x: BancoDemo['extratos'][number]): Extrato {
  return {
    ...x,
    empresaNome: banco.empresas.find((e) => e.id === x.empresaId)?.razaoSocial ?? '',
    totalLinhas: x.lancamentos.length,
    linhasRevisadas: x.lancamentos.filter((l) => l.revisado).length,
  }
}

const api = (caminho: string) => `/api${caminho}`

export const handlers = [
  // ---------- Login ----------
  http.post(api('/auth/login'), async ({ request }) => {
    await delay(300)
    const { email, senha } = (await request.json()) as { email: string; senha: string }
    const usuario = banco.usuarios.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.senha === senha)
    if (!usuario) return erro(401, 'E-mail ou senha incorretos.')
    const { senha: _senha, ...dados } = usuario
    return HttpResponse.json({ token: `demo-${usuario.id}`, usuario: dados })
  }),

  // daqui para baixo precisa estar logado
  http.all(api('/*'), ({ request }) => {
    if (!usuarioDaRequisicao(request)) return erro(401, 'Sessão expirada. Entre de novo.')
  }),

  // ---------- Empresas ----------
  http.get(api('/empresas'), async () => {
    await delay(150)
    const lista = [...banco.empresas].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'))
    return HttpResponse.json(lista.map(empresaCompleta))
  }),

  http.get(api('/empresas/:id'), ({ params }) => {
    const empresa = banco.empresas.find((e) => e.id === Number(params.id))
    return empresa ? HttpResponse.json(empresaCompleta(empresa)) : erro(404, 'Empresa não encontrada.')
  }),

  http.post(api('/empresas'), async ({ request }) => {
    const dados = (await request.json()) as DadosEmpresa
    const nova = {
      ...dados,
      id: novoId(),
      dominio: { ativo: false, escritorio: '', nomeNoDominio: '', cnpjNoDominio: '', ativadoEm: null },
      dataCadastro: new Date().toISOString(),
    }
    banco.empresas.push(nova)
    gravar()
    return HttpResponse.json(empresaCompleta(nova), { status: 201 })
  }),

  http.put(api('/empresas/:id'), async ({ params, request }) => {
    const empresa = banco.empresas.find((e) => e.id === Number(params.id))
    if (!empresa) return erro(404, 'Empresa não encontrada.')
    Object.assign(empresa, (await request.json()) as DadosEmpresa)
    gravar()
    return HttpResponse.json(empresaCompleta(empresa))
  }),

  http.delete(api('/empresas/:id'), ({ params }) => {
    const id = Number(params.id)
    banco.empresas = banco.empresas.filter((e) => e.id !== id)
    banco.extratos = banco.extratos.filter((x) => x.empresaId !== id)
    gravar()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Extratos ----------
  http.get(api('/extratos'), async ({ request }) => {
    await delay(200)
    const filtro = new URL(request.url).searchParams
    const lista = banco.extratos
      .filter((x) => !filtro.get('empresaId') || x.empresaId === Number(filtro.get('empresaId')))
      .filter((x) => !filtro.get('competencia') || x.competencia === filtro.get('competencia'))
      .filter((x) => !filtro.get('status') || x.status === filtro.get('status'))
      .sort((a, b) => b.dataUpload.localeCompare(a.dataUpload))
    // a lista não leva os lançamentos nem o texto do PDF
    return HttpResponse.json(
      lista.map((x) => {
        const { lancamentos: _l, textoPdf: _t, info: _i, aviso: _a, metodo: _m, ...resumo } = extratoCompleto(x)
        return resumo
      }),
    )
  }),

  http.get(api('/extratos/:id'), ({ params }) => {
    const extrato = banco.extratos.find((x) => x.id === Number(params.id))
    return extrato ? HttpResponse.json(extratoCompleto(extrato)) : erro(404, 'Extrato não encontrado.')
  }),

  http.post(api('/extratos'), async ({ request }) => {
    await delay(500)
    const usuario = usuarioDaRequisicao(request)!
    const formulario = await request.formData()
    const arquivo = formulario.get('arquivo') as File
    const dados = JSON.parse(String(formulario.get('dados'))) as DadosNovoExtrato
    if (!banco.empresas.some((e) => e.id === dados.empresaId)) return erro(400, 'Empresa não encontrada.')

    const extrato = {
      ...dados,
      id: novoId(),
      nomeArquivo: arquivo.name,
      status: dados.lancamentos.length ? ('revisao' as const) : ('erro' as const),
      dataUpload: new Date().toISOString(),
      usuarioNome: usuario.nome,
      lancamentos: dados.lancamentos.map((l) => ({ ...l, id: novoId() })),
    }
    banco.extratos.push(extrato)
    pdfs.set(extrato.id, arquivo)
    gravar()
    return HttpResponse.json(extratoCompleto(extrato), { status: 201 })
  }),

  http.put(api('/extratos/:id'), async ({ params, request }) => {
    const extrato = banco.extratos.find((x) => x.id === Number(params.id))
    if (!extrato) return erro(404, 'Extrato não encontrado.')
    const { status, lancamentos } = (await request.json()) as { status: Extrato['status']; lancamentos: Lancamento[] }
    extrato.status = status
    // linha nova chega com id negativo: ganha um id de verdade
    extrato.lancamentos = lancamentos.map((l) => (l.id < 0 ? { ...l, id: novoId() } : l))
    gravar()
    return HttpResponse.json(extratoCompleto(extrato))
  }),

  http.delete(api('/extratos/:id'), ({ params }) => {
    banco.extratos = banco.extratos.filter((x) => x.id !== Number(params.id))
    gravar()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/extratos/:id/pdf'), ({ params }) => {
    const pdf = pdfs.get(Number(params.id))
    if (!pdf) return erro(404, 'No modo demonstração o PDF só fica guardado até recarregar a página.')
    return new HttpResponse(pdf, { headers: { 'Content-Type': 'application/pdf' } })
  }),

  // ---------- Domínio ----------
  http.get(api('/dominio/status'), () => {
    const hoje = new Date()
    hoje.setHours(8, 0, 0, 0)
    return HttpResponse.json({
      configurado: true,
      ambiente: 'homologacao',
      tokenGeradoEm: hoje.toISOString(),
      empresasVinculadas: banco.empresas.filter((e) => e.dominio.ativo).length,
    })
  }),

  http.post(api('/empresas/:id/dominio/conferir'), async ({ params, request }) => {
    await delay(600)
    const empresa = banco.empresas.find((e) => e.id === Number(params.id))
    const { chave } = (await request.json()) as { chave: string }
    if (!empresa) return erro(404, 'Empresa não encontrada.')
    if (chave.trim().length < 8) return erro(400, 'O Domínio não reconheceu esta chave. Confira se copiou a chave inteira.')
    return HttpResponse.json({ escritorio: 'CONTABILIDADE FRASSON', cliente: empresa.razaoSocial.toUpperCase(), cnpj: empresa.cnpj })
  }),

  http.post(api('/empresas/:id/dominio/ativar'), async ({ params }) => {
    await delay(600)
    const empresa = banco.empresas.find((e) => e.id === Number(params.id))
    if (!empresa) return erro(404, 'Empresa não encontrada.')
    empresa.dominio = {
      ativo: true,
      escritorio: 'CONTABILIDADE FRASSON',
      nomeNoDominio: empresa.razaoSocial.toUpperCase(),
      cnpjNoDominio: empresa.cnpj,
      ativadoEm: new Date().toISOString(),
    }
    gravar()
    return HttpResponse.json(empresaCompleta(empresa))
  }),

  http.delete(api('/empresas/:id/dominio'), ({ params }) => {
    const empresa = banco.empresas.find((e) => e.id === Number(params.id))
    if (!empresa) return erro(404, 'Empresa não encontrada.')
    empresa.dominio = { ativo: false, escritorio: '', nomeNoDominio: '', cnpjNoDominio: '', ativadoEm: null }
    gravar()
    return HttpResponse.json(empresaCompleta(empresa))
  }),

  http.get(api('/dominio/envios'), () =>
    HttpResponse.json([...banco.envios].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))),
  ),

  http.post(api('/dominio/envios'), async ({ request }) => {
    await delay(700)
    const formulario = await request.formData()
    const empresa = banco.empresas.find((e) => e.id === Number(formulario.get('empresaId')))
    if (!empresa?.dominio.ativo) return erro(400, 'Esta empresa não está vinculada ao Domínio.')
    const arquivos = formulario.getAll('arquivos') as File[]
    const envio = {
      // a API devolve um id de 32 caracteres para o lote
      id: crypto.randomUUID().replace(/-/g, '').toUpperCase(),
      empresaId: empresa.id,
      empresaNome: empresa.razaoSocial,
      arquivos: arquivos.map((a) => a.name),
      enviadoEm: new Date().toISOString(),
      mensagem: 'Aguardando processamento. Por favor aguarde o arquivo ser processado.',
      consultadoEm: null,
    }
    banco.envios.push(envio)
    gravar()
    return HttpResponse.json(envio, { status: 201 })
  }),

  http.post(api('/dominio/envios/:id/consultar'), async ({ params }) => {
    await delay(400)
    const envio = banco.envios.find((e) => e.id === params.id)
    if (!envio) return erro(404, 'Envio não encontrado.')
    if (Date.now() - new Date(envio.enviadoEm).getTime() > 5000) envio.mensagem = 'Arquivo armazenado na API'
    envio.consultadoEm = new Date().toISOString()
    gravar()
    return HttpResponse.json(envio)
  }),

  // ---------- Usuários ----------
  http.get(api('/usuarios'), () => HttpResponse.json(banco.usuarios.map(({ senha: _s, ...u }) => u))),

  http.post(api('/usuarios'), async ({ request }) => {
    const dados = (await request.json()) as { nome: string; email: string; senha: string; admin: boolean }
    if (banco.usuarios.some((u) => u.email.toLowerCase() === dados.email.toLowerCase())) return erro(409, 'Já existe um usuário com este e-mail.')
    const usuario = { ...dados, id: novoId(), dataCadastro: new Date().toISOString() }
    banco.usuarios.push(usuario)
    gravar()
    const { senha: _s, ...resposta } = usuario
    return HttpResponse.json(resposta, { status: 201 })
  }),

  http.delete(api('/usuarios/:id'), ({ params }) => {
    banco.usuarios = banco.usuarios.filter((u) => u.id !== Number(params.id))
    gravar()
    return new HttpResponse(null, { status: 204 })
  }),
]

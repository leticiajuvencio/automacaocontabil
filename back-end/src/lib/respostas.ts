import type { LinhaExtrato, Prisma } from '../generated/prisma/client.js'
import { dateParaBr } from './datas.js'

// Deixa os dados do banco no formato que o front espera (src/api/tipos.ts do front)

// ---------- Empresa ----------

export const incluirEmpresa = {
  contas: { orderBy: { id: 'asc' } },
  regras: { orderBy: { ordem: 'asc' } },
  _count: { select: { arquivos: true } },
} satisfies Prisma.EmpresaClienteInclude

type EmpresaDoBanco = Prisma.EmpresaClienteGetPayload<{ include: typeof incluirEmpresa }>

export function empresaParaApi(e: EmpresaDoBanco) {
  return {
    id: e.id,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj ?? '',
    codigoDominio: e.codigoDominio,
    contaEntrada: e.contaEntrada,
    historicoEntrada: e.historicoEntrada,
    contaSaida: e.contaSaida,
    historicoSaida: e.historicoSaida,
    rendeFacil: e.rendeFacil,
    contaAplicacao: e.contaAplicacao,
    contas: e.contas.map(({ banco, agencia, conta, codigo }) => ({ banco, agencia, conta, codigo })),
    regras: e.regras.map(({ termo, descricao, conta, historico }) => ({ termo, descricao, conta, historico })),
    opcoes: e.opcoes,
    dominio: {
      ativo: e.dominioAtivadoEm !== null,
      escritorio: e.dominioEscritorio,
      nomeNoDominio: e.dominioNome,
      cnpjNoDominio: e.dominioCnpj,
      ativadoEm: e.dominioAtivadoEm?.toISOString() ?? null,
    },
    totalExtratos: e._count.arquivos,
    dataCadastro: e.dataCadastro.toISOString(),
  }
}

// ---------- Extrato ----------

// para a lista basta saber se cada linha foi revisada
export const incluirResumo = {
  empresa: { select: { razaoSocial: true } },
  usuario: { select: { nome: true } },
  linhas: { select: { revisado: true } },
} satisfies Prisma.ArquivoProcessadoInclude

// para abrir o extrato vêm as linhas inteiras, na ordem do extrato
export const incluirExtrato = {
  ...incluirResumo,
  linhas: { orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ArquivoProcessadoInclude

type ResumoDoBanco = Prisma.ArquivoProcessadoGetPayload<{ include: typeof incluirResumo }>
type ExtratoDoBanco = Prisma.ArquivoProcessadoGetPayload<{ include: typeof incluirExtrato }>

export function resumoParaApi(x: ResumoDoBanco) {
  return {
    id: x.id,
    empresaId: x.empresaId,
    empresaNome: x.empresa.razaoSocial,
    nomeArquivo: x.nomeArquivo,
    banco: x.banco,
    competencia: x.competencia,
    status: x.status,
    dataUpload: x.dataUpload.toISOString(),
    usuarioNome: x.usuario.nome,
    totalLinhas: x.linhas.length,
    linhasRevisadas: x.linhas.filter((l) => l.revisado).length,
  }
}

export function extratoParaApi(x: ExtratoDoBanco) {
  return {
    ...resumoParaApi(x),
    metodo: x.metodo,
    aviso: x.aviso,
    info: x.info,
    textoPdf: x.textoPdf,
    lancamentos: x.linhas.map(lancamentoParaApi),
  }
}

function lancamentoParaApi(l: LinhaExtrato) {
  return {
    id: l.id,
    data: dateParaBr(l.dataMovimento),
    historico: l.historico,
    detalhe: l.detalhe,
    documento: l.documento,
    valor: Number(l.valor),
    tipo: l.tipo,
    origemTipo: l.origemTipo,
    revisado: l.revisado,
    incluir: l.incluir,
    contrapartida: l.contrapartida,
  }
}

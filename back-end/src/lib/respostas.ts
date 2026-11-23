import type { Prisma } from '../generated/prisma/client.js'

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

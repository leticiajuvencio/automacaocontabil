// Decide a contrapartida de cada lançamento e monta a partida (conta débito → conta crédito).
// Ordem: Rende Fácil (aplicação automática) → regras da empresa → contrapartida padrão.

import type { ContaBancaria, Empresa, InfoExtrato, Lancamento } from '../api/tipos'
import { normalizar, somenteDigitos } from '../lib/formatar'

export interface Classificacao {
  /** nome que aparece na etiqueta da linha */
  regra: string
  conta: string
  historico: string
  padrao: boolean
  ignorado: boolean
}

export interface Partida extends Classificacao {
  contrapartida: string
  debito: string
  credito: string
}

type ComTexto = Pick<Lancamento, 'historico' | 'detalhe'>

export function ehRendeFacil(lancamento: ComTexto): boolean {
  return normalizar(lancamento.historico + ' ' + lancamento.detalhe).includes('RENDE FACIL')
}

export function classificar(lancamento: ComTexto & Pick<Lancamento, 'tipo'>, empresa: Empresa): Classificacao {
  if (ehRendeFacil(lancamento)) {
    if (empresa.rendeFacil === 'ignorar') return { regra: 'Rende Fácil', conta: '', historico: '', padrao: false, ignorado: true }
    return { regra: 'Aplicação', conta: empresa.contaAplicacao, historico: '', padrao: false, ignorado: false }
  }

  const texto = normalizar(lancamento.historico + ' ' + lancamento.detalhe)
  // vale a primeira regra cuja palavra-chave aparece no histórico
  const regra = empresa.regras.find((r) => normalizar(r.termo) && texto.includes(normalizar(r.termo)))
  if (regra) return { regra: regra.descricao || regra.termo, conta: regra.conta, historico: regra.historico, padrao: false, ignorado: false }

  if (lancamento.tipo === 'C')
    return { regra: 'Padrão entradas', conta: empresa.contaEntrada, historico: empresa.historicoEntrada, padrao: true, ignorado: false }
  return { regra: 'Padrão saídas', conta: empresa.contaSaida, historico: empresa.historicoSaida, padrao: true, ignorado: false }
}

/** Acha a conta bancária cadastrada na empresa que bate com a conta lida do PDF. */
export function contaDoExtrato(info: Pick<InfoExtrato, 'conta'>, empresa: Empresa): ContaBancaria | null {
  if (!empresa.contas.length) return null
  const lida = somenteDigitos(info.conta)
  if (lida) {
    const achou = empresa.contas.find((c) => {
      const cadastrada = somenteDigitos(c.conta)
      if (!cadastrada) return false
      if (cadastrada === lida) return true
      // aceita diferença só no dígito verificador ou zeros/prefixos a mais
      if (lida.length > 3 && cadastrada.slice(0, -1) === lida.slice(0, -1)) return true
      return Math.min(cadastrada.length, lida.length) >= 4 && (lida.endsWith(cadastrada) || cadastrada.endsWith(lida))
    })
    if (achou) return achou
  }
  // PDF sem número de conta: usa a primeira conta da empresa
  return info.conta ? null : empresa.contas[0]
}

/** Tenta descobrir de qual empresa é o extrato: primeiro pela conta, depois pelo CNPJ. */
export function empresaDoExtrato(info: InfoExtrato, empresas: Empresa[]): Empresa | null {
  const doc = somenteDigitos(info.documento)
  return (
    empresas.find((e) => info.conta && contaDoExtrato(info, e)) ??
    empresas.find((e) => doc && somenteDigitos(e.cnpj) === doc) ??
    null
  )
}

/**
 * Entrada (C): debita o banco e credita a contrapartida.
 * Saída (D): debita a contrapartida e credita o banco.
 */
export function montarPartida(lancamento: Lancamento, empresa: Empresa, contaBanco: ContaBancaria | null): Partida {
  const classificacao = classificar(lancamento, empresa)
  const contrapartida = (lancamento.contrapartida || classificacao.conta || '').trim()
  const banco = (contaBanco?.codigo ?? '').trim()
  return {
    ...classificacao,
    contrapartida,
    debito: lancamento.tipo === 'C' ? banco : contrapartida,
    credito: lancamento.tipo === 'C' ? contrapartida : banco,
  }
}

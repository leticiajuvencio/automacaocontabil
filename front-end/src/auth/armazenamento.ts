import type { Sessao } from '../api/tipos'

const CHAVE = 'automacao-contabil:sessao'

export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Sessao) : null
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao) {
  localStorage.setItem(CHAVE, JSON.stringify(sessao))
}

export function limparSessao() {
  localStorage.removeItem(CHAVE)
}

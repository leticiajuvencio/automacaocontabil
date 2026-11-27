import type { InfoExtrato, OrigemTipo } from '../api/tipos'

/** Lançamento como sai do leitor, antes da revisão. */
export interface LancamentoLido {
  data: string
  historico: string
  detalhe: string
  documento: string
  valor: number
  tipo: 'C' | 'D'
  origemTipo: OrigemTipo
}

export interface ResultadoLeitura {
  info: InfoExtrato
  lancamentos: LancamentoLido[]
  /** "Leitor BB", "Leitura automática" ou "PDF de imagem" */
  metodo: string
  aviso: string
  textoPdf: string
  paginas: number
}

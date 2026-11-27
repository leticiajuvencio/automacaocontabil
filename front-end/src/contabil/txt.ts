// Arquivo de importação de lançamentos contábeis do Domínio (planilha modelo, 10 colunas).
// No Domínio: Utilitários > Importação > Importador > Importar, tipo TXT,
// conjunto de dados "Lançamentos Contábeis (Partida Simples/Multiplas) (3.1) (Excel (3.1))".

import type { Empresa, Extrato, Lancamento, OpcoesArquivo } from '../api/tipos'
import { dataOrdenavel, normalizar } from '../lib/formatar'
import { contaDoExtrato, montarPartida, type Partida } from './classificar'

export const COLUNAS_DOMINIO = [
  'Data',
  'Cód. Conta Débito',
  'Cód. Conta Crédito',
  'Valor',
  'Cód. Histórico',
  'Complemento Histórico',
  'Inicia Lote',
  'Código Matriz/Filial',
  'Centro de Custo Débito',
  'Centro de Custo Crédito',
]

export interface LinhaArquivo {
  lancamento: Lancamento
  extrato: Extrato
  partida: Partida
  colunas: string[]
}

function limparTexto(texto: string, opcoes: OpcoesArquivo): string {
  // tira quebras e o próprio separador de dentro do texto
  let limpo = texto.replace(/[\r\n\t;|]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (opcoes.semAcentos) limpo = limpo.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (opcoes.maiusculas) limpo = limpo.toUpperCase()
  return limpo
}

/** Uma linha por lançamento incluído, em ordem de data. */
export function montarLinhas(extratos: Extrato[], empresa: Empresa): LinhaArquivo[] {
  const opcoes = empresa.opcoes
  const linhas: LinhaArquivo[] = []

  for (const extrato of extratos) {
    const contaBanco = contaDoExtrato(extrato.info, empresa)
    for (const lancamento of extrato.lancamentos) {
      if (!lancamento.incluir) continue
      const partida = montarPartida(lancamento, empresa, contaBanco)
      // aplicação automática (Rende Fácil) quando a empresa está configurada para ignorar
      if (partida.ignorado) continue

      let complemento = lancamento.historico + (lancamento.detalhe ? ' - ' + lancamento.detalhe : '')
      if (opcoes.documentoNoComplemento && lancamento.documento) complemento += ' DOC ' + lancamento.documento

      linhas.push({
        lancamento,
        extrato,
        partida,
        colunas: [
          lancamento.data,
          partida.debito,
          partida.credito,
          lancamento.valor.toFixed(2).replace('.', ','),
          partida.historico.trim(),
          limparTexto(complemento, opcoes),
          opcoes.iniciaLote === 'cada' ? '1' : '',
          opcoes.filial.trim(),
          opcoes.centroCustoDebito.trim(),
          opcoes.centroCustoCredito.trim(),
        ],
      })
    }
  }

  return linhas.sort((a, b) => dataOrdenavel(a.lancamento.data).localeCompare(dataOrdenavel(b.lancamento.data)))
}

export function montarTxt(linhas: LinhaArquivo[], opcoes: OpcoesArquivo): string {
  const separador = opcoes.separador === 'tab' ? '\t' : opcoes.separador
  const texto = linhas.map((l) => l.colunas.join(separador))
  if (opcoes.cabecalho) {
    const cabecalho = COLUNAS_DOMINIO.map((c) => (opcoes.semAcentos ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c))
    texto.unshift(cabecalho.join(separador))
  }
  // o Domínio roda no Windows: quebra de linha \r\n
  return texto.length ? texto.join('\r\n') + '\r\n' : ''
}

// caracteres do Windows-1252 que ficam fora da faixa Latin-1
const WINDOWS_1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
}

/** Converte o texto para ANSI (Windows-1252); o que não existe vira "?". */
export function paraAnsi(texto: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    bytes[i] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : (WINDOWS_1252[c] ?? 0x3f)
  }
  return bytes
}

/** Ex.: "123_MARIMAR_CONFECCOES_20260801_20260831" */
export function nomeBase(empresa: Empresa, linhas: LinhaArquivo[]): string {
  const datas = linhas.map((l) => dataOrdenavel(l.lancamento.data)).sort()
  const nome = normalizar(empresa.razaoSocial).replace(/[^A-Z0-9]+/g, '_').slice(0, 30).replace(/_+$/, '') || 'EMPRESA'
  const comCodigo = empresa.codigoDominio ? `${empresa.codigoDominio}_${nome}` : nome
  return datas.length ? `${comCodigo}_${datas[0]}_${datas[datas.length - 1]}` : comCodigo
}

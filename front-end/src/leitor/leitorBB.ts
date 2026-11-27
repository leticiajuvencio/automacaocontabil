// Leitor do extrato de conta corrente do Banco do Brasil.
// O PDF do BB tem as colunas Lote, Documento, Histórico e Valor; usamos a posição (x, y)
// dos títulos das colunas para saber de qual coluna é cada texto.

import { normalizar } from '../lib/formatar'
import type { ItemPdf } from './pdf'
import type { LancamentoLido } from './tipos'

export function ehLeiauteBB(itens: ItemPdf[]): boolean {
  const textos = new Set(itens.map((i) => normalizar(i.texto)))
  return (
    textos.has('LOTE') &&
    textos.has('DOCUMENTO') &&
    textos.has('HISTORICO') &&
    itens.some((i) => /Extrato de Conta Corrente/i.test(i.texto))
  )
}

interface LinhaBB {
  data: string
  documento: string
  historico: string
  detalhe: string
  valor: number | null
  sinal: string | null
}

const reData = /^\d{2}\/\d{2}\/\d{4}$/
const reValor = /^([\d.]+,\d{2})\s*\(([+-])\)$/
const paraNumero = (texto: string) => parseFloat(texto.replace(/\./g, '').replace(',', '.'))

export function lerExtratoBB(itens: ItemPdf[]) {
  const textoTodo = itens.map((i) => i.texto).join(' ')
  const info = {
    cliente: textoTodo.match(/Cliente\s+(.+?)\s+Ag[eê]ncia/i)?.[1] ?? '',
    agencia: textoTodo.match(/Ag[eê]ncia:\s*([\d-]+)/i)?.[1] ?? '',
    conta: textoTodo.match(/Conta:\s*([\d-]+X?)/i)?.[1] ?? '',
    saldoAnterior: null as number | null,
    saldoFinal: null as number | null,
  }

  let colunas: { lote: number; documento: number; historico: number } | null = null
  const linhas: LinhaBB[] = []
  const paginas = [...new Set(itens.map((i) => i.pagina))].sort((a, b) => a - b)

  for (const pagina of paginas) {
    const daPagina = itens.filter((i) => i.pagina === pagina && i.texto.trim())
    const titulo = (nome: string) => daPagina.find((i) => normalizar(i.texto) === nome)
    const lote = titulo('LOTE')
    const documento = titulo('DOCUMENTO')
    const historico = titulo('HISTORICO')
    if (lote && documento && historico) colunas = { lote: lote.x, documento: documento.x, historico: historico.x }
    if (!colunas) continue
    const col = colunas

    // cada data na primeira coluna abre um lançamento, que vai até a próxima data
    const yCabecalho = historico ? historico.y : -1
    const datas = daPagina
      .filter((i) => reData.test(i.texto.trim()) && i.x < col.lote - 5 && i.y > yCabecalho)
      .sort((a, b) => a.y - b.y)

    datas.forEach((itemData, k) => {
      const topo = itemData.y - 7
      const fundo = k + 1 < datas.length ? datas[k + 1].y - 7 : itemData.y + 22
      const celula = daPagina.filter((i) => i !== itemData && i.y >= topo && i.y < fundo && i.x >= col.lote - 5)

      let valor: number | null = null
      let sinal: string | null = null
      const docs: ItemPdf[] = []
      const hist: ItemPdf[] = []
      for (const item of celula) {
        const achou = item.texto.trim().match(reValor)
        if (achou && item.x > col.historico) {
          valor = paraNumero(achou[1])
          sinal = achou[2]
        } else if (item.x >= col.historico - 5) hist.push(item)
        else if (item.x >= col.documento - 5) docs.push(item)
      }

      // o histórico pode ocupar mais de uma linha: a 1ª é o tipo, as outras o detalhe
      hist.sort((a, b) => a.y - b.y || a.x - b.x)
      const partes: { y: number; texto: string }[] = []
      for (const item of hist) {
        const ultima = partes[partes.length - 1]
        if (ultima && Math.abs(ultima.y - item.y) < 3) ultima.texto += ' ' + item.texto.trim()
        else partes.push({ y: item.y, texto: item.texto.trim() })
      }

      linhas.push({
        data: itemData.texto.trim(),
        documento: docs.map((i) => i.texto.trim()).join(' '),
        historico: partes[0]?.texto ?? '',
        detalhe: partes.slice(1).map((p) => p.texto).join(' '),
        valor,
        sinal,
      })
    })
  }

  const lancamentos: LancamentoLido[] = []
  for (const linha of linhas) {
    const tipo = normalizar(linha.historico)
    // linhas de saldo não são lançamentos, mas guardamos o saldo
    if (linha.data === '00/00/0000' || /^SALDO/.test(tipo) || tipo === 'S A L D O') {
      const v = linha.sinal === '-' ? -(linha.valor ?? 0) : linha.valor
      if (/SALDO ANTERIOR/.test(tipo)) info.saldoAnterior = v
      if (tipo === 'S A L D O' || tipo === 'SALDO') info.saldoFinal = v
      continue
    }
    if (linha.valor == null) continue
    lancamentos.push({
      data: linha.data,
      historico: linha.historico,
      detalhe: linha.detalhe,
      documento: linha.documento,
      valor: linha.valor,
      tipo: linha.sinal === '-' ? 'D' : 'C',
      origemTipo: 'extrato',
    })
  }

  return { info, lancamentos }
}

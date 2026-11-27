// Leitor genérico: tenta ler o extrato de qualquer banco que tenha texto no PDF.
// 1) junta os pedaços de texto em linhas (mesmo y)
// 2) acha a linha de cabeçalho (Data, Histórico, Valor, Saldo...) para saber onde fica cada coluna
// 3) em cada linha com data e valor, monta um lançamento; linhas sem valor viram detalhe do anterior
// 4) entrada ou saída: pelo sinal do PDF, pela coluna (débito/crédito), pela conta do saldo ou pelo texto

import { normalizar } from '../lib/formatar'
import type { InfoExtrato, OrigemTipo } from '../api/tipos'
import type { ItemPdf } from './pdf'
import type { LancamentoLido } from './tipos'

interface LinhaPdf {
  pagina: number
  y: number
  itens: ItemPdf[]
  texto: string
}

interface ValorAchado {
  valor: number
  sinal: '+' | '-' | null
  texto: string
  posicao: number
  tamanho: number
  x: number
}

const MESES: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 }

const BANCOS: [string, string][] = [
  ['BANCO DO BRASIL', 'Banco do Brasil'], ['BB RENDE', 'Banco do Brasil'], ['CAIXA ECONOMICA', 'Caixa Econômica Federal'],
  ['ITAU', 'Itaú'], ['BRADESCO', 'Bradesco'], ['SANTANDER', 'Santander'], ['SICOOB', 'Sicoob'], ['SICREDI', 'Sicredi'],
  ['NU PAGAMENTOS', 'Nubank'], ['NUBANK', 'Nubank'], ['BANCO INTER', 'Banco Inter'], ['BTG PACTUAL', 'BTG Pactual'],
  ['C6 BANK', 'C6 Bank'], ['BANCO C6', 'C6 Bank'], ['BANRISUL', 'Banrisul'], ['SAFRA', 'Safra'], ['MERCADO PAGO', 'Mercado Pago'],
  ['PAGSEGURO', 'PagBank'], ['PAGBANK', 'PagBank'], ['AILOS', 'Ailos'], ['VIACREDI', 'Viacredi (Ailos)'], ['CRESOL', 'Cresol'],
  ['UNICRED', 'Unicred'], ['STONE', 'Stone'], ['BANCO ORIGINAL', 'Banco Original'], ['NEON', 'Neon'], ['PICPAY', 'PicPay'],
  ['BANESTES', 'Banestes'], ['BRB', 'BRB'], ['SISPRIME', 'Sisprime'], ['ASAAS', 'Asaas'], ['CORA', 'Cora'], ['CAIXA', 'Caixa Econômica Federal'],
]

// valor em reais com sinal antes ou depois: "-1.234,56", "1.234,56 D", "(+) 10,00", "R$ 5,00"
const RE_VALOR = /(?:\(?([+-])\)?\s*)?(?:R\$\s*)?(-)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?:\s*(\([+-]\)|[-+]|\s[DC]\b|[DC]\b))?/g

const PALAVRAS_CABECALHO = ['DATA', 'HISTORICO', 'DESCRICAO', 'LANCAMENTO', 'LANCAMENTOS', 'VALOR', 'SALDO', 'DEBITO', 'CREDITO', 'DOCUMENTO', 'DOC', 'MOVIMENTACAO', 'ENTRADAS', 'SAIDAS']

const PULAR = /^(SALDO|S A L D O|TOTAL|SUBTOTAL|RESUMO|LIMITE|ENCARGOS|JUROS PREVISTOS)/

const PALAVRAS_ENTRADA = /(RECEB|CREDITO|DEPOSITO|ESTORNO|RESGATE|ENTRADA|DEVOLUCAO|REND|LIQUIDACAO DE COBRANCA|TED RECEBIDA|PIX RECEBIDO)/

/** Junta os pedaços de texto que estão na mesma altura da página. */
function juntarLinhas(itens: ItemPdf[]): LinhaPdf[] {
  const linhas: LinhaPdf[] = []
  const paginas = [...new Set(itens.map((i) => i.pagina))].sort((a, b) => a - b)
  for (const pagina of paginas) {
    const daPagina = itens.filter((i) => i.pagina === pagina && i.texto.trim()).sort((a, b) => a.y - b.y || a.x - b.x)
    const linhasDaPagina: LinhaPdf[] = []
    for (const item of daPagina) {
      const linha = linhasDaPagina.find((l) => Math.abs(l.y - item.y) < 2.6)
      if (linha) linha.itens.push(item)
      else linhasDaPagina.push({ pagina, y: item.y, itens: [item], texto: '' })
    }
    for (const linha of linhasDaPagina) {
      linha.itens.sort((a, b) => a.x - b.x)
      linha.texto = linha.itens.map((i) => i.texto.trim()).join(' ')
    }
    linhasDaPagina.sort((a, b) => a.y - b.y)
    linhas.push(...linhasDaPagina)
  }
  return linhas
}

function acharValores(texto: string): Omit<ValorAchado, 'x'>[] {
  const valores: Omit<ValorAchado, 'x'>[] = []
  for (const achou of texto.matchAll(RE_VALOR)) {
    let sinal: '+' | '-' | null = null
    if (achou[1]) sinal = achou[1] as '+' | '-'
    if (achou[2]) sinal = '-'
    const sufixo = (achou[4] ?? '').trim()
    if (sufixo === '(-)' || sufixo === '-' || sufixo === 'D') sinal = '-'
    if (sufixo === '(+)' || sufixo === '+' || sufixo === 'C') sinal = '+'
    valores.push({
      valor: parseFloat(achou[3].replace(/\./g, '').replace(',', '.')),
      sinal,
      texto: achou[0],
      posicao: achou.index ?? 0,
      tamanho: achou[0].length,
    })
  }
  return valores
}

/** Aceita 02/08/2026, 02/08/26, 02/08 (usa o ano do extrato) e 02 AGO 2026. Devolve dd/mm/aaaa ou null. */
export function lerData(texto: string, anoPadrao: string): string | null {
  let d: string | null = null
  let m: RegExpMatchArray | null
  if ((m = texto.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/))) d = `${m[1]}/${m[2]}/${m[3]}`
  else if ((m = texto.match(/^(\d{2})[/.-](\d{2})[/.-](\d{2})$/))) d = `${m[1]}/${m[2]}/20${m[3]}`
  else if ((m = texto.match(/^(\d{2})\/(\d{2})$/))) d = `${m[1]}/${m[2]}/${anoPadrao}`
  else if ((m = normalizar(texto).match(/^(\d{1,2})[ /-]?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\.?(?:[ /-]?(\d{4}|\d{2}))?$/))) {
    const ano = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : anoPadrao
    d = `${m[1].padStart(2, '0')}/${String(MESES[m[2]]).padStart(2, '0')}/${ano}`
  }
  if (!d) return null
  const [dia, mes, ano] = d.split('/').map(Number)
  return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && ano > 1990 ? d : null
}

/** Banco, cliente, CNPJ/CPF, agência, conta e período que aparecem no cabeçalho do extrato. */
export function lerInfo(texto: string): InfoExtrato {
  const semAcento = normalizar(texto)
  const banco = BANCOS.find(([chave]) => new RegExp('\\b' + chave + '\\b').test(semAcento))?.[1] ?? ''
  const pegar = (re: RegExp) => texto.match(re)?.[1] ?? ''
  return {
    banco,
    cliente:
      pegar(/(?:Cliente|Titular|Nome|Raz[aã]o Social|Correntista|Associado|Cooperado|Empresa)\s*:\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 &.,'\-/]{3,80}?)(?=\s{2,}|\s+(?:Ag[eê]ncia|CNPJ|CPF|Conta|Per[ií]odo|Data)\b|\s*$)/im) ||
      pegar(/(?:^|\n)\s*([A-ZÀ-Ú][A-ZÀ-Ú0-9 &.-]{4,70}?)\s+(?:CNPJ|CPF)\b/),
    documento: pegar(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\b/),
    agencia: pegar(/(?:Ag(?:[eê]ncia|\.)?|Cooperativa)\s*(?:n[º°o.]*)?\s*:?\s*(\d{3,5}(?:-[\dXx])?)/i),
    conta: pegar(/Conta(?:\s+Corrente)?\s*(?:n[º°o.]*)?\s*:?\s*(\d[\d.]{2,14}-?[\dXx]?)/i),
    periodo: pegar(/(\d{2}\/\d{2}\/\d{4}\s*(?:a|at[eé]|-|à)\s*\d{2}\/\d{2}\/\d{4})/i),
    saldoAnterior: null,
    saldoFinal: null,
  }
}

export function lerExtratoGenerico(itens: ItemPdf[]) {
  const linhas = juntarLinhas(itens)
  const textoTodo = linhas.map((l) => l.texto).join('\n')
  const info = lerInfo(textoTodo)

  // ano mais comum nas datas completas, para datas que vêm só com dia/mês
  const contagem: Record<string, number> = {}
  for (const d of textoTodo.match(/\b\d{2}\/\d{2}\/(20\d{2})\b/g) ?? []) {
    const ano = d.slice(-4)
    contagem[ano] = (contagem[ano] ?? 0) + 1
  }
  const anoPadrao = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0] ?? String(new Date().getFullYear())

  // linha de cabeçalho das colunas: guardamos o centro (x) de Saldo, Débito, Crédito e Valor
  let colunas: { saldo: number | null; debito: number | null; credito: number | null; valor: number | null } | null = null
  let indiceCabecalho = -1
  const cabecalhos = new Set<number>()
  linhas.forEach((linha, i) => {
    const palavras = linha.itens.map((it) => ({
      palavra: normalizar(it.texto).replace(/[^A-Z ]/g, '').trim(),
      centro: it.x + (it.largura || 0) / 2,
    }))
    const tem = (p: string) => PALAVRAS_CABECALHO.includes(p) || PALAVRAS_CABECALHO.some((k) => p.split(' ').includes(k))
    if (palavras.filter((p) => tem(p.palavra)).length < 3 || /\d,\d{2}/.test(linha.texto)) return
    const centroDe = (chaves: string[]) =>
      palavras.find((p) => chaves.some((k) => p.palavra === k || p.palavra.split(' ').includes(k)))?.centro ?? null
    cabecalhos.add(i)
    if (!colunas) {
      colunas = {
        saldo: centroDe(['SALDO']),
        debito: centroDe(['DEBITO', 'SAIDAS', 'DEBITOS']),
        credito: centroDe(['CREDITO', 'ENTRADAS', 'CREDITOS']),
        valor: centroDe(['VALOR']),
      }
      indiceCabecalho = i
    }
  })
  const cols = colunas as { saldo: number | null; debito: number | null; credito: number | null; valor: number | null } | null
  const distancia = (x: number, coluna: number | null) => (coluna == null ? Infinity : Math.abs(x - coluna))

  const lancamentos: (LancamentoLido & { pagina: number; y: number })[] = []
  let ultimaData: string | null = null
  let atual: (LancamentoLido & { pagina: number; y: number }) | null = null
  let ultimoSaldo: number | null = null
  let sinalDaSecao: '+' | '-' | null = null

  linhas.forEach((linha, i) => {
    if (cabecalhos.has(i) || (i <= indiceCabecalho && linha.pagina === linhas[indiceCabecalho]?.pagina)) {
      atual = null
      return
    }

    // valores da linha, com a posição x de cada um
    const valores: ValorAchado[] = []
    for (const it of linha.itens) {
      for (const v of acharValores(it.texto)) {
        const fracao = (v.posicao + v.tamanho / 2) / Math.max(it.texto.length, 1)
        valores.push({ ...v, x: it.x + (it.largura || it.texto.length * 5) * fracao })
      }
    }

    // data no começo da linha (pode estar quebrada em até 3 pedaços, ex.: "02" "AGO" "2026")
    let data: string | null = null
    let resto = linha.texto
    const primeiros = linha.itens.slice(0, 3).map((it) => it.texto.trim())
    for (let k = 1; k <= primeiros.length && !data; k++) {
      const d = lerData(primeiros.slice(0, k).join(' '), anoPadrao)
      if (d) {
        data = d
        resto = linha.itens.slice(k).map((it) => it.texto.trim()).join(' ')
      }
    }
    if (!data) {
      const m = linha.texto.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.*)$/)
      const d = m ? lerData(m[1], anoPadrao) : null
      if (m && d) {
        data = d
        resto = m[2]
      }
    }
    // linha só com a data (cabeçalho do dia)
    if (data && !valores.length && normalizar(resto).length < 3) {
      ultimaData = data
      sinalDaSecao = null
      return
    }

    let descricao = resto
    for (const v of valores) descricao = descricao.replace(v.texto, ' ')
    descricao = descricao.replace(/\s+/g, ' ').trim()
    const desc = normalizar(descricao)

    if (!valores.length) {
      if (/^TOTAL DE ENTRADAS|^ENTRADAS$/.test(desc)) {
        sinalDaSecao = '+'
        atual = null
      } else if (/^TOTAL DE SAIDAS|^SAIDAS$/.test(desc)) {
        sinalDaSecao = '-'
        atual = null
      } else if (
        atual &&
        linha.pagina === atual.pagina &&
        linha.y - atual.y < 26 &&
        !data &&
        desc &&
        !PULAR.test(desc) &&
        !PALAVRAS_CABECALHO.includes(desc) &&
        desc.length < 90
      ) {
        // continuação da descrição do lançamento anterior
        atual.detalhe = (atual.detalhe ? atual.detalhe + ' ' : '') + descricao
        atual.y = linha.y
      } else if (data && desc) {
        ultimaData = data
        atual = null
      } else atual = null
      return
    }

    if (data) ultimaData = data

    // separa o valor do lançamento do saldo da linha
    let valor: ValorAchado | null = null
    let saldo: ValorAchado | null = null
    let sinalDaColuna: '+' | '-' | null = null
    if (cols && (cols.saldo != null || cols.debito != null || cols.credito != null)) {
      for (const v of valores) {
        const perto = {
          saldo: distancia(v.x, cols.saldo),
          debito: distancia(v.x, cols.debito),
          credito: distancia(v.x, cols.credito),
          valor: distancia(v.x, cols.valor),
        }
        const coluna = Object.entries(perto).sort((a, b) => a[1] - b[1])[0][0]
        if (coluna === 'saldo') saldo = v
        else {
          valor = valor ?? v
          if (coluna === 'debito') sinalDaColuna = '-'
          if (coluna === 'credito') sinalDaColuna = '+'
        }
      }
      if (!valor && saldo && valores.length === 1 && cols.saldo == null) {
        valor = saldo
        saldo = null
      }
    } else {
      valor = valores[0]
      if (valores.length >= 2) saldo = valores[valores.length - 1]
    }

    if (/^TOTAL DE ENTRADAS|^ENTRADAS\b/.test(desc)) {
      sinalDaSecao = '+'
      atual = null
      return
    }
    if (/^TOTAL DE SAIDAS|^SAIDAS\b/.test(desc)) {
      sinalDaSecao = '-'
      atual = null
      return
    }
    if (PULAR.test(desc) || (!valor && saldo)) {
      const s = saldo ?? valor
      if (s) {
        const v = s.sinal === '-' ? -s.valor : s.valor
        if (/ANTERIOR/.test(desc) && info.saldoAnterior == null) info.saldoAnterior = v
        if (/SALDO/.test(desc)) {
          info.saldoFinal = v
          ultimoSaldo = v
        }
      }
      atual = null
      return
    }
    if (!valor || !ultimaData || (!desc && !data)) {
      atual = null
      return
    }

    // entrada ou saída?
    let sinal = valor.sinal ?? sinalDaColuna
    let origem: OrigemTipo = 'extrato'
    const valorSaldo = saldo ? (saldo.sinal === '-' ? -saldo.valor : saldo.valor) : null
    if (!sinal && valorSaldo != null && ultimoSaldo != null) {
      const diferenca = Math.round((valorSaldo - ultimoSaldo) * 100) / 100
      if (Math.abs(Math.abs(diferenca) - valor.valor) < 0.011) {
        sinal = diferenca >= 0 ? '+' : '-'
        origem = 'saldo'
      }
    }
    if (!sinal && sinalDaSecao) {
      sinal = sinalDaSecao
      origem = 'secao'
    }
    if (!sinal) {
      const pedacos = linha.itens.map((it) => normalizar(it.texto))
      if (pedacos.includes('D')) sinal = '-'
      else if (pedacos.includes('C')) sinal = '+'
      else sinal = PALAVRAS_ENTRADA.test(desc) ? '+' : '-'
      origem = 'deduzido'
    }
    if (valorSaldo != null) ultimoSaldo = valorSaldo

    // número do documento: um número sozinho com 4 dígitos ou mais
    let documento = ''
    const partes = descricao.split(' ')
    const posDoc = partes.findIndex((p) => /^\d{4,}$/.test(p.replace(/[.\-/]/g, '')) && !p.includes(','))
    if (posDoc >= 0 && partes.length > 1) {
      documento = partes[posDoc]
      partes.splice(posDoc, 1)
    }

    atual = {
      data: ultimaData,
      historico: partes.join(' ').trim() || '(sem descrição)',
      detalhe: '',
      documento,
      valor: valor.valor,
      tipo: sinal === '+' ? 'C' : 'D',
      origemTipo: origem,
      pagina: linha.pagina,
      y: linha.y,
    }
    lancamentos.push(atual)
  })

  return {
    info,
    lancamentos: lancamentos.map(({ pagina: _p, y: _y, ...l }) => l),
    linhas,
  }
}

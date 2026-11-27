// Planilha Excel com até três abas: Importação (mesmas colunas do TXT), Extrato (todas as linhas) e Resumo.
// Datas e valores vão como número, para a pessoa conseguir somar e filtrar no Excel.

import type * as XLSX from 'xlsx'
import type { Empresa, Extrato } from '../api/tipos'
import { dataOrdenavel } from '../lib/formatar'
import { contaDoExtrato, montarPartida } from './classificar'
import { COLUNAS_DOMINIO, type LinhaArquivo } from './txt'

type Celula = string | number | null | XLSX.CellObject

export interface Aba {
  nome: string
  cabecalho: string[]
  linhas: Celula[][]
  larguras: number[]
}

/** "02/08/2026" → célula de data do Excel (número de dias desde 30/12/1899) */
function celulaData(data: string): XLSX.CellObject {
  const [dia, mes, ano] = data.split('/').map(Number)
  const dias = (Date.UTC(ano, mes - 1, dia) - Date.UTC(1899, 11, 30)) / 86_400_000
  return { t: 'n', v: dias, z: 'dd/mm/yyyy' }
}

function celulaValor(valor: number): XLSX.CellObject {
  return { t: 'n', v: valor, z: '#,##0.00' }
}

/** Código de conta vira número quando é só dígito (o Domínio espera número). */
function codigo(texto: string): string | number | null {
  const limpo = texto.trim()
  if (!limpo) return null
  return /^\d+$/.test(limpo) ? Number(limpo) : limpo
}

export function montarAbas(linhas: LinhaArquivo[], extratos: Extrato[], empresa: Empresa): Aba[] {
  const abas: Aba[] = []
  const { opcoes } = empresa

  if (opcoes.abaImportacao) {
    abas.push({
      nome: 'Planilha1',
      cabecalho: COLUNAS_DOMINIO,
      linhas: linhas.map(({ lancamento, colunas }) => [
        celulaData(lancamento.data),
        codigo(colunas[1]),
        codigo(colunas[2]),
        celulaValor(lancamento.valor),
        codigo(colunas[4]),
        colunas[5] || null,
        codigo(colunas[6]),
        codigo(colunas[7]),
        codigo(colunas[8]),
        codigo(colunas[9]),
      ]),
      larguras: [12, 18, 18, 14, 14, 58, 12, 20, 22, 22],
    })
  }

  if (opcoes.abaExtrato) {
    abas.push({
      nome: 'Extrato',
      cabecalho: ['Data', 'Documento', 'Histórico', 'Detalhe', 'Valor', 'D/C', 'No TXT', 'Regra', 'Contrapartida', 'Banco', 'Arquivo'],
      linhas: extratos.flatMap((extrato) => {
        const contaBanco = contaDoExtrato(extrato.info, empresa)
        return extrato.lancamentos.map((l) => {
          const partida = montarPartida(l, empresa, contaBanco)
          const noTxt = l.incluir && !partida.ignorado
          return [
            celulaData(l.data),
            l.documento || null,
            l.historico,
            l.detalhe || null,
            celulaValor(l.tipo === 'D' ? -l.valor : l.valor),
            l.tipo,
            noTxt ? 'Sim' : 'Não',
            partida.ignorado ? 'Rende Fácil (ignorado)' : partida.regra,
            noTxt ? codigo(partida.contrapartida) : null,
            extrato.banco || null,
            extrato.nomeArquivo,
          ]
        })
      }),
      larguras: [12, 18, 28, 42, 14, 6, 8, 30, 14, 20, 40],
    })
  }

  if (opcoes.abaResumo) {
    abas.push({
      nome: 'Resumo',
      cabecalho: ['Arquivo', 'Banco', 'Cliente', 'CNPJ/CPF', 'Agência', 'Conta', 'Data inicial', 'Data final', 'Lançamentos', 'Entradas', 'Saídas', 'Saldo anterior', 'Saldo final'],
      linhas: extratos
        .filter((e) => e.lancamentos.length)
        .map((e) => {
          const datas = e.lancamentos.map((l) => l.data).sort((a, b) => dataOrdenavel(a).localeCompare(dataOrdenavel(b)))
          const soma = (tipo: 'C' | 'D') => e.lancamentos.filter((l) => l.tipo === tipo).reduce((t, l) => t + l.valor, 0)
          return [
            e.nomeArquivo,
            e.banco,
            e.info.cliente || null,
            e.info.documento || null,
            e.info.agencia || null,
            e.info.conta || null,
            celulaData(datas[0]),
            celulaData(datas[datas.length - 1]),
            e.lancamentos.length,
            celulaValor(soma('C')),
            celulaValor(soma('D')),
            e.info.saldoAnterior != null ? celulaValor(e.info.saldoAnterior) : null,
            e.info.saldoFinal != null ? celulaValor(e.info.saldoFinal) : null,
          ]
        }),
      larguras: [40, 16, 32, 20, 10, 10, 12, 12, 12, 14, 14, 14, 14],
    })
  }

  return abas
}

export async function montarExcel(abas: Aba[]): Promise<ArrayBuffer> {
  // a biblioteca do Excel só é baixada quando a pessoa clica em "Baixar Excel"
  const XLSX = await import('xlsx')
  const planilha = XLSX.utils.book_new()
  for (const aba of abas) {
    const folha = XLSX.utils.aoa_to_sheet([aba.cabecalho, ...aba.linhas])
    folha['!cols'] = aba.larguras.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(planilha, folha, aba.nome)
  }
  return XLSX.write(planilha, { type: 'array', bookType: 'xlsx' })
}

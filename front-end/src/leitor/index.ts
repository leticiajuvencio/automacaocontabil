import { ehLeiauteBB, lerExtratoBB } from './leitorBB'
import { lerExtratoGenerico } from './leitorGenerico'
import { lerTextoDoPdf } from './pdf'
import type { ResultadoLeitura } from './tipos'

export type { LancamentoLido, ResultadoLeitura } from './tipos'

/** Lê o PDF do extrato no navegador e devolve os dados da conta e os lançamentos encontrados. */
export async function lerExtrato(arquivo: File): Promise<ResultadoLeitura> {
  const { itens, paginas } = await lerTextoDoPdf(arquivo)
  const generico = lerExtratoGenerico(itens)

  // texto do PDF por linha, para a pessoa conferir na revisão
  const textoPdf = generico.linhas
    .map((linha, i) => {
      const novaPagina = i > 0 && linha.pagina !== generico.linhas[i - 1].pagina
      return (novaPagina ? `\n— página ${linha.pagina} —\n` : '') + linha.texto
    })
    .join('\n')

  // PDF escaneado (imagem) quase não tem texto
  const caracteres = itens.reduce((total, i) => total + i.texto.trim().length, 0)
  if (caracteres < 40 * paginas) {
    return {
      info: generico.info,
      lancamentos: [],
      metodo: 'PDF de imagem',
      aviso: 'Este PDF é uma imagem, sem texto. Inclua os lançamentos à mão na revisão.',
      textoPdf,
      paginas,
    }
  }

  if (ehLeiauteBB(itens)) {
    const bb = lerExtratoBB(itens)
    return {
      info: {
        ...generico.info,
        banco: 'Banco do Brasil',
        cliente: bb.info.cliente || generico.info.cliente,
        agencia: bb.info.agencia || generico.info.agencia,
        conta: bb.info.conta || generico.info.conta,
        saldoAnterior: bb.info.saldoAnterior ?? generico.info.saldoAnterior,
        saldoFinal: bb.info.saldoFinal ?? generico.info.saldoFinal,
      },
      lancamentos: bb.lancamentos,
      metodo: 'Leitor BB',
      aviso: bb.lancamentos.length ? '' : 'Não encontrei lançamentos neste extrato. Inclua à mão na revisão.',
      textoPdf,
      paginas,
    }
  }

  return {
    info: generico.info,
    lancamentos: generico.lancamentos,
    metodo: 'Leitura automática',
    aviso: generico.lancamentos.length
      ? ''
      : 'Não reconheci lançamentos neste leiaute. Confira o texto do PDF e inclua à mão na revisão.',
    textoPdf,
    paginas,
  }
}

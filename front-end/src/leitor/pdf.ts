import * as pdfjs from 'pdfjs-dist'
import enderecoWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// O PDF.js lê o PDF numa thread separada (worker); o Vite entrega o endereço do arquivo.
pdfjs.GlobalWorkerOptions.workerSrc = enderecoWorker

/** Um pedaço de texto do PDF e onde ele está na página. */
export interface ItemPdf {
  pagina: number
  x: number
  /** medido de cima para baixo (no PDF o y cresce para cima, então invertemos) */
  y: number
  texto: string
  largura: number
}

export async function lerTextoDoPdf(arquivo: File): Promise<{ itens: ItemPdf[]; paginas: number }> {
  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const documento = await pdfjs.getDocument({ data: dados }).promise
  const itens: ItemPdf[] = []

  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero)
    const altura = pagina.getViewport({ scale: 1 }).height
    const conteudo = await pagina.getTextContent()

    for (const item of conteudo.items) {
      if (!('str' in item)) continue
      itens.push({
        pagina: numero,
        x: item.transform[4],
        y: altura - item.transform[5],
        texto: item.str,
        largura: item.width,
      })
    }
  }

  return { itens, paginas: documento.numPages }
}

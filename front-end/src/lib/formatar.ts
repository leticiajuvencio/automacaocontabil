const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** 1234.56 → "R$ 1.234,56" */
export function formatarMoeda(valor: number): string {
  return moeda.format(valor)
}

/** 1234.56 → "1.234,56" */
export function formatarValor(valor: number): string {
  return numero.format(valor)
}

/** Lê um valor digitado no padrão brasileiro ("1.234,56", "150") e devolve o número positivo, ou 0. */
export function lerValorDigitado(texto: string): number {
  const valor = parseFloat(texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(valor) ? Math.abs(valor) : 0
}

/** Timestamp ISO → "30/09/2026, 20:15" */
export function formatarDataHora(iso: string): string {
  return dataHora.format(new Date(iso))
}

/** "02/08/2026" → "20260802" (serve para ordenar datas) */
export function dataOrdenavel(data: string): string {
  return data.split('/').reverse().join('')
}

/** "02/08/2026" → "08/2026" */
export function competenciaDaData(data: string): string {
  return data.slice(3)
}

/** Aplica a máscara 00.000.000/0000-00 enquanto a pessoa digita. */
export function mascararCnpj(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Só os números, sem zeros à esquerda (para comparar contas e CNPJs). */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '').replace(/^0+/, '')
}

/** Tira acentos, deixa em maiúsculas e junta espaços repetidos. */
export function normalizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Duas iniciais do nome, para o "avatar" da empresa ou do banco. */
export function iniciais(nome: string): string {
  const palavras = normalizar(nome)
    .replace(/[^A-Z0-9 ]/g, '')
    .split(' ')
    .filter((p) => p.length > 2 || /\d/.test(p))
  return palavras.slice(0, 2).map((p) => p[0]).join('') || '?'
}

/** plural(3, 'extrato', 'extratos') → "3 extratos" */
export function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`
}

// data_movimento é DATE (sem hora). Para o fuso não mudar o dia, a data fica em UTC à meia-noite.

// "02/08/2026" -> Date
export function brParaDate(data: string): Date {
  const [dia, mes, ano] = data.split('/').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia!))
}

// Date -> "02/08/2026"
export function dateParaBr(data: Date): string {
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

// Confere se "dd/mm/aaaa" existe (31/02/2026 não passa)
export function dataBrValida(data: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return false
  return dateParaBr(brParaDate(data)) === data
}

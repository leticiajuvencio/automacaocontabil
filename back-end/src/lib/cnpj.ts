// "11.222.333/0001-81" -> "11222333000181"
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

// Confere os dois dígitos verificadores do CNPJ (cálculo da Receita)
export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false // 11111111111111, 00000000000000...

  const calcularDigito = (numeros: string) => {
    const pesos = numeros.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < numeros.length; i++) soma += Number(numeros[i]) * pesos[i]!
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const digito1 = calcularDigito(cnpj.slice(0, 12))
  const digito2 = calcularDigito(cnpj.slice(0, 12) + digito1)
  return cnpj.endsWith(`${digito1}${digito2}`)
}

// "11222333000181" -> "11.222.333/0001-81"
export function formatarCnpj(valor: string): string {
  return somenteDigitos(valor).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

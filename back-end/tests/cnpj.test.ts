import { describe, expect, it } from 'vitest'
import { cnpjValido, formatarCnpj, somenteDigitos } from '../src/lib/cnpj.js'

describe('cnpj', () => {
  it('aceita CNPJ com e sem máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
  })

  it('recusa dígito errado, tamanho errado e números repetidos', () => {
    expect(cnpjValido('11.222.333/0001-80')).toBe(false)
    expect(cnpjValido('1122233300018')).toBe(false)
    expect(cnpjValido('11111111111111')).toBe(false)
  })

  it('formata e tira a máscara', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(somenteDigitos('11.222.333/0001-81')).toBe('11222333000181')
  })
})

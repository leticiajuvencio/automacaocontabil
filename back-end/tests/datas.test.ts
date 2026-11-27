import { describe, expect, it } from 'vitest'
import { brParaDate, dataBrValida, dateParaBr } from '../src/lib/datas.js'

describe('datas', () => {
  it('vai e volta sem mudar o dia por causa do fuso', () => {
    expect(dateParaBr(brParaDate('02/08/2026'))).toBe('02/08/2026')
    expect(dateParaBr(brParaDate('31/12/2026'))).toBe('31/12/2026')
  })

  it('só aceita data que existe no formato dd/mm/aaaa', () => {
    expect(dataBrValida('29/02/2028')).toBe(true)
    expect(dataBrValida('29/02/2026')).toBe(false)
    expect(dataBrValida('2026-08-02')).toBe(false)
    expect(dataBrValida('2/8/2026')).toBe(false)
  })
})

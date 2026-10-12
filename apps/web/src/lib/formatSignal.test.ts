import { describe, expect, it } from 'vitest'
import i18n from 'i18next'
import { SIGNALS } from '@lifepeek/engine'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { formatBand, formatNumber, formatSignal, roundTo, unitInWords } from './formatSignal.ts'

const t = await (async () => {
  const inst = i18n.createInstance()
  await inst.init({ resources: { en: { translation: en }, hi: { translation: hi } }, lng: 'en', interpolation: { escapeValue: false } })
  return inst
})()
const tEn = t.getFixedT('en')
const tHi = t.getFixedT('hi')

const glucose = SIGNALS['blood.glucose']
const stomach = SIGNALS['gut.stomach.contentG']
const energyIn = SIGNALS['energy.inRate']

describe('formatSignal', () => {
  it('rounds to the signal display step: glucose 1, grams 5, kcal/h 5', () => {
    expect(formatSignal(118.4, glucose, tEn, 'en')).toBe('118 mg/dL')
    expect(formatSignal(343.7, stomach, tEn, 'en')).toBe('345 g')
    expect(formatSignal(212, energyIn, tEn, 'en')).toBe('210 kcal/h')
    expect(roundTo(-0.2, 5)).toBe(0)
    expect(Object.is(roundTo(-0.2, 1), 0)).toBe(true)
  })

  it('uses Latin digits and the Hindi unit in Hindi', () => {
    expect(formatSignal(1376, stomach, tHi, 'hi')).toBe('1,375 ग्राम')
    expect(formatSignal(121, glucose, tHi, 'hi')).toBe('121 mg/dL')
    expect(formatNumber(1000, stomach, 'hi')).toMatch(/^[0-9,]+$/)
  })

  it('spells the unit out and writes a between-people range', () => {
    expect(unitInWords('mg/dL', tEn)).toContain('decilitre')
    expect(unitInWords('g', tHi)).toContain('ग्राम')
    expect(formatBand(98.6, 134.2, glucose, tEn, 'en')).toBe('99–134 mg/dL')
  })
})

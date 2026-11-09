import { describe, it, expect } from 'vitest'
import { encodeIconCode, iconUrl } from '../icon'

describe('encodeIconCode', () => {
  // Pairs observed in real NEXON Open API (maplestorytw) responses.
  it.each([
    [1712001, 'KEIDJHOA'],
    [1712002, 'KEIDJHOD'],
    [1004425, 'KEPCPDME'],
    [1703722, 'KEICIAMD'],
    [30570, 'KFPBLCJB']
  ])('%i -> %s', (id, code) => {
    expect(encodeIconCode(id)).toBe(code)
  })

  it('rejects invalid ids', () => {
    expect(() => encodeIconCode(-1)).toThrow(RangeError)
    expect(() => encodeIconCode(1.5)).toThrow(RangeError)
    expect(() => encodeIconCode(100000000)).toThrow(RangeError)
  })
})

describe('iconUrl', () => {
  it('builds the NEXON static url', () => {
    expect(iconUrl(1712001)).toBe(
      'https://open.api.nexon.com/static/maplestorytw/item/icon/KEIDJHOA'
    )
  })
})

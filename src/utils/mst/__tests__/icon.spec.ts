import { describe, it, expect } from 'vitest'
import { encodeIconCode, decodeIconCode, itemIdFromIconUrl, iconUrl } from '../icon'

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

describe('decodeIconCode', () => {
  it.each([
    ['KEIDJHOA', 1712001],
    ['KEICIAMD', 1703722],
    ['KFPBLCJB', 30570]
  ])('decode %s', (c, id) => {
    expect(decodeIconCode(c)).toBe(id)
  })
  it('round-trips', () => {
    expect(decodeIconCode(encodeIconCode(1472290))).toBe(1472290)
  })
  it('rejects malformed', () => {
    expect(() => decodeIconCode('KEIDJHO')).toThrow(RangeError)
    expect(() => decodeIconCode('ZZZZZZZZ')).toThrow(RangeError)
  })
})

describe('itemIdFromIconUrl', () => {
  it('parses url', () => {
    expect(
      itemIdFromIconUrl('https://open.api.nexon.com/static/maplestorytw/item/icon/KEIDJHOA')
    ).toBe(1712001)
  })
  it('returns null for non-icon urls', () => {
    expect(itemIdFromIconUrl('https://example.com/x.png')).toBeNull()
    expect(itemIdFromIconUrl('')).toBeNull()
  })
})

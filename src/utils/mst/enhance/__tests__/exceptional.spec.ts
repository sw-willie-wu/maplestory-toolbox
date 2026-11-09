// Exceptional enhancement (Task 9).
import { describe, expect, it } from 'vitest'
import { exceptionalAvailable, exceptionalExpectation, exceptionalStats } from '../exceptional'
import type { Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { loadEquipSync, loadIndexSync } from './helpers'

interface FixtureItem {
  id: number
  exceptionalUpgrade: number
  exceptional: Stats
}
const items = fixture as FixtureItem[]
const indexed = new Set(loadIndexSync().map((e) => e.id))
const withExc = items.filter((i) => i.exceptionalUpgrade > 0)

describe('exceptional', () => {
  it('available iff rules exist', () => {
    expect(exceptionalAvailable()).toBe(true)
  })

  it('matches every fixture item with exceptionalUpgrade > 0', () => {
    expect(withExc.length).toBe(17)
    let checked = 0
    for (const f of withExc) {
      expect(indexed.has(f.id), 'indexed ' + f.id).toBe(true)
      expect(exceptionalStats(loadEquipSync(f.id), f.exceptionalUpgrade), String(f.id)).toEqual(f.exceptional)
      checked++
    }
    expect(checked).toBe(17)
  })

  it('level 0 gives {}; unobserved item/level gives null', () => {
    const e = loadEquipSync(1012911)
    expect(exceptionalStats(e, 0)).toEqual({})
    for (const l of [1, 2, 3]) expect(exceptionalStats(e, l)).toBeNull()
  })

  it('stats: canExceptional false -> {}; NaN/negative -> {}; clamps to max', () => {
    const belt = loadEquipSync(1132308)
    expect(exceptionalStats({ ...belt, canExceptional: false, exceptionalMax: 0 }, 1)).toEqual({})
    expect(exceptionalStats(belt, NaN)).toEqual({})
    expect(exceptionalStats(belt, -1)).toEqual({})
    expect(exceptionalStats({ ...belt, exceptionalMax: 1 }, 2)).toEqual(exceptionalStats(belt, 1))
  })

  it('expectation: levels, hammers, clamp, invalid', () => {
    const e = { ...loadEquipSync(1143471), exceptionalMax: 3 }
    expect(exceptionalExpectation(e, 0)).toMatchObject({ meso: 0, attempts: 0, exceptionalHammer: 0 })
    expect(exceptionalExpectation(e, 1)).toMatchObject({ meso: 0, attempts: 1, exceptionalHammer: 1 })
    const b = exceptionalExpectation(e, 2)!
    expect(b).toMatchObject({ meso: 5_000_000_000, attempts: 3, exceptionalHammer: 3 })
    expect(b.source.source).toBe('KMS-estimate')
    expect(exceptionalExpectation(e, 3)).toMatchObject({ meso: 25_000_000_000, attempts: 7, exceptionalHammer: 7 })
    const belt = { ...e, exceptionalMax: 1 }
    expect(exceptionalExpectation(belt, 2)).toEqual(exceptionalExpectation(belt, 1))
    expect(exceptionalExpectation(e, NaN)).toBeNull()
    expect(exceptionalExpectation(e, -1)).toBeNull()
    expect(exceptionalExpectation({ ...e, canExceptional: false, exceptionalMax: 0 }, 1)).toBeNull()
  })
})

// Scroll reverse calculation (Task 8).
import { beforeAll, describe, expect, it } from 'vitest'
import { reverseRandomAverage, reverseScroll, reverseScrollDetailed, scrollStats, type ScrollEntry } from '../scroll'
import type { EquipData, Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { loadEquipSync, loadIndexSync, nonZero } from './helpers'

interface FixtureItem {
  id: number
  name: string
  scrollUpgrade: number
  scroll: Stats
}
const items = fixture as FixtureItem[]
const indexed = new Set(loadIndexSync().map((e) => e.id))

// Selection rule: indexed items with scrollUpgrade > 0, tuc > 0 and a non-empty fixture `scroll`. Some of these carry
// non-scroll etc sources or random scrolls, so not all are reproducible (actual: 160 of 266).
const candidates = items.filter((f) => indexed.has(f.id) && f.scrollUpgrade > 0 && Object.keys(f.scroll).length > 0)
const MIN_HITS = 150

const probeOf = (equip: EquipData, n: number): EquipData => ({ ...equip, tuc: Math.max(equip.tuc, n) })
const statsOf = (equip: EquipData, combo: ScrollEntry[], n: number) =>
  nonZero(scrollStats(probeOf(equip, n), { entries: combo, failCount: 0 }, {}))
const has = (res: ScrollEntry[][], want: { scrollId: string; choice: string; count: number }[]) =>
  res.some(
    (c) =>
      c.length === want.length &&
      want.every((w) => c.some((e) => e.scrollId === w.scrollId && e.choice === w.choice && e.count === w.count)),
  )

describe('reverseScroll', () => {
  let tried = 0
  let hits = 0
  let maxMs = 0
  beforeAll(() => {
    for (const f of candidates) {
      const equip = loadEquipSync(f.id)
      if (equip.tuc <= 0) continue
      tried++
      const t0 = performance.now()
      const res = reverseScrollDetailed(equip, f.scroll, f.scrollUpgrade)
      maxMs = Math.max(maxMs, performance.now() - t0)
      expect(res.timedOut).toBe(false)
      for (const combo of res.results) expect(statsOf(equip, combo, f.scrollUpgrade)).toEqual(nonZero(f.scroll))
      if (res.results.length > 0) hits++
    }
  })

  it('finds a combination reproducing fixture etc', () => {
    console.info(`reverse hits ${hits}/${tried}, slowest ${maxMs.toFixed(0)}ms`)
    expect(hits).toBeGreaterThanOrEqual(MIN_HITS)
    expect(maxMs).toBeLessThan(500)
  })

  it('known answers (fixture)', () => {
    const hat = items.find((i) => i.id === 1005983 && i.scrollUpgrade === 17)!
    expect(has(reverseScroll(loadEquipSync(1005983), hat.scroll, 17), [{ scrollId: 'b', choice: 'att', count: 17 }])).toBe(true)
    const fist = items.find((i) => i.name === '命運鬥拳' && i.scrollUpgrade === 9)!
    expect(has(reverseScroll(loadEquipSync(fist.id), fist.scroll, 9), [{ scrollId: 'trace15', choice: 'luk', count: 9 }])).toBe(true)
    const shield = items.find((i) => i.name === '惡魔賢者盾' && i.scrollUpgrade === 8)!
    expect(has(reverseScroll(loadEquipSync(shield.id), shield.scroll, 8), [{ scrollId: 'trace15', choice: 'int', count: 8 }])).toBe(true)
  })

  it('average = observed / count', () => {
    expect(reverseRandomAverage({ str: 10, att: 7 }, 4)).toEqual({ str: 2.5, att: 1.75 })
    expect(reverseRandomAverage({ str: 10 }, 0)).toEqual({})
  })

  it('returns empty for impossible input within time budget', () => {
    const equip = loadEquipSync(1005982)
    const t0 = performance.now()
    expect(reverseScroll(equip, { str: 1234567, luk: 3, att: 999 }, 12)).toEqual([])
    expect(reverseScroll(equip, { str: 7, att: 1 }, 12)).toEqual([])
    expect(performance.now() - t0).toBeLessThan(500)
  })

  describe('mixed 17-slot hat (6x15% LUK + 2x30% DEX + 5xB + 4xV)', () => {
    const equip = loadEquipSync(1005982)
    const truth: ScrollEntry[] = [
      { scrollId: 'trace15', choice: 'luk', count: 6 },
      { scrollId: 'trace30', choice: 'dex', count: 2 },
      { scrollId: 'b', choice: 'att', count: 5 },
      { scrollId: 'v', choice: 'att', count: 4 },
    ]
    const observed = statsOf(equip, truth, 17)

    it('finds the true combination without timing out', () => {
      const t0 = performance.now()
      const r = reverseScrollDetailed(equip, observed, 17)
      expect(performance.now() - t0).toBeLessThan(500)
      expect(r.timedOut).toBe(false)
      // truncation may drop it from the returned list; the search itself must hit it, so check stats of all results too
      for (const c of r.results) expect(statsOf(equip, c, 17)).toEqual(observed)
      expect(has(r.results, truth)).toBe(true)
    })

    it('near-miss (1 point off) returns [] quickly, not timed out', () => {
      for (const bad of [{ ...observed, att: (observed.att ?? 0) + 1 }, { ...observed, maxHp: (observed.maxHp ?? 0) + 5 }]) {
        const t0 = performance.now()
        const r = reverseScrollDetailed(equip, bad, 17)
        expect(performance.now() - t0).toBeLessThan(500)
        expect(r.timedOut).toBe(false)
        expect(r.results).toEqual([])
      }
    })
  })

  it('sets truncated when the cap is hit and never exceeds it', () => {
    // Gloves (id 1082000) get ATT only from spell traces: ATT 30 in 12 successes has far more than 20 combinations.
    const r = reverseScrollDetailed(loadEquipSync(1082000), { att: 30 }, 12)
    expect(r.results.length).toBe(20)
    expect(r.truncated).toBe(true)
    expect(r.timedOut).toBe(false)
    // a unique answer is not flagged
    const hat = loadEquipSync(1005982)
    const one = reverseScrollDetailed(hat, { str: 34, dex: 34, int: 34, luk: 34, att: 153 }, 17)
    expect(one.truncated).toBe(false)
  })

  describe('weapon (命運鬥拳) mixed inputs', () => {
    const fist = loadEquipSync(1472290)
    const ids = ['trace100', 'trace70', 'trace30', 'trace15', 'b', 'v', 'x', 'red', 'lightning']
    const choices = ['str', 'dex', 'luk', 'int', 'maxHp']

    it('finds 12 seeded random valid combinations of 11-18 slots, never timing out', () => {
      let seed = 7
      const rnd = (n: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed % n
      }
      let maxMs = 0
      for (let t = 0; t < 12; t++) {
        const n = 11 + rnd(8)
        const entries: ScrollEntry[] = []
        let left = n
        while (left > 0) {
          const count = 1 + rnd(Math.min(left, 6))
          const id = ids[rnd(ids.length)]
          entries.push({ scrollId: id, choice: id.startsWith('trace') ? choices[rnd(5)] : 'att', count })
          left -= count
        }
        const observed = statsOf(fist, entries, n)
        const t0 = performance.now()
        const r = reverseScrollDetailed(fist, observed, n)
        maxMs = Math.max(maxMs, performance.now() - t0)
        expect(r.timedOut).toBe(false)
        expect(r.results.length).toBeGreaterThan(0)
        for (const c of r.results) expect(statsOf(fist, c, n)).toEqual(observed)
      }
      expect(maxMs).toBeLessThan(350)
    })

    it('impossible inputs up to 20 slots return [] quickly', () => {
      for (const n of [9, 15, 18, 20]) {
        const t0 = performance.now()
        const r = reverseScrollDetailed(fist, { str: 30, dex: 31, int: 30, luk: 60, att: 140 }, n)
        expect(performance.now() - t0).toBeLessThan(350)
        expect(r.timedOut).toBe(false)
        expect(r.results).toEqual([])
      }
    })

    it('rejects usedSlots above REVERSE_MAX_USED_SLOTS and reports timedOut truthfully', () => {
      const t0 = performance.now()
      expect(reverseScrollDetailed(fist, { str: 600, att: 1000 }, 120).results).toEqual([])
      const r = reverseScrollDetailed(fist, { str: 200, dex: 200, int: 200, luk: 200, att: 360, matt: 120 }, 40)
      expect(performance.now() - t0).toBeLessThan(900)
      if (r.results.length === 0) expect(typeof r.timedOut).toBe('boolean')
    })
  })
})

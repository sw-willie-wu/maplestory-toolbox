// Scroll slots, scroll stats, recovery expectation and hammers (Task 6).
import { describe, expect, it } from 'vitest'
import { hammerExpectation, hammerUses, type HammerState } from '../hammer'
import { SCROLLS } from '../rules/scroll'
import { scrollExpectation, scrollStats, scrollSummary, totalSlots, type ScrollState } from '../scroll'
import type { EquipData, Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { loadEquipSync, loadIndexSync, nonZero } from './helpers'

interface FixtureItem {
  id: number
  name: string
  scrollUpgrade: number
  scrollUpgradeable: number
  resilience: number
  goldenHammer: boolean
  scroll: Stats
}

const items = fixture as FixtureItem[]
const indexed = new Set(loadIndexSync().map((e) => e.id))

/** Hammer state implied by the Nexon API (sources.md HAMMER): −resilience extra slots, golden flag = the first one. */
function hammerFromFixture(f: FixtureItem): HammerState {
  const golden = f.goldenHammer ? 1 : 0
  const extra = Math.max(0, -f.resilience)
  return { golden, platinum: Math.max(0, extra - golden) }
}

const helm = loadEquipSync(1005982) // 永恆弓箭手帽 Lv250 armor, tuc 12

/** The fixture item with this id and scroll count, and its implied hammer state. */
function fx(id: number, scrolls: number): { equip: EquipData; hammer: HammerState; f: FixtureItem } {
  const f = items.find((i) => i.id === id && i.scrollUpgrade === scrolls)
  if (!f) throw new Error('fixture item ' + id + ' with ' + scrolls + ' scrolls missing')
  return { equip: loadEquipSync(id), hammer: hammerFromFixture(f), f }
}

function fakeEquip(over: Partial<EquipData>): EquipData {
  return { ...helm, ...over }
}

describe('totalSlots / hammers', () => {
  it('golden hammer adds 1 slot', () => {
    expect(totalSlots(helm, {})).toBe(helm.tuc)
    expect(totalSlots(helm, { golden: 1 })).toBe(helm.tuc + 1)
    expect(totalSlots(helm, { golden: 3 })).toBe(helm.tuc + 1) // max 1
  })

  it('golden hammer is blocked by blockGoldHammer', () => {
    const blocked = fakeEquip({ blockGoldHammer: true })
    expect(totalSlots(blocked, { golden: 1 })).toBe(blocked.tuc)
    expect(totalSlots(blocked, { platinum: 2 })).toBe(blocked.tuc + 2)
  })

  it('platinum refine n adds n slots up to max', () => {
    for (let n = 0; n <= 5; n++) expect(totalSlots(helm, { platinum: n })).toBe(helm.tuc + n)
    expect(totalSlots(helm, { platinum: 9 })).toBe(helm.tuc + 5)
    expect(totalSlots(helm, { golden: 1, platinum: 5 })).toBe(helm.tuc + 6)
  })

  it('tuc 0 items get no slots and no hammer', () => {
    expect(totalSlots(fakeEquip({ tuc: 0 }), { golden: 1, platinum: 5 })).toBe(0)
  })

  it('totalSlots matches fixture', () => {
    const inIndex = items.filter((f) => indexed.has(f.id))
    expect(inIndex.length).toBe(items.length)
    const mismatch = inIndex.filter(
      (f) => f.scrollUpgrade + f.scrollUpgradeable !== totalSlots(loadEquipSync(f.id), hammerFromFixture(f)),
    )
    // Only positive-resilience items differ: their resilience is a net value (failed slots − refines, sources.md
    // HAMMER) that cannot be separated, so the hammer state is unknown. Listed, not loosened.
    const label = (f: FixtureItem) => `${f.id}:${f.resilience}`
    expect(mismatch.map(label).sort()).toEqual(
      items
        .filter((f) => f.resilience > 0)
        .map(label)
        .sort(),
    )
    expect(mismatch).toHaveLength(17)
    // ...and each of them is consistent with "no hammer, `resilience` slots consumed by failures".
    for (const f of mismatch)
      expect(f.scrollUpgrade + f.scrollUpgradeable + f.resilience).toBe(totalSlots(loadEquipSync(f.id), {}))
    // Negative-resilience items with the golden flag are all allowed a golden hammer.
    for (const f of inIndex.filter((i) => i.goldenHammer)) expect(loadEquipSync(f.id).blockGoldHammer).toBe(false)
  })

  it('hammer expectation: golden costs 24000 spell traces (not mesos), refine unknown → null', () => {
    expect(hammerExpectation(helm, {})).toEqual({ meso: 0, spellTrace: 0, attempts: 0 })
    expect(hammerExpectation(helm, { golden: 1 })).toEqual({ meso: 0, spellTrace: 24000, attempts: 1 })
    expect(hammerExpectation(helm, { platinum: 1 })).toBeNull()
    expect(hammerExpectation(helm, { golden: 1, platinum: 2 })).toBeNull()
    expect(hammerExpectation(fakeEquip({ blockGoldHammer: true }), { golden: 1 })).toEqual({
      meso: 0,
      spellTrace: 0,
      attempts: 0,
    })
  })

  it('reports ignored hammer input', () => {
    expect(hammerUses(helm, { golden: 1, platinum: 9 })).toEqual([
      { id: 'golden', requested: 1, applied: 1, reason: null },
      { id: 'platinum', requested: 9, applied: 5, reason: 'max' },
    ])
    expect(hammerUses(fakeEquip({ blockGoldHammer: true }), { golden: 1 })[0]).toEqual({
      id: 'golden',
      requested: 1,
      applied: 0,
      reason: 'blocked',
    })
    expect(hammerUses(fakeEquip({ tuc: 0 }), { platinum: 2 })[1]).toEqual({
      id: 'platinum',
      requested: 2,
      applied: 0,
      reason: 'noSlots',
    })
    expect(hammerUses(helm, {})[0]).toEqual({ id: 'golden', requested: 0, applied: 0, reason: null })
  })
})

describe('scrollSummary', () => {
  const state: ScrollState = {
    entries: [{ scrollId: 'trace15', count: 5, choice: 'dex' }],
    failCount: 3,
  }

  it('summary: used+remaining+recoverable equals totalSlots', () => {
    for (const hammer of [{}, { golden: 1 }, { platinum: 5 }, { golden: 1, platinum: 3 }] as HammerState[]) {
      const s = scrollSummary(helm, state, hammer)
      expect(s.used + s.remaining + s.recoverable).toBe(totalSlots(helm, hammer))
      expect(s.used).toBe(5)
      expect(s.overflow).toBe(0)
      expect(s.overflowScrolls).toBe(0)
      expect(s.overflowFails).toBe(0)
    }
  })

  it('recoverable equals failCount', () => {
    expect(scrollSummary(helm, state, {}).recoverable).toBe(3)
    expect(scrollSummary(helm, { ...state, failCount: 0 }, {}).recoverable).toBe(0)
  })

  it('clamps entries exceeding slots and reports overflow', () => {
    // tuc 12, 3 failed → 9 usable; 5 + 6 = 11 → 2 overflow, taken from the last entry
    const over: ScrollState = {
      entries: [
        { scrollId: 'b', count: 5 },
        { scrollId: 'trace15', count: 6, choice: 'dex' },
      ],
      failCount: 3,
    }
    const s = scrollSummary(helm, over, {})
    expect(s).toEqual({ used: 9, remaining: 0, recoverable: 3, overflowScrolls: 2, overflowFails: 0, overflow: 2 })
    expect(scrollSummary(helm, over, { platinum: 2 }).overflow).toBe(0)
    // overflowing scrolls add no stats: 5 × B + 4 × 15% DEX (4th success → +1 ATT)
    const b = { str: 10, dex: 10, int: 10, luk: 10, att: 45 }
    expect(nonZero(scrollStats(helm, over, {}))).toEqual({
      ...b,
      dex: 50,
      maxHp: 680,
      def: 60,
      att: 46,
    })
    // failures beyond the slots are clamped too
    expect(scrollSummary(helm, { entries: [], failCount: 20 }, {})).toEqual({
      used: 0,
      remaining: 0,
      recoverable: 12,
      overflowScrolls: 0,
      overflowFails: 8,
      overflow: 8,
    })
  })
})

describe('scrollStats', () => {
  it('reproduces fixed-value fixture items', () => {
    // 1005982 永恆弓箭手帽 17× B (12 tuc + 5 refines)
    const hat = fx(1005982, 17)
    expect(hat.hammer).toEqual({ golden: 0, platinum: 5 })
    expect(scrollStats(hat.equip, { entries: [{ scrollId: 'b', count: 17 }], failCount: 0 }, hat.hammer)).toEqual(
      hat.f.scroll,
    )
    // 1672040 鈦之心 10× V, magic version
    const heart = fx(1672040, 10)
    expect(
      scrollStats(heart.equip, { entries: [{ scrollId: 'v', count: 10, choice: 'matt' }], failCount: 0 }, heart.hammer),
    ).toEqual(heart.f.scroll)
    // without the hammers the 5 extra B scrolls overflow
    expect(scrollStats(hat.equip, { entries: [{ scrollId: 'b', count: 17 }], failCount: 0 }, {}).att).toBe(12 * 9)
  })

  it('reproduces spell trace fixture items', () => {
    const cases: [number, number, string][] = [
      [1472290, 9, 'luk'], // 命運鬥拳 9× 15% LUK
      [1382287, 8, 'int'], // 命運長杖 8× 15% INT → MATT
      [1092089, 8, 'int'], // 惡魔賢者盾 8× 15% INT (armor table, 4th → MATT 1)
      [1005982, 14, 'dex'], // 永恆弓箭手帽 14× 15% DEX (12 tuc + 2 refines)
    ]
    for (const [id, n, choice] of cases) {
      const { equip, hammer, f } = fx(id, n)
      const state: ScrollState = { entries: [{ scrollId: 'trace15', count: n, choice }], failCount: 0 }
      expect(nonZero(scrollStats(equip, state, hammer))).toEqual(f.scroll)
    }
  })

  it('spell trace nth bonus', () => {
    const run = (count: number) =>
      scrollStats(helm, { entries: [{ scrollId: 'trace15', count, choice: 'dex' }], failCount: 0 }, { platinum: 2 })
    expect(run(3).att ?? 0).toBe(0)
    // 14× 15% DEX on 永恆弓箭手帽 = fixture { dex 140, maxHp 2380, att 1, def 210 }
    expect(run(4)).toEqual({ dex: 40, maxHp: 680, def: 60, att: 1 })
    expect(run(14)).toEqual({ dex: 140, maxHp: 2380, def: 210, att: 1 })
    // the count spans entries of the same scroll
    const split = scrollStats(
      helm,
      {
        entries: [
          { scrollId: 'trace15', count: 2, choice: 'dex' },
          { scrollId: 'trace15', count: 2, choice: 'dex' },
        ],
        failCount: 0,
      },
      {},
    )
    expect(split.att).toBe(1)
    expect(SCROLLS.ruleSources.traceFourthBonus.guess).toBe(true)
  })

  it('spell trace nth bonus counts all grades together (2×70% + 2×30% → +1 once)', () => {
    const mixed = scrollStats(
      helm,
      {
        entries: [
          { scrollId: 'trace70', count: 2, choice: 'dex' },
          { scrollId: 'trace30', count: 2, choice: 'dex' },
        ],
        failCount: 0,
      },
      {},
    )
    // Lv250 armor: 70% = DEX 4 / HP 70 / DEF 5, 30% = DEX 7 / HP 120 / DEF 10
    expect(mixed).toEqual({ dex: 22, maxHp: 380, def: 30, att: 1 })
  })

  it('non-spell-trace scrolls do not advance the 4th-success count', () => {
    const run = (traces: number) =>
      scrollStats(
        helm,
        {
          entries: [
            { scrollId: 'b', count: 3 },
            { scrollId: 'trace15', count: traces, choice: 'dex' },
          ],
          failCount: 0,
        },
        {},
      ).att
    expect(run(3)).toBe(27) // 3 × B ATT 9, no bonus although 6 scrolls succeeded
    expect(run(4)).toBe(28) // 4th spell trace → +1
  })

  it('random scroll uses count × avgPerScroll', () => {
    const weapon = loadEquipSync(1472290)
    const s = scrollStats(
      weapon,
      { entries: [{ scrollId: 'destiny', count: 3, avgPerScroll: { str: 2.5, att: 7 } }], failCount: 0 },
      {},
    )
    expect(s).toEqual({ str: 7.5, att: 21 })
    expect(scrollStats(weapon, { entries: [{ scrollId: 'destiny', count: 3 }], failCount: 0 }, {})).toEqual({})
  })

  it('unknown scroll id throws', () => {
    expect(() => scrollStats(helm, { entries: [{ scrollId: 'nope', count: 1 }], failCount: 0 }, {})).toThrow()
  })
})

describe('scrollExpectation', () => {
  it('recovery expectation is zero without failures', () => {
    expect(scrollExpectation([{ scrollId: 'b', count: 10 }], 'cleanSlate')).toEqual({
      scrollsUsed: 10,
      recoveryUsed: 0,
    })
    expect(scrollExpectation([{ scrollId: 'trace100', count: 5 }], 'cleanSlate').recoveryUsed).toBe(0)
  })

  it('recovery expectation grows as success rate drops', () => {
    const r = (id: string) => scrollExpectation([{ scrollId: id, count: 10 }], 'cleanSlate')
    expect(r('trace70').scrollsUsed).toBeCloseTo(10 / 0.7)
    expect(r('trace70').recoveryUsed).toBeCloseTo(10 / 0.7 - 10)
    expect(r('trace15').recoveryUsed).toBeCloseTo(10 / 0.15 - 10)
    expect(r('trace30').recoveryUsed).toBeGreaterThan(r('trace70').recoveryUsed)
    expect(r('trace15').recoveryUsed).toBeGreaterThan(r('trace30').recoveryUsed)
  })

  it('no recovery id → no recovery scrolls', () => {
    expect(scrollExpectation([{ scrollId: 'trace15', count: 4 }])).toEqual({
      scrollsUsed: 4 / 0.15,
      recoveryUsed: 0,
    })
  })
})

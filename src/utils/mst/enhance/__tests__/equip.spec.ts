// Breakdown composition (Task 10) + acceptance 1 regression against the Nexon export (spec §8-1).
import { describe, expect, it } from 'vitest'
import { breakdownWithScroll, computeBreakdown, emptyState, lockedTabs, type EnhanceState } from '../equip'
import { reverseFlame } from '../flame'
import { HAMMER } from '../rules/hammer'
import { STARFORCE } from '../rules/starforce'
import { reverseScroll } from '../scroll'
import type { EquipData, Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { add, loadEquipSync, nonZero } from './helpers'

interface FixtureItem {
  id: number
  name: string
  starforce: number
  scrollUpgrade: number
  resilience: number
  goldenHammer: boolean
  exceptionalUpgrade: number
  base: Stats
  scroll: Stats
  starforceStats: Stats
  flame: Stats
  exceptional: Stats
  total: Stats
}

const items = fixture as FixtureItem[]

const sameStats = (a: Stats, b: Stats) => {
  const x = nonZero(a)
  const y = nonZero(b)
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]) as Set<keyof Stats>
  for (const k of keys) if (x[k] !== y[k]) return false
  return true
}
const hasNaN = (s: Stats) => Object.values(s).some((v) => typeof v !== 'number' || !Number.isFinite(v))

const stateWith = (equip: EquipData, patch: Partial<EnhanceState>): EnhanceState => ({ ...emptyState(equip), ...patch })

describe('emptyState', () => {
  it('is an unenhanced item', () => {
    const equip = loadEquipSync(1005983)
    const s = emptyState(equip)
    expect(s).toEqual({
      star: 0,
      scroll: { entries: [], failCount: 0 },
      hammer: {},
      flame: [],
      exceptional: 0,
      potential: { grade: null, lines: [null, null, null] },
      additional: { grade: null, lines: [null, null, null] },
    })
    const b = computeBreakdown(equip, s)
    expect(b).toMatchObject({ scroll: {}, starforce: {}, flame: {}, exceptional: {} })
    expect(b.total).toEqual(nonZero(equip.base))
  })
})

describe('computeBreakdown — acceptance 1 (Nexon export)', () => {
  it('base matches API for every fixture item', () => {
    const misses: string[] = []
    for (const f of items) {
      const equip = loadEquipSync(f.id)
      const b = computeBreakdown(equip, emptyState(equip))
      if (!sameStats(b.base, f.base)) misses.push(`${f.id} ${f.name}`)
    }
    expect(misses).toEqual([])
  })

  // Same supported/skip rule as starforce-stats.spec.ts (Task 4).
  const starred = items.filter((f) => f.starforce > 0)
  const supported = starred.filter((f) => STARFORCE.supports(loadEquipSync(f.id)))

  it('starforce coverage: only the five 172xxxx 阿斯特拉 secondaries are skipped', () => {
    const skipped = new Set(starred.filter((f) => !supported.includes(f)).map((f) => f.id))
    expect(skipped).toEqual(new Set([1723902, 1720602, 1721102, 1720801, 1722902]))
  })

  it('starforce part matches API given scroll part', () => {
    const misses: string[] = []
    for (const f of supported) {
      const equip = loadEquipSync(f.id)
      const b = breakdownWithScroll(equip, stateWith(equip, { star: f.starforce }), f.scroll)
      expect(b.scroll).toEqual(f.scroll)
      if (!sameStats(b.starforce, f.starforceStats)) misses.push(`${f.id} ${f.name} ${f.starforce}★`)
    }
    expect(misses).toEqual([])
    expect(supported.length).toBe(starred.length - 5) // 272 of 277 starred items
  })

  it('total matches API (excl. exceptional) for items whose every part is reproducible', () => {
    let reproducible = 0
    const skipped = { starforce: 0, scroll: 0, flame: 0 }
    const misses: string[] = []
    for (const f of items) {
      const equip = loadEquipSync(f.id)
      if (f.starforce > 0 && !STARFORCE.supports(equip)) {
        skipped.starforce++
        continue
      }
      const golden = f.goldenHammer ? 1 : 0
      const hammer = { golden, platinum: Math.max(0, HAMMER.extraSlotsFromApi(f.resilience) - golden) }
      const scrollCombo =
        Object.keys(nonZero(f.scroll)).length === 0 ? [] : reverseScroll(equip, f.scroll, f.scrollUpgrade)[0]
      if (!scrollCombo) {
        skipped.scroll++
        continue
      }
      const flameLines = Object.keys(nonZero(f.flame)).length === 0 ? [] : reverseFlame(equip, f.flame)[0]
      if (!flameLines) {
        skipped.flame++
        continue
      }
      const s = stateWith(equip, {
        star: f.starforce,
        scroll: { entries: scrollCombo, failCount: 0 },
        hammer,
        flame: flameLines,
      })
      const b = computeBreakdown(equip, s)
      reproducible++
      if (!sameStats(b.scroll, f.scroll) || !sameStats(b.flame, f.flame) || !sameStats(b.total, f.total))
        misses.push(`${f.id} ${f.name}`)
    }
    console.info(`total reproduced for ${reproducible}/${items.length} fixture items; skipped ${JSON.stringify(skipped)}`)
    expect(misses).toEqual([])
    // Not reproducible (actual when written: 287 of 422 reproduced): 5 unsupported-starforce secondaries, 116 scroll
    // parts reverseScroll cannot explain (random / etc sources), 14 flames on canFlame=false items (1202287 totem,
    // 1143471 medal). The scroll count depends on reverseScroll finishing within REVERSE_TIME_BUDGET_MS (350ms per
    // item); a much slower machine could time some out and drop reproductions, hence a floor and not an exact count.
    expect(reproducible).toBeGreaterThanOrEqual(280)
  })
})

describe('computeBreakdown — composition', () => {
  it('total = sum of parts, exceptional included', () => {
    const equip = loadEquipSync(1012911) // 傲慢的原罪 (exceptionalMax 3)
    const b = computeBreakdown(equip, stateWith(equip, { star: 10, flame: [], exceptional: 1 }))
    let sum: Stats = {}
    for (const part of [b.base, b.scroll, b.starforce, b.flame, b.exceptional]) sum = add(sum, part)
    expect(nonZero(b.total)).toEqual(nonZero(sum))
  })

  it('exceptional with no data is {} and flagged', () => {
    const equip: EquipData = { ...loadEquipSync(1005983), canExceptional: true, exceptionalMax: 5, id: 9999999 }
    const b = computeBreakdown(equip, stateWith(equip, { exceptional: 3 }))
    expect(b.exceptional).toEqual({})
    expect(b.exceptionalNoData).toBe(true)
    const ok = computeBreakdown(equip, emptyState(equip))
    expect(ok.exceptionalNoData).toBe(false)
  })

  it('starforce compounds on base + scroll (hammer slots included)', () => {
    const equip = loadEquipSync(1005983) // tuc 12
    const entries = [{ scrollId: 'b', choice: 'att', count: 17 }]
    const noHammer = computeBreakdown(equip, stateWith(equip, { star: 25, scroll: { entries, failCount: 0 } }))
    const hammered = computeBreakdown(
      equip,
      stateWith(equip, { star: 25, scroll: { entries, failCount: 0 }, hammer: { platinum: 5 } }),
    )
    expect((hammered.scroll.att ?? 0) > (noHammer.scroll.att ?? 0)).toBe(true)
    const f = items.find((i) => i.id === 1005983 && i.scrollUpgrade === 17)!
    expect(nonZero(hammered.scroll)).toEqual(nonZero(f.scroll))
    expect(nonZero(hammered.starforce)).toEqual(nonZero(f.starforceStats))
  })
})

describe('computeBreakdown — effective star', () => {
  it('clamps star to maxStarByLevel and flags unsourced weapon ATT for the applied star', () => {
    const weapon = loadEquipSync(1472290) // 命運鬥拳 Lv250: weapon ATT sourced to 25★
    const at99 = computeBreakdown(weapon, stateWith(weapon, { star: 99 }))
    expect(at99.star).toBe(30)
    expect(at99.starforceUnsourced).toBe(true)
    const at25 = computeBreakdown(weapon, stateWith(weapon, { star: 25 }))
    expect(at25.star).toBe(25)
    expect(at25.starforceUnsourced).toBe(false)
  })

  it('Lv120 item: star 20 → 15 (max), sourced', () => {
    const cap = loadEquipSync(1002776) // 永恆勇士頭盔 Lv120
    const b = computeBreakdown(cap, stateWith(cap, { star: 20 }))
    expect(b.star).toBe(15)
    expect(b.starforceUnsourced).toBe(false)
    expect(b.starforce).toEqual(computeBreakdown(cap, stateWith(cap, { star: 15 })).starforce)
  })

  it('locked starforce → star 0, not unsourced; NaN / negative → 0', () => {
    const sup = loadEquipSync(1122241) // superior
    expect(computeBreakdown(sup, stateWith(sup, { star: 22 }))).toMatchObject({ star: 0, starforceUnsourced: false })
    const hat = loadEquipSync(1005983)
    expect(computeBreakdown(hat, stateWith(hat, { star: Number.NaN })).star).toBe(0)
    expect(computeBreakdown(hat, stateWith(hat, { star: -3 })).star).toBe(0)
  })
})

describe('lockedTabs — Review Focus 1', () => {
  const full: EnhanceState = {
    star: 22,
    scroll: { entries: [{ scrollId: 'b', choice: 'att', count: 5 }], failCount: 1 },
    hammer: { golden: 1, platinum: 5 },
    flame: [],
    exceptional: 3,
    potential: { grade: null, lines: [null, null, null] },
    additional: { grade: null, lines: [null, null, null] },
  }
  const noNaN = (equip: EquipData, s: EnhanceState) => {
    const b = computeBreakdown(equip, s)
    for (const k of ['base', 'scroll', 'starforce', 'flame', 'exceptional', 'total'] as const) {
      expect(b[k], k).toBeTypeOf('object')
      expect(hasNaN(b[k]), k).toBe(false)
    }
    return b
  }

  it('locks tabs for non-enhanceable equip', () => {
    const base = loadEquipSync(1005983)
    // cash / tuc 0 item (點裝)
    const cash: EquipData = {
      ...base,
      cash: true,
      tuc: 0,
      canStarforce: false,
      canFlame: false,
      canExceptional: false,
      exceptionalMax: 0,
    }
    expect(lockedTabs(cash)).toEqual(new Set(['starforce', 'scroll', 'hammer', 'flame', 'exceptional']))
    const b = noNaN(cash, full)
    expect(b).toMatchObject({ scroll: {}, starforce: {}, flame: {}, exceptional: {} })
    expect(b.total).toEqual(nonZero(cash.base))
    // tuc 0 alone → scroll + hammer locked
    const noSlots: EquipData = { ...base, tuc: 0 }
    expect(lockedTabs(noSlots).has('scroll')).toBe(true)
    expect(lockedTabs(noSlots).has('hammer')).toBe(true)
    expect(noNaN(noSlots, full).scroll).toEqual({})
  })

  it('normal item: nothing locked except exceptional when unavailable', () => {
    const hat = loadEquipSync(1005983)
    expect(lockedTabs(hat)).toEqual(new Set(['exceptional']))
    expect(lockedTabs(loadEquipSync(1012911)).has('exceptional')).toBe(false)
  })

  it('superior item: starforce locked', () => {
    const sup = loadEquipSync(1122241) // 超越的心之項鍊
    expect(lockedTabs(sup).has('starforce')).toBe(true)
    expect(noNaN(sup, full).starforce).toEqual({})
  })

  it('blockGoldHammer alone does not lock hammer (platinum still usable)', () => {
    const e = loadEquipSync(1122000) // 闇黑龍王項鍊
    expect(e.blockGoldHammer).toBe(true)
    expect(lockedTabs(e).has('hammer')).toBe(e.tuc <= 0)
  })

  it('garbage numeric input never yields NaN', () => {
    const hat = loadEquipSync(1005983)
    noNaN(hat, { ...full, star: Number.NaN, exceptional: Number.NaN, hammer: { platinum: Number.NaN } })
    noNaN(hat, { ...full, star: -3, exceptional: -1 })
    noNaN(hat, { ...full, star: 99 })
  })
})

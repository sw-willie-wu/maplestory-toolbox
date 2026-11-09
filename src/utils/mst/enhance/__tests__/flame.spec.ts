// Flame (追加屬性) stats, probability and reverse decomposition (Task 7).
import { describe, expect, it } from 'vitest'
import { flameNotes, flameProbability, flameStats, reverseFlame, type FlameLine } from '../flame'
import { FLAME } from '../rules/flame'
import type { EquipData, Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { loadEquipSync, loadIndexSync, nonZero } from './helpers'

interface FixtureItem {
  id: number
  name: string
  flame: Stats
}

const items = fixture as FixtureItem[]
const indexed = new Set(loadIndexSync().map((e) => e.id))
const flamed = items.filter((f) => Object.keys(nonZero(f.flame)).length > 0 && indexed.has(f.id))

const hat = loadEquipSync(1005983) // 永恆盜賊頭巾 Lv250

function fakeEquip(over: Partial<EquipData>): EquipData {
  return {
    ...hat,
    ...over,
  }
}

/** Key-order independent comparison form of a Stats object. */
const canon = (s: Stats) => JSON.stringify(Object.entries(nonZero(s)).sort(([a], [b]) => a.localeCompare(b)))

const sortLines = (ls: FlameLine[]) => [...ls].sort((a, b) => a.stat.localeCompare(b.stat))

/** mulberry32: small seeded PRNG for the Monte Carlo check. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Independent simulation of one flame use, straight from the rule tables. */
function simulate(equip: EquipData, target: FlameLine[], typeId: string, trials: number, seed: number): number {
  const rand = rng(seed)
  const type = FLAME.flameTypes.find((t) => t.id === typeId)!
  const pool = FLAME.poolFor(equip.isWeapon, equip.level).map((s) => s.id)
  const counts = Object.entries(FLAME.lineProb(equip.bossReward)).map(([n, p]) => [Number(n), p] as const)
  const tiers = Object.entries(FLAME.finalTierProb(type, equip.bossReward)).map(([t, p]) => [Number(t), p] as const)
  const tierTotal = tiers.reduce((s, [, p]) => s + p, 0)
  const pick = <T>(table: readonly (readonly [T, number])[], total: number): T => {
    let u = rand() * total
    for (const [v, p] of table) {
      if ((u -= p) < 0) return v
    }
    return table[table.length - 1][0]
  }
  let hits = 0
  for (let i = 0; i < trials; i++) {
    const n = pick(counts, 1)
    const bag = [...pool]
    const got = new Map<string, number>()
    for (let k = 0; k < n; k++) {
      const j = Math.floor(rand() * bag.length)
      const [stat] = bag.splice(j, 1)
      got.set(stat, pick(tiers, tierTotal))
    }
    if (target.every((t) => (got.get(t.stat) ?? 0) >= t.tier)) hits++
  }
  return hits / trials
}

describe('flame', () => {
  it('flameStats sums line values onto stat keys', () => {
    expect(
      flameStats(hat, [
        { stat: 'str_luk', tier: 6 },
        { stat: 'dex_luk', tier: 3 },
        { stat: 'def', tier: 3 },
        { stat: 'allStatPct', tier: 3 },
      ]),
    ).toEqual({ str: 42, dex: 21, luk: 63, def: 36, allStatPct: 3 })
    expect(flameStats(hat, [])).toEqual({})
    expect(flameStats(fakeEquip({ canFlame: false }), [{ stat: 'str', tier: 3 }])).toEqual({})
  })

  it('flameStats of reversed result reproduces fixture', () => {
    expect(flamed.length).toBeGreaterThan(150)
    let hit = 0
    const misses: string[] = []
    for (const f of flamed) {
      const equip = loadEquipSync(f.id)
      const res = reverseFlame(equip, f.flame)
      if (!equip.canFlame) {
        // flame data on an item WZ marks as not flammable (totem 1202287): reverse refuses by contract
        expect(res).toEqual([])
        continue
      }
      if (res.length > 0 && res.some((ls) => canon(flameStats(equip, ls)) === canon(f.flame))) hit++
      else misses.push(`${f.id} ${f.name} ${JSON.stringify(f.flame)}`)
    }
    expect(misses).toEqual([])
    expect(hit).toBeGreaterThan(150)
  })

  it('reverse results respect line count, pool, tier range and boss same-family', () => {
    for (const f of flamed) {
      const equip = loadEquipSync(f.id)
      if (!equip.canFlame) continue
      const pool = new Set(FLAME.poolFor(equip.isWeapon, equip.level).map((s) => s.id))
      const range = FLAME.tierRange(equip.bossReward)
      const lc = FLAME.lineCount(equip.bossReward)
      for (const ls of reverseFlame(equip, f.flame)) {
        expect(ls.length).toBeGreaterThanOrEqual(lc.min)
        expect(ls.length).toBeLessThanOrEqual(lc.max)
        expect(new Set(ls.map((l) => l.stat)).size).toBe(ls.length)
        for (const l of ls) {
          expect(pool.has(l.stat)).toBe(true)
          expect(l.tier).toBeGreaterThanOrEqual(range.min)
          expect(l.tier).toBeLessThanOrEqual(range.max)
        }
        if (equip.bossReward) expect(ls.every((l) => l.tier <= 3) || ls.every((l) => l.tier >= 3)).toBe(true)
      }
    }
  })

  it('永恆盜賊頭巾 add 42/21/63/3% reverses to include STR/LUK T6 + DEX/LUK T3 + allStat', () => {
    const res = reverseFlame(hat, { str: 42, dex: 21, luk: 63, def: 36, allStatPct: 3 }).map((ls) =>
      JSON.stringify(sortLines(ls)),
    )
    expect(res).toContain(
      JSON.stringify(
        sortLines([
          { stat: 'str_luk', tier: 6 },
          { stat: 'dex_luk', tier: 3 },
          { stat: 'def', tier: 3 },
          { stat: 'allStatPct', tier: 3 },
        ]),
      ),
    )
  })

  it('reverse includes levelReduce lines', () => {
    const equip = fakeEquip({ bossReward: false, level: 160 })
    const lines: FlameLine[] = [
      { stat: 'levelReduce', tier: 2 },
      { stat: 'str', tier: 4 },
    ]
    const obs = flameStats(equip, lines)
    expect(obs.levelReduce).toBe(10)
    expect(reverseFlame(equip, obs).map((ls) => JSON.stringify(sortLines(ls)))).toContain(JSON.stringify(sortLines(lines)))
  })

  it('canFlame=false: no stats, zero probability, no decomposition', () => {
    const totem = fakeEquip({ canFlame: false })
    expect(flameProbability(totem, [{ stat: 'str', tier: 1 }], 'strong')).toEqual({ p: 0, expected: Infinity })
    expect(flameProbability(totem, [], 'strong')).toEqual({ p: 0, expected: Infinity })
    expect(reverseFlame(totem, { str: 12 })).toEqual([])
  })

  it('probability: empty target is 1', () => {
    for (const t of FLAME.flameTypes) {
      expect(flameProbability(hat, [], t.id)).toEqual({ p: 1, expected: 1 })
    }
  })

  it('probability decreases as tier increases', () => {
    const nonBoss = fakeEquip({ bossReward: false })
    for (const t of ['awakened', 'awakenedDark']) {
      let prev = 1
      for (let tier = 1; tier <= 5; tier++) {
        const { p } = flameProbability(nonBoss, [{ stat: 'str', tier }], t)
        expect(p).toBeLessThanOrEqual(prev)
        prev = p
      }
      expect(flameProbability(nonBoss, [{ stat: 'str', tier: 5 }], t).p).toBeLessThan(
        flameProbability(nonBoss, [{ stat: 'str', tier: 2 }], t).p,
      )
    }
    // tier beyond reach → 0, expected Infinity, no throw
    expect(flameProbability(nonBoss, [{ stat: 'str', tier: 6 }], 'awakened')).toEqual({ p: 0, expected: Infinity })
    expect(flameProbability(nonBoss, [{ stat: 'str', tier: 4 }], 'strong')).toEqual({ p: 0, expected: Infinity })
    // stat outside the pool (bossDamage on a non-weapon) → 0
    expect(flameProbability(nonBoss, [{ stat: 'bossDamage', tier: 1 }], 'awakened').p).toBe(0)
  })

  it('probability matches the closed form for a single non-boss line', () => {
    const nonBoss = fakeEquip({ bossReward: false })
    const N = FLAME.poolFor(false, nonBoss.level).length
    // P(stat present) = Σ q_n · n/N ; awakened T1+ is the whole table (100%)
    const present = (0.4 * 1 + 0.4 * 2 + 0.15 * 3 + 0.05 * 4) / N
    expect(flameProbability(nonBoss, [{ stat: 'str', tier: 1 }], 'awakened').p).toBeCloseTo(present, 12)
    expect(flameProbability(nonBoss, [{ stat: 'str', tier: 5 }], 'awakened').p).toBeCloseTo(present * 0.0023, 12)
    const r = flameProbability(nonBoss, [{ stat: 'str', tier: 5 }], 'awakened')
    expect(r.expected).toBeCloseTo(1 / r.p, 6)
  })

  it('boss item never yields tier below range', () => {
    const boss = fakeEquip({ bossReward: true })
    const t1 = (type: string) => flameProbability(boss, [{ stat: 'str', tier: 1 }], type).p
    const at = (type: string, tier: number) => flameProbability(boss, [{ stat: 'str', tier }], type).p
    // 覺醒: final T3–T7 → "≥ T3" is the same event as "present"
    expect(at('awakened', 3)).toBeCloseTo(t1('awakened'), 12)
    expect(at('awakenedDark', 4)).toBeCloseTo(t1('awakenedDark'), 12)
    expect(at('awakened', 7)).toBeGreaterThan(0)
    // 強力 / 永遠: no bonus on boss items → T1–T3 only
    expect(at('strong', 4)).toBe(0)
    expect(at('eternal', 4)).toBe(0)
    // boss: always 4 lines → P(present) = 4/N
    const N = FLAME.poolFor(boss.isWeapon, boss.level).length
    expect(t1('awakened')).toBeCloseTo(4 / N, 12)
    // reverse never returns a tier outside the boss range
    for (const ls of reverseFlame(boss, { str: 84, dex: 21, luk: 21, def: 36 }))
      for (const l of ls) expect(l.tier).toBeGreaterThanOrEqual(FLAME.tierRange(true).min)
  })

  it('probability agrees with an independent Monte Carlo simulation', () => {
    const nonBoss = fakeEquip({ bossReward: false })
    const boss = fakeEquip({ bossReward: true })
    const cases: [EquipData, FlameLine[], string][] = [
      [nonBoss, [{ stat: 'str', tier: 2 }], 'awakenedDark'],
      [nonBoss, [{ stat: 'str', tier: 1 }, { stat: 'allStatPct', tier: 1 }], 'eternal'],
      [boss, [{ stat: 'str_luk', tier: 5 }, { stat: 'allStatPct', tier: 4 }], 'awakenedDark'],
      [boss, [{ stat: 'luk', tier: 2 }, { stat: 'def', tier: 1 }, { stat: 'allStatPct', tier: 2 }], 'strong'],
    ]
    const trials = 200_000
    cases.forEach(([equip, target, type], i) => {
      const exact = flameProbability(equip, target, type).p
      const mc = simulate(equip, target, type, trials, 1234 + i)
      const sigma = Math.sqrt((exact * (1 - exact)) / trials)
      expect(Math.abs(mc - exact)).toBeLessThan(5 * sigma + 1e-6)
    })
  })

  it('returns empty for impossible input within time budget', () => {
    const t0 = performance.now()
    const cases: Stats[] = [
      { str: 1 }, // below the smallest single-stat value at Lv250
      { str: 999999 },
      { str: 9999, dex: 9999, int: 9999, luk: 9999, maxHp: 99999, maxMp: 99999, def: 9999, att: 999, matt: 999, allStatPct: 99, speed: 99, jump: 99, levelReduce: 99 },
      { ignoreDef: 10 }, // never a flame stat
      { bossDamage: 2 }, // not in the non-weapon pool
      { str: 13 },
    ]
    for (const c of cases) expect(reverseFlame(hat, c)).toEqual([])
    // boss weapon with every weapon stat present and large: worst-case search
    const weapon = loadEquipSync(1472290)
    expect(
      reverseFlame(weapon, { str: 7777, dex: 7777, int: 7777, luk: 7777, maxHp: 77777, maxMp: 77777, def: 777, att: 777, matt: 777, bossDamage: 77, damagePct: 77, allStatPct: 77, levelReduce: 77 }),
    ).toEqual([])
    expect(performance.now() - t0).toBeLessThan(500)
  })

  it('flameNotes surfaces boss weapon low-tier ATT estimates', () => {
    const weapon = loadEquipSync(1472290) // 命運鬥拳 boss weapon
    expect(weapon.isWeapon && weapon.bossReward).toBe(true)
    expect(flameNotes(weapon, [{ stat: 'att', tier: 2 }])).toHaveLength(1)
    expect(flameNotes(weapon, [{ stat: 'att', tier: 5 }])).toEqual([])
    expect(flameNotes(hat, [{ stat: 'att', tier: 1 }])).toEqual([])
  })
})

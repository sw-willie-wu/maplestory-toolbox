// Structural checks of the rule data (not numeric correctness; Tasks 4–9 validate numbers against fixtures).
import { describe, expect, it } from 'vitest'
import { STARFORCE } from '../rules/starforce'
import { SCROLLS, RECOVERY } from '../rules/scroll'
import { HAMMER } from '../rules/hammer'
import { FLAME } from '../rules/flame'
import { EXCEPTIONAL } from '../rules/exceptional'
import { POTENTIAL, type RawPotentialOption } from '../rules/potential'
import { readDataJson, loadEquipSync } from './helpers'

const SOURCES = ['TMS', 'KMS-estimate']

describe('rules', () => {
  it('every rule carries a source', () => {
    for (const r of [STARFORCE, SCROLLS, RECOVERY, HAMMER, FLAME, POTENTIAL]) {
      expect(SOURCES).toContain(r.source)
      expect(r.ref.length).toBeGreaterThan(0)
    }
    if (EXCEPTIONAL) {
      expect(SOURCES).toContain(EXCEPTIONAL.source)
      expect(EXCEPTIONAL.ref.length).toBeGreaterThan(0)
    }
    for (const s of SCROLLS.items) if (s.source) expect(SOURCES).toContain(s.source)
  })

  it('starforce caps at 30', () => {
    expect(STARFORCE.maxStarByLevel(250)).toBe(30)
    expect(STARFORCE.maxStarByLevel(138)).toBe(30)
    expect(STARFORCE.maxStarByLevel(137)).toBe(20)
    expect(STARFORCE.maxStarByLevel(0)).toBe(5)
  })

  it('rates cover 0..29 and sum ≤ 1', () => {
    expect(STARFORCE.rates.map((r) => r.star)).toEqual(Array.from({ length: 30 }, (_, i) => i))
    for (const r of STARFORCE.rates) {
      for (const p of [r.success, r.destroy, r.keep, r.down]) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
      expect(r.success + r.destroy + r.keep + r.down).toBeLessThanOrEqual(1 + 1e-9)
      expect(r.success + r.destroy + r.keep + r.down).toBeGreaterThan(1 - 1e-9)
    }
  })

  it('starforce cost is positive and increases with star', () => {
    for (let s = 0; s < 29; s++) {
      expect(STARFORCE.costFormula(200, s)).toBeGreaterThan(0)
      expect(STARFORCE.costFormula(200, s) % 100).toBe(0)
    }
    expect(STARFORCE.costFormula(200, 22)).toBeGreaterThan(STARFORCE.costFormula(200, 10))
  })

  it('starforce cost matches the official TMS V272 table samples', () => {
    const cases: [number, number, number][] = [
      [150, 0, 94_800],
      [150, 2, 282_300], // raw 282,250: round half up, not banker's
      [150, 18, 212_666_000],
      [160, 17, 91_244_700],
      [200, 21, 269_601_800],
      [250, 20, 387_009_800],
      [250, 29, 1_013_810_000],
      [130, 15, 19_586_000],
      [130, 19, 35_776_100],
      [140, 18, 172_905_500],
      [140, 29, 133_531_800],
    ]
    for (const [level, star, cost] of cases) expect(STARFORCE.costFormula(level, star)).toBe(cost)
  })

  it('starforce stat tables reproduce 1005983 永恆盜賊頭巾 25★', () => {
    const hat = loadEquipSync(1005983)
    const gained: Record<string, number> = {}
    let hp = 0
    let def = hat.base.def!
    let att = 0
    for (let s = 1; s <= 25; s++) {
      for (const k of STARFORCE.statTable.statKeys(s, hat.jobs, false))
        gained[k] = (gained[k] ?? 0) + STARFORCE.statTable.perStar(hat.level, s)
      hp += STARFORCE.statTable.hpPerStar(s)
      def = STARFORCE.statTable.nextDef(def)
      if (s >= 16) att += STARFORCE.attTable.nonWeapon(hat.level, s)!
    }
    expect(gained).toEqual({ str: 119, dex: 159, int: 119, luk: 159 })
    expect(hp).toBe(255)
    expect(def - hat.base.def!).toBe(1816)
    expect(att).toBe(195)
    expect(STARFORCE.supports(hat)).toBe(true)
  })

  it('destroy return star never exceeds the destroyed star', () => {
    for (let s = 15; s < 30; s++) expect(STARFORCE.destroyReturnStar(s)).toBeLessThanOrEqual(s)
  })

  it('every scroll has a positive success rate and returns stats', () => {
    expect(SCROLLS.items.length).toBeGreaterThan(0)
    for (const s of SCROLLS.items) {
      expect(s.successRate).toBeGreaterThan(0)
      expect(s.successRate).toBeLessThanOrEqual(1)
      expect(typeof s.stats(150, 'Cp', undefined, 1)).toBe('object')
    }
  })

  it('hammer types are well formed', () => {
    expect(HAMMER.types.length).toBeGreaterThanOrEqual(1)
    for (const h of HAMMER.types) {
      expect(h.slotsPerUse).toBeGreaterThan(0)
      expect(h.max).toBeGreaterThan(0)
      // null = unknown in TMS (documented in sources.md)
      if (h.successRate !== null) expect(h.successRate).toBeGreaterThan(0)
      if (h.mesoCost) expect(h.mesoCost(200)).toBeGreaterThanOrEqual(0)
    }
    expect(HAMMER.types.map((h) => h.id).sort()).toEqual(['golden', 'platinum'])
    expect(HAMMER.types.find((h) => h.id === 'platinum')!.max).toBe(5)
  })

  it('scroll tables reproduce fixture items', () => {
    const b = SCROLLS.items.find((s) => s.id === 'b')!
    // 1005983 永恆盜賊頭巾 17× B: all stats 34, ATT 153
    expect(b.stats(250, 'Cp', undefined, 1)).toEqual({ str: 2, dex: 2, int: 2, luk: 2, att: 9 })
    const t15 = SCROLLS.items.find((s) => s.id === 'trace15')!
    // 1472290 命運鬥拳 9× 15% LUK: LUK 36, ATT 81
    expect(t15.stats(250, 'Wp', { stat: 'luk' }, 1)).toEqual({ luk: 4, att: 9 })
    // armor 15%: 4th success adds ATT 1
    expect(t15.stats(250, 'Cp', { stat: 'dex' }, 4)).toEqual({ dex: 10, maxHp: 170, def: 15, att: 1 })
  })

  it('flame boss uses 4 lines', () => {
    expect(FLAME.lineCount(true)).toEqual({ min: 4, max: 4 })
    expect(FLAME.lineProb(true)).toEqual({ 4: 1 })
    expect(FLAME.lineCount(false)).toEqual({ min: 1, max: 4 })
    // TMS official: 一般裝備 1/2/3/4 個 = 40/40/15/5%
    expect(FLAME.lineProb(false)).toEqual({ 1: 0.4, 2: 0.4, 3: 0.15, 4: 0.05 })
  })

  it('flame types match the TMS official probability table', () => {
    const byId = Object.fromEntries(FLAME.flameTypes.map((t) => [t.id, t]))
    expect(Object.keys(byId).sort()).toEqual(['awakened', 'awakenedDark', 'eternal', 'strong'])
    for (const t of FLAME.flameTypes) {
      const sum = Object.values(t.tierProb).reduce((a, b) => a + b, 0)
      expect(Math.abs(sum * 100 - 100)).toBeLessThanOrEqual(0.01 + 1e-9)
    }
    expect(byId.strong.tierProb).toEqual({ 1: 0.5, 2: 0.3, 3: 0.2 })
    expect(byId.awakenedDark.tierProb).toEqual({ 2: 0.85, 3: 0.13, 4: 0.015, 5: 0.005 })
    // +2 tiers on boss items only for the 覺醒 types
    expect(byId.awakened.bossTierBonus).toBe(2)
    expect(byId.awakenedDark.bossTierBonus).toBe(2)
    expect(byId.strong.bossTierBonus).toBe(0)
    expect(byId.eternal.bossTierBonus).toBe(0)
    expect(FLAME.finalTierProb(byId.awakenedDark, true)).toEqual({ 4: 0.85, 5: 0.13, 6: 0.015, 7: 0.005 })
    expect(FLAME.finalTierProb(byId.strong, true)).toEqual({ 1: 0.5, 2: 0.3, 3: 0.2 })
    // every reachable final tier lies inside tierRange
    for (const boss of [false, true]) {
      const range = FLAME.tierRange(boss)
      for (const t of FLAME.flameTypes)
        for (const tier of Object.keys(FLAME.finalTierProb(t, boss)).map(Number)) {
          expect(tier).toBeGreaterThanOrEqual(range.min)
          expect(tier).toBeLessThanOrEqual(range.max)
        }
    }
    expect(FLAME.tierRange(true)).toEqual({ min: 1, max: 7 })
    expect(FLAME.tierRange(false)).toEqual({ min: 1, max: 5 })
  })

  it('flame line pools follow the official lists and level gates', () => {
    const ids = (w: boolean, l: number) => FLAME.poolFor(w, l).map((s) => s.id)
    expect(ids(true, 200)).toHaveLength(19)
    expect(ids(false, 200)).toHaveLength(19)
    expect(ids(true, 89)).not.toContain('bossDamage')
    expect(ids(true, 90)).toContain('bossDamage')
    expect(ids(false, 59)).not.toContain('att')
    expect(ids(false, 60)).toContain('matt')
    expect(ids(false, 69)).not.toContain('allStatPct')
    expect(ids(false, 70)).toContain('allStatPct')
    expect(ids(true, 10)).toContain('allStatPct')
    expect(ids(true, 200)).not.toContain('speed')
    for (const s of FLAME.stats) expect(s.statKeys.length).toBeGreaterThan(0)
  })

  it('flame weapon ATT: boss formula, low boss tiers flagged as estimate', () => {
    // 1472290 命運鬥拳 base ATT 189, Lv250 boss: T5 = ceil(189 × 7×5×1.1² / 100) = 81
    expect(FLAME.tierValue('att', 250, 5, true, 189, true)).toBe(81)
    expect(FLAME.valueNote('att', 5, true, true)).toBeNull()
    // boss T2 (強力/永遠): extrapolated KMS formula, flagged
    expect(FLAME.tierValue('att', 250, 2, true, 189, true)).toBe(Math.ceil((189 * 7 * 2 * 1.1 ** -1) / 100 - 1e-9))
    expect(FLAME.valueNote('att', 2, true, true)).not.toBeNull()
    expect(FLAME.ruleSources.bossWeaponAttLowTier.source).toBe('KMS-estimate')
    expect(FLAME.tierValue('att', 250, 2, true, 189, false)).toBe(Math.ceil((189 * 7 * 2 * 1.1) / 100 - 1e-9))
    expect(FLAME.tierValue('att', 250, 1, false, 0, true)).toBe(1) // non-weapon: flat tier
    expect(FLAME.valueNote('att', 1, false, true)).toBeNull()
  })

  it('exceptional is null or well formed', () => {
    if (EXCEPTIONAL === null) return
    expect(EXCEPTIONAL.maxLevel).toBeGreaterThan(0)
    const eye = loadEquipSync(1022278) // fixture: level 1 = 15 / 750 / 10
    expect(EXCEPTIONAL.stats(eye, 0)).toEqual({})
    expect(EXCEPTIONAL.stats(eye, 1)).toMatchObject({ str: 15, maxHp: 750, att: 10 })
    const legacy = loadEquipSync(1143471) // 不朽的遺產: level 2 observed
    expect(EXCEPTIONAL.stats(legacy, 2)).toEqual({
      str: 40, dex: 40, int: 40, luk: 40, maxHp: 2000, maxMp: 2000, att: 30, matt: 30,
    })
    expect(EXCEPTIONAL.stats(legacy, 1)).toBeNull() // not observed → no data
    // 傲慢的原罪 is also Lv250 / Etuc 3 but never observed: must not borrow 不朽的遺產's values
    expect(EXCEPTIONAL.stats(loadEquipSync(1012911), 2)).toBeNull()
  })

  it('potential options build from the WZ export', () => {
    const raw = readDataJson<RawPotentialOption[]>('potential-options.json')
    const opts = POTENTIAL.buildOptions(raw)
    expect(POTENTIAL.grades).toHaveLength(4)
    expect(opts.length).toBeGreaterThan(100)
    expect(opts.every((o) => o.grade >= 1 && o.grade <= 4)).toBe(true)
    expect(opts.some((o) => o.kind === 'additional')).toBe(true)
    // legendary STR% (40041) on a level-250 hat resolves its template
    const strPct = opts.find((o) => o.id === 40041)!
    expect(POTENTIAL.resolveText(strPct, 250)).toMatch(/^STR \+\d+%$/)
    const hat = loadEquipSync(1005983)
    expect(POTENTIAL.slotGroupOf(hat.category, hat.slot)).toBe('cap')
    expect(POTENTIAL.fits(strPct, 'cap')).toBe(true)
  })
})

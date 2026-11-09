// 星力強化 (Star Force), normal (non-superior) equipment, TMS V272 "NEXT" rules (30★, no star drops).
// Sources: research/starforce.md → sources.md "STARFORCE". Superior items are not modelled (supports() → false).
import type { EquipData, JobGroup, Sourced, StatKey, Stats } from '../types'

export interface StarforceRate {
  /** Current star; the attempt goes star → star + 1. */
  star: number
  success: number
  destroy: number
  keep: number
  down: number
}

export interface StarforceEventEffect {
  /** Multiplies the base meso cost (before safeguard surcharge). */
  costMultiplier?: number
  /** Multiplies the destroy chance; the removed part goes to keep. */
  destroyMultiplier?: number
  /** Effect applies to attempts whose current star ≤ this (inclusive). Absent = all. */
  maxStar?: number
}

export interface StarforceEvent {
  id: string
  name: string
  effect: StarforceEventEffect
}

export interface VipDiscount {
  id: string
  name: string
  rate: number
  /** Applies to attempts whose current star ≤ this (inclusive). */
  maxStar: number
}

export interface StarforceStatTable {
  /** Main stat gained by reaching `star`. */
  perStar(level: number, star: number): number
  /**
   * Which main stats get that gain. 1–15★: the job's stats ('all' jobs → all four).
   * 16–22★: the job's stats plus every main stat the item already has after scrolls (`afterScroll` > 0;
   * flame stats do not count). Fixture: identical 永恆 items differ only by scroll (STR/INT 119 iff scrolled STR/INT).
   */
  statKeys(star: number, jobs: JobGroup[] | 'all', afterScroll: Stats): StatKey[]
  /** Max HP gained by reaching `star` (1–15★; 3★ = +5 per fixture). Not for `noHpSlots`. Weapon-table items also add the same MP. */
  hpPerStar(star: number): number
  /**
   * Slots without star force Max HP: gloves, shoes, face/eye accessories (W2) + earrings, hearts, badges (fixture).
   * 'Tm' is also the islot of 43 dragon / mechanic parts (194–197xxxx, 161–165xxxx); unverified for them (sources.md).
   */
  noHpSlots: readonly string[]
  /**
   * Slots without star force DEF: hearts, badges (fixture). Weapon-table items get no DEF either.
   * Hearts: only verified for 0-DEF hearts; hearts with base DEF > 0 are unverified (sources.md).
   * 'Tm' also covers 43 dragon / mechanic parts (194–197xxxx, 161–165xxxx): unverified for them (sources.md).
   */
  noDefSlots: readonly string[]
  /**
   * Last star that still adds DEF: 15 for the 172xxxx 阿斯特拉 secondaries (fixture: 0 DEF → fixed +16 at 19–25★,
   * i.e. the 1–15★ compounding only), Infinity for everything else. See ruleSources.astraDefCap.
   */
  defMaxStar(equip: EquipData): number
  /** Speed & jump gained by reaching `star` on shoes (1–15★). */
  shoeSpeedJumpPerStar(star: number): number
  /** Gloves ATT (or MATT, whichever the gloves have) gained by reaching `star` (1–15★). */
  gloveAttPerStar(star: number): number
  /** DEF after reaching the next star: def + floor(def × 0.05) + 1 (compounding, all stars). */
  nextDef(def: number): number
  /**
   * DEF the compounding starts from: items with 0 DEF after scrolls behave as if starting from 1
   * (fixture rings with 0 DEF: 8★ +9, 15★ +16, 25★ +32); the gain is still measured from the real DEF.
   */
  defSeed(def: number): number
}

export interface StarforceAttTable {
  /** Weapon 1–15★: att + floor(att × 0.02) + 1, compounding on base + scroll + earlier starforce ATT. */
  nextWeaponAttLow(att: number): number
  /** Weapon ATT/MATT gained by reaching `star` (16+); null = no sourced value. */
  weapon(level: number, star: number): number | null
  /** Non-weapon ATT & MATT gained by reaching `star` (16+); null = no sourced value. */
  nonWeapon(level: number, star: number): number | null
}

const MAIN: StatKey[] = ['str', 'dex', 'int', 'luk']
const JOB_STATS: Record<JobGroup, StatKey[]> = {
  warrior: ['str', 'dex'],
  magician: ['int', 'luk'],
  bowman: ['dex', 'str'],
  thief: ['luk', 'dex'],
  pirate: ['str', 'dex'],
}

// TMS official V272 table [S1]: [success, destroy] %, keep = rest, no star drop.
const RATE_TABLE: [number, number][] = [
  [95, 0], [90, 0], [85, 0], [85, 0], [80, 0], [75, 0], [70, 0], [65, 0], [60, 0], [55, 0],
  [50, 0], [45, 0], [40, 0], [35, 0], [30, 0],
  [30, 2.1], [30, 2.1], [15, 6.8], [12, 8.2], [10, 9],
  [30, 10.5], [20, 11.5], [17.5, 12.25], [8.5, 18], [8.5, 18], [8, 18], [7, 18.6], [5, 19], [3, 19.4], [1, 19.8],
]

/** Level bands for the 16★+ tables: [minLevel, value per star 16..30 (null = unsourced)]. */
type Band = [number, (number | null)[]]
const pick = (bands: Band[], level: number, star: number): number | null => {
  const band = bands.find(([min]) => level >= min)
  if (!band || star < 16) return null
  return band[1][star - 16] ?? null
}

// Main stat per star at 16–22★ (W2/G1/G2); 23★+ = 0.
const STAT_16: [number, number][] = [
  [250, 17], [200, 15], [160, 13], [150, 11], [138, 9], [128, 7],
]

// Non-weapon ATT/MATT per star, 16..30 (W2).
const NON_WEAPON_ATT: Band[] = [
  [250, [14, 15, 16, 17, 18, 19, 21, 23, 25, 27, 28, 29, 30, 31, 32]],
  [200, [12, 13, 14, 15, 16, 17, 19, 21, 23, 25, 26, 27, 28, 29, 30]],
  [160, [10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 24, 25, 26, 27, 28]],
  [150, [9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 23, 24, 25, 26, 27]],
  [138, [8, 9, 10, 11, 12, 13, 15, 17, 19, 21, 22, 23, 24, 25, 26]],
  [128, [7, 8, 9, 10, 11]],
]

// Weapon ATT/MATT per star, 16..30 (W2/G1/G2; 17★ follows the majority +1 reading).
// 250: 23–25★ from misaomaki, confirmed by fixture (命運調節器 24★ 362, 命運火槍 24★ 328, 命運弓箭 25★ 391);
//      26★+ unsourced. 138–199: 26★+ only guessed by masonym → null.
const WEAPON_ATT: Band[] = [
  [250, [16, 16, 17, 17, 18, 19, 20, 36, 37, 38]],
  [200, [13, 13, 14, 14, 15, 16, 17, 34, 35, 36, 37, 38, 39, 40, 41]],
  [160, [9, 9, 10, 11, 12, 13, 14, 32, 33, 34]],
  [150, [8, 9, 9, 10, 11, 12, 13, 31, 32, 33]],
  [138, [7, 8, 8, 9, 10, 11, 12, 30, 31, 32]],
  [128, [6, 7, 7, 8, 9]],
]

const HP_1_15 = [5, 5, 5, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25, 25]
// 11★ = 2: W2's per-star and cumulative tables disagree; every fixture shoe ≥15★ totals 18 → 11★ must be 2.
const SHOE_1_15 = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]
const GLOVE_1_15 = [0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1]

/** Current star → divisor for S ≥ 10 (TMS, reverse-engineered from the official V272 cost table, exact for all cells). */
function divisor(level: number, star: number): number {
  const low = [571, 314, 214, 157, 107] // 10..14
  if (star < 15) return low[star - 10]
  if (level < 140) return 200 // Lv128–139 (only Lv130 sampled), max 20★
  if (star <= 19) return [125, 120, 110, 45, 30][star - 15]
  if (level >= 250) return 150
  return star === 21 ? 125 : 200
}

/** Round half up to the nearest 100 (the official table rounds x50 up; not banker's rounding). */
const round100 = (x: number): number => Math.floor(x / 100 + 0.5) * 100

/** Rules whose source differs from the TMS default (STARFORCE.ruleSources). */
export type StarforceRuleKey =
  | 'maxStarByLevel'
  | 'starCatch'
  | 'destroyReturnStar'
  | 'destroyDown30'
  | 'discount30'
  | 'vipDiscounts'
  | 'statTable'
  | 'attTable'
  | 'usesWeaponTable'
  | 'astraDefCap'
  | 'safeguard'

export interface StarforceRules extends Sourced {
  /** false for superior equipment (different, unsourced rules) and equipment that cannot be star-forced. */
  supports(equip: EquipData): boolean
  maxStarByLevel(level: number): number
  rates: StarforceRate[]
  /** TMS has no star drops for normal equipment since V272, so no chance time. */
  chanceTime: { afterConsecutiveDowns: number } | null
  /** Base meso cost of one attempt from `star` (before discounts / safeguard). */
  costFormula(level: number, star: number): number
  statTable: StarforceStatTable
  attTable: StarforceAttTable
  /**
   * true when the weapon tables apply (ATT/MATT compounding 1–15★, weapon 16★+ ATT, MP, no DEF):
   * weapons outside slot Si, plus the 1354xxx secondaries (fixture 阿斯特拉靈符 1354312 MATT 399 = weapon table;
   * the rest of 135xxxx has no sample, so it stays on the non-weapon table).
   * Other secondaries (shields, 172xxxx 阿斯特拉 bracelets etc.) use the non-weapon table;
   * 1342xxx katara is UNVERIFIED (no fixture sample) — see ruleSources.usesWeaponTable.
   */
  usesWeaponTable(equip: EquipData): boolean
  /** Star the item continues from after being destroyed (trace restored with one identical item). */
  destroyReturnStar(star: number): number
  events: StarforceEvent[]
  vipDiscounts: VipDiscount[]
  /** Success-rate multiplier of the former star catch; since its removal always applied. */
  starCatch: { multiplier: number; alwaysOn: boolean }
  /** Safeguard for current stars fromStar..toStar (inclusive); surcharge = costMultiplier × undiscounted base cost. */
  safeguard: { fromStar: number; toStar: number; costMultiplier: number }
  /** Per-rule source overrides (rules whose source differs from the TMS default). */
  ruleSources: Record<StarforceRuleKey, Sourced>
}

export const STARFORCE: StarforceRules = {
  source: 'TMS',
  ref:
    '新楓之谷《0626(四) 星力系統改編事前說明》https://maplestory.beanfun.com/bulletin?bid=74681 (2025-06-26, V272 2025-07-30): ' +
    'rates, 30★ cap, no star drop, safeguard 15–17★ +200%, cost table ; see sources.md STARFORCE',

  supports(equip) {
    return equip.canStarforce && !equip.superior
  },

  maxStarByLevel(level) {
    if (level >= 138) return 30
    if (level >= 128) return 20
    if (level >= 118) return 15
    if (level >= 108) return 10
    if (level >= 95) return 8
    return 5
  },

  rates: RATE_TABLE.map(([s, d], star) => {
    const success = s / 100
    const destroy = d / 100
    return { star, success, destroy, keep: Math.round((1 - success - destroy) * 1e6) / 1e6, down: 0 }
  }),

  chanceTime: null,

  costFormula(level, star) {
    const l3 = level ** 3
    if (star < 10) return round100(1000 + (l3 * (star + 1)) / 36)
    return round100(1000 + (l3 * (star + 1) ** 2.7) / divisor(level, star))
  },

  statTable: {
    perStar(level, star) {
      if (star <= 5) return 2
      if (star <= 15) return 3
      if (star <= 22) return STAT_16.find(([min]) => level >= min)?.[1] ?? 0
      return 0
    },
    statKeys(star, jobs, afterScroll) {
      const job = jobs === 'all' ? MAIN : [...new Set(jobs.flatMap((j) => JOB_STATS[j]))]
      if (star <= 15) return job
      if (star <= 22) return MAIN.filter((k) => job.includes(k) || (afterScroll[k] ?? 0) > 0)
      return []
    },
    hpPerStar: (star) => HP_1_15[star - 1] ?? 0,
    noHpSlots: ['Gv', 'So', 'Af', 'Ay', 'Ae', 'Tm', 'Ba'],
    noDefSlots: ['Tm', 'Ba'],
    defMaxStar: (equip) => (Math.floor(equip.id / 10000) === 172 && equip.slot === 'Si' ? 15 : Infinity),
    shoeSpeedJumpPerStar: (star) => SHOE_1_15[star - 1] ?? 0,
    gloveAttPerStar: (star) => GLOVE_1_15[star - 1] ?? 0,
    nextDef: (def) => def + Math.floor(def * 0.05) + 1,
    defSeed: (def) => Math.max(def, 1),
  },

  attTable: {
    nextWeaponAttLow: (att) => att + Math.floor(att * 0.02) + 1,
    weapon: (level, star) => pick(WEAPON_ATT, level, star),
    nonWeapon: (level, star) => pick(NON_WEAPON_ATT, level, star),
  },

  usesWeaponTable(equip) {
    if (equip.slot !== 'Si') return equip.isWeapon
    return equip.category === 'Weapon' && Math.floor(equip.id / 1000) === 1354
  },

  destroyReturnStar() {
    return 12
  },

  events: [
    { id: 'discount30', name: '星力強化 30% 折扣', effect: { costMultiplier: 0.7 } },
    { id: 'destroyDown30', name: '21 星以下破壞機率減少 30%', effect: { destroyMultiplier: 0.7, maxStar: 21 } },
  ],

  vipDiscounts: [
    { id: 'gold', name: 'VIP 金牌', rate: 0.03, maxStar: 16 },
    { id: 'diamond', name: 'VIP 鑽石', rate: 0.05, maxStar: 16 },
    { id: 'royal', name: 'VIP 皇家以上', rate: 0.1, maxStar: 16 },
  ],

  starCatch: { multiplier: 1.05, alwaysOn: true },

  safeguard: { fromStar: 15, toStar: 17, costMultiplier: 2 },

  ruleSources: {
    maxStarByLevel: { source: 'KMS-estimate', ref: 'https://maplestorywiki.net/w/Star_Force_Enhancement (Maximum Star Force Value); 30★ for Lv138+ also in TMS bid=74681' },
    starCatch: {
      source: 'KMS-estimate',
      ref: 'https://maplestorywiki.net/w/Star_Force_Enhancement#Star_Catch (removed in Crown, ×1.05 always applied); no TMS text (TMS CROWN V280 2026-06-24)',
    },
    destroyReturnStar: {
      source: 'KMS-estimate',
      ref: 'https://maplestorywiki.net/w/Star_Force_Enhancement#Trace_Transfer (one identical item → 12★); no TMS text',
    },
    destroyDown30: { source: 'KMS-estimate', ref: 'orangemushroom KMS 1.2.401 (2025-03-20) ; maplestorywiki Destruction section' },
    discount30: { source: 'TMS', ref: '星期天楓之谷 https://maplestory-event.beanfun.com/eventad/eventad?eventadid=8871' },
    vipDiscounts: { source: 'TMS', ref: '【VIP系統】https://maplestory-event.beanfun.com/eventad/eventad?eventadid=12590 (V269, 2025-04-01): 星力強化 1~16 星' },
    statTable: {
      source: 'KMS-estimate',
      ref: 'https://maplestorywiki.net/w/Star_Force_Enhancement/Stat_Tables ; masonym.dev starforce.js ; fixture checks in sources.md',
    },
    attTable: {
      source: 'KMS-estimate',
      ref: 'https://maplestorywiki.net/w/Star_Force_Enhancement/Stat_Tables ; MikuTracker starForce.ts (2026-10-24) ; fixture checks in sources.md',
    },
    usesWeaponTable: {
      source: 'KMS-estimate',
      ref:
        'fixture (sources.md STARFORCE): weapons / 1354xxx 靈符 → weapon table, shields / 172xxxx → non-weapon table; ' +
        '1342xxx katara (dual blade) non-weapon table is UNVERIFIED (no fixture sample), as is the rest of 135xxxx',
    },
    safeguard: {
      source: 'TMS',
      ref:
        '新楓之谷《0626(四) 星力系統改編事前說明》https://maplestory.beanfun.com/bulletin?bid=74681 (2025-06-26, V272): ' +
        '防爆 15→16 ~ 17→18, +200% base cost',
    },
    astraDefCap: {
      source: 'TMS',
      ref:
        'fixture (Nexon API, sources.md STARFORCE): 5 阿斯特拉 172xxxx secondaries at 19–25★ all have star force DEF +16 ' +
        '(= 0 DEF seeded at 1, compounding 1–15★ only); no rule text found',
    },
  },
}

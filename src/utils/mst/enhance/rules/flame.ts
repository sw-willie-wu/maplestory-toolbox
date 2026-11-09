// 追加屬性 (bonus stats / flames). Sources → sources.md "FLAME".
// TMS official probability page (eventAdId=8389): flame types, tier probabilities, line-count probabilities,
// line pools and level gates. Per-tier VALUES are not on that page: KMS (maplestorywiki stat tables) + fixture checks.
import type { StatKey, Sourced } from '../types'

export interface FlameStatDef {
  id: string
  name: string
  /** Dual-stat lines add the same value to both keys. */
  statKeys: StatKey[]
  /** Can roll on weapons / on non-weapons. */
  weapon: boolean
  nonWeapon: boolean
  /** Minimum required equipment level for weapons / non-weapons (0 = none). */
  minLevelWeapon?: number
  minLevelNonWeapon?: number
}

export interface FlameTypeDef {
  id: string
  name: string
  /** Probability per ROLLED tier 1..5 (official TMS table). */
  tierProb: Record<number, number>
  /** Tiers added on boss-reward equipment: 2 for 覺醒 / 覺醒的暗黑 (final T3–T7), 0 for 強力 / 永遠 (final T1–T3). */
  bossTierBonus: 0 | 2
}

export type FlameRuleKey = 'probabilities' | 'lineTypes' | 'tierValues' | 'bossWeaponAttLowTier'

export interface FlameRules extends Sourced {
  stats: FlameStatDef[]
  /**
   * Value one line adds to each of its stat keys.
   * Weapon ATT/MATT: percentage of `baseAtt` (the weapon's base ATT for the ATT line, base MATT for the MATT line;
   * when the weapon has no base MATT the MATT line uses base ATT — fixture 1452287 命運弓箭), rounded up.
   * `bossReward` only matters for weapon ATT/MATT (exponent tier − 3 instead of tier − 1). Boss weapon ATT/MATT at
   * T1/T2 (reachable in TMS via 強力 / 永遠) extrapolates that formula: see `valueNote` and ruleSources.bossWeaponAttLowTier.
   */
  tierValue(stat: string, level: number, tier: number, isWeapon: boolean, baseAtt: number, bossReward?: boolean): number
  /** Non-null when tierValue for these inputs is an unverified extrapolation (UI shows the note). */
  valueNote(stat: string, tier: number, isWeapon: boolean, bossReward: boolean): string | null
  lineCount(bossReward: boolean): { min: number; max: number }
  /** Probability of 1..4 lines when rerolled with a flame (non-boss); boss is always 4. */
  lineProb(bossReward: boolean): Record<number, number>
  tierRange(bossReward: boolean): { min: number; max: number }
  flameTypes: FlameTypeDef[]
  /** Probability per FINAL tier for this flame type on this equipment. */
  finalTierProb(type: FlameTypeDef, bossReward: boolean): Record<number, number>
  ruleSources: Record<FlameRuleKey, Sourced>
  /** Lines that can roll on this equipment (equal probability, no duplicates). */
  poolFor(isWeapon: boolean, level: number): FlameStatDef[]
}

const S = (id: string, name: string, keys: StatKey[], weapon: boolean, nonWeapon: boolean, extra: Partial<FlameStatDef> = {}): FlameStatDef => ({
  id,
  name,
  statKeys: keys,
  weapon,
  nonWeapon,
  ...extra,
})

const STATS: FlameStatDef[] = [
  S('str', 'STR', ['str'], true, true),
  S('dex', 'DEX', ['dex'], true, true),
  S('int', 'INT', ['int'], true, true),
  S('luk', 'LUK', ['luk'], true, true),
  S('str_dex', 'STR + DEX', ['str', 'dex'], true, true),
  S('str_int', 'STR + INT', ['str', 'int'], true, true),
  S('str_luk', 'STR + LUK', ['str', 'luk'], true, true),
  S('dex_int', 'DEX + INT', ['dex', 'int'], true, true),
  S('dex_luk', 'DEX + LUK', ['dex', 'luk'], true, true),
  S('int_luk', 'INT + LUK', ['int', 'luk'], true, true),
  S('maxHp', '最大 HP', ['maxHp'], true, true),
  S('maxMp', '最大 MP', ['maxMp'], true, true),
  S('levelReduce', '穿戴等級減少', ['levelReduce'], true, true),
  S('def', '防禦力', ['def'], true, true),
  S('att', '攻擊力', ['att'], true, true, { minLevelNonWeapon: 60 }),
  S('matt', '魔力', ['matt'], true, true, { minLevelNonWeapon: 60 }),
  S('bossDamage', '攻擊BOSS怪物時傷害%', ['bossDamage'], true, false, { minLevelWeapon: 90 }),
  S('damagePct', '傷害%', ['damagePct'], true, false),
  S('allStatPct', '全屬性%', ['allStatPct'], true, true, { minLevelNonWeapon: 70 }),
  S('speed', '移動速度', ['speed'], false, true),
  S('jump', '跳躍力', ['jump'], false, true),
]

/** Single stat / DEF per tier: floor(level/20)+1, capped at 12 (wiki table "230+ = 12"; fixture DEF 36 at Lv250 T3). */
function singleCoef(level: number): number {
  return Math.min(Math.floor(level / 20) + 1, 12)
}

/** Dual stat per tier: wiki table 0-39:1 … 160-199:5, 200-249:6, 250+:7 (table preferred over formula at 240-249). */
function dualCoef(level: number): number {
  if (level >= 250) return 7
  if (level >= 200) return 6
  return Math.floor(level / 40) + 1
}

/** Max HP / MP per tier (wiki table). */
function hpCoef(level: number): number {
  if (level < 10) return 3
  if (level < 200) return Math.floor(level / 10) * 30
  if (level < 250) return 600 + Math.floor((level - 200) / 10) * 20
  return 700
}

/** Weapon ATT/MATT percentage for a final tier. */
function weaponAttPct(level: number, tier: number, bossReward: boolean): number {
  return (Math.floor(level / 40) + 1) * tier * Math.pow(1.1, bossReward ? tier - 3 : tier - 1)
}

/** Official percentages for rolled tiers 1..5 → probabilities (zero rows dropped). */
const pct = (values: number[]): Record<number, number> => {
  const out: Record<number, number> = {}
  values.forEach((v, i) => {
    if (v > 0) out[i + 1] = v / 100
  })
  return out
}

const OFFICIAL_REF =
  'TMS 官方機率公告「裝備附加屬性」https://maplestory-event.beanfun.com/eventad/eventad?eventadid=8389 ' +
  '(→ beanfun-event.beanfun.com/EventAD_Mobile/EventAD?eventAdId=8389, retrieved 2026-11-09)'
const BOSS_LOW_ATT_NOTE = 'BOSS 裝武器攻/魔 T1–T2：KMS 公式外推（指數 階−3），無來源驗證'

export const FLAME: FlameRules = {
  source: 'TMS',
  ref: OFFICIAL_REF + ' ; per-tier values: see ruleSources.tierValues',
  stats: STATS,
  ruleSources: {
    probabilities: { source: 'TMS', ref: OFFICIAL_REF },
    lineTypes: { source: 'TMS', ref: OFFICIAL_REF },
    tierValues: {
      source: 'KMS-estimate',
      ref: 'https://maplestorywiki.net/w/Bonus_Stats/Stat_Tables (2026-09-26) ; fixture checks in sources.md FLAME',
    },
    bossWeaponAttLowTier: {
      source: 'KMS-estimate',
      ref: 'Extrapolation of the KMS boss weapon formula (1.1^(tier−3)) to T1/T2; no source, no fixture sample',
    },
  },

  tierValue(stat, level, tier, isWeapon, baseAtt, bossReward = false) {
    switch (stat) {
      case 'str':
      case 'dex':
      case 'int':
      case 'luk':
      case 'def':
        return singleCoef(level) * tier
      case 'str_dex':
      case 'str_int':
      case 'str_luk':
      case 'dex_int':
      case 'dex_luk':
      case 'int_luk':
        return dualCoef(level) * tier
      case 'maxHp':
      case 'maxMp':
        return hpCoef(level) * tier
      case 'levelReduce':
        return 5 * tier
      case 'att':
      case 'matt':
        if (!isWeapon) return tier
        // -1e-9 guards against float noise turning an exact integer into the next one.
        return Math.ceil((baseAtt * weaponAttPct(level, tier, bossReward)) / 100 - 1e-9)
      case 'bossDamage':
        return 2 * tier
      case 'damagePct':
      case 'allStatPct':
      case 'speed':
      case 'jump':
        return tier
      default:
        throw new Error(`unknown flame stat ${stat}`)
    }
  },

  valueNote(stat, tier, isWeapon, bossReward) {
    return isWeapon && bossReward && tier < 3 && (stat === 'att' || stat === 'matt') ? BOSS_LOW_ATT_NOTE : null
  },

  lineCount(bossReward) {
    return bossReward ? { min: 4, max: 4 } : { min: 1, max: 4 }
  },

  lineProb(bossReward): Record<number, number> {
    if (bossReward) return { 4: 1 }
    return { 1: 0.4, 2: 0.4, 3: 0.15, 4: 0.05 }
  },

  tierRange(bossReward) {
    // Boss: 強力 / 永遠 give T1–T3 (no bonus), 覺醒 types give T3–T7 → T1–T7 overall. Non-boss: T1–T5.
    return bossReward ? { min: 1, max: 7 } : { min: 1, max: 5 }
  },

  flameTypes: [
    { id: 'strong', name: '強力的輪迴星火', tierProb: pct([50, 30, 20, 0, 0]), bossTierBonus: 0 },
    { id: 'eternal', name: '永遠的輪迴星火', tierProb: pct([44.44, 33.33, 22.22, 0, 0]), bossTierBonus: 0 },
    { id: 'awakened', name: '覺醒的輪迴星火', tierProb: pct([97.36, 1.5, 0.58, 0.33, 0.23]), bossTierBonus: 2 },
    { id: 'awakenedDark', name: '覺醒的暗黑輪迴星火', tierProb: pct([0, 85, 13, 1.5, 0.5]), bossTierBonus: 2 },
  ],

  finalTierProb(type, bossReward) {
    const shift = bossReward ? type.bossTierBonus : 0
    const out: Record<number, number> = {}
    for (const [t, p] of Object.entries(type.tierProb)) out[Number(t) + shift] = p
    return out
  },

  poolFor(isWeapon, level) {
    return STATS.filter((s) =>
      isWeapon ? s.weapon && level >= (s.minLevelWeapon ?? 0) : s.nonWeapon && level >= (s.minLevelNonWeapon ?? 0),
    )
  },
}

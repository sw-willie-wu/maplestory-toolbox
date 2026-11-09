// 卓越強化 (Exceptional Enhancement). Per-level stats are not in WZ (only Etuc = max level) and no TMS/KMS table
// was found, so stats are read off the Nexon API fixture (`exceptional` field, 17 items, 5 item ids) and only for
// the (item id, enhancement level) pairs that were actually observed. Anything else returns null
// ("no data") instead of an extrapolation. Success rate / cost: GMS wiki values, marked KMS-estimate.
import type { EquipData, Sourced, Stats } from '../types'

export interface ExceptionalRules {
  maxLevel: number
  /** Cumulative stats at `level`; {} at level 0; null = no observed data for this item / enhancement level. */
  stats(equip: EquipData, level: number): Stats | null
  /** Success rate of the attempt from `level` to `level + 1`. */
  successRate?(level: number): number
  /** Meso cost of the attempt from `level` to `level + 1`. */
  cost?(level: number): number
  /** Source of successRate/cost when it differs from the stats source. */
  attemptSource?: Sourced
}

const block = (stat: number, hpMp: number, att: number): Stats => ({
  str: stat,
  dex: stat,
  int: stat,
  luk: stat,
  maxHp: hpMp,
  maxMp: hpMp,
  att,
  matt: att,
})

/** Observed cumulative stats: item id → enhancement level → stats (fixture only; no cross-item borrowing). */
const OBSERVED: Record<number, Record<number, Stats>> = {
  1012632: { 1: block(15, 750, 10) }, // 口紅控制器標誌 Lv160 (4 fixture items)
  1022278: { 1: block(15, 750, 10) }, // 附有魔力的眼罩 Lv160 (6 fixture items)
  1032316: { 1: block(20, 1000, 15) }, // 指揮官力量耳環 Lv200 (1 fixture item)
  1132308: { 1: block(20, 1000, 15) }, // 夢幻的腰帶 Lv200 (3 fixture items)
  1143471: { 2: block(40, 2000, 30) }, // 不朽的遺產 Lv250 (3 fixture items); levels 1 and 3 not observed
  // 1012911 傲慢的原罪 (Lv250, Etuc 3): never observed → always null
}

// GMS wiki: 0→1 100%, 1→2 50%, 2→3 25% (one hammer); cost 0 / 2.5B / 5B mesos.
const RATE = [1, 0.5, 0.25]
const COST = [0, 2_500_000_000, 5_000_000_000]

export const EXCEPTIONAL: (ExceptionalRules & Sourced) | null = {
  source: 'TMS',
  ref:
    'derived from Nexon fixture ids 1012632, 1022278 (lv160, level 1), 1032316, 1132308 (lv200, level 1), ' +
    '1143471 (lv250, level 2); max level from WZ info/Etuc',
  maxLevel: 3,
  stats(equip, level) {
    const lv = Math.max(0, Math.min(level, equip.exceptionalMax))
    if (lv === 0) return {}
    const row = OBSERVED[equip.id]?.[lv]
    return row ? { ...row } : null
  },
  successRate: (level) => RATE[level] ?? 0,
  cost: (level) => COST[level] ?? 0,
  attemptSource: {
    source: 'KMS-estimate',
    ref: 'GMS values: https://maplestorywiki.net/w/Exceptional_Enhancement (fetched 2026-11-09); TMS not verified',
  },
}

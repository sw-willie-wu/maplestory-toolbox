// 追加屬性（星火）: stats from lines, probability of one flame use, reverse decomposition (Task 7).
// Rules (TMS official probabilities / pools, KMS-estimate per-tier values) live in rules/flame.ts — see sources.md FLAME.
// Per-line value notes (estimates) are exposed through `flameNotes`; rule-level sources via FLAME.ruleSources.
import { FLAME, type FlameStatDef } from './rules/flame'
import type { EquipData, StatKey, Stats } from './types'

/** One flame line: `stat` is a FLAME.stats id; the same stat never appears twice on an item. */
export type FlameLine = { stat: string; tier: number }

const STAT_BY_ID = new Map(FLAME.stats.map((s) => [s.id, s]))

/** Base value a weapon ATT / MATT line scales from (no base MATT → base ATT, sources.md FLAME). */
function baseAttFor(equip: EquipData, stat: string): number {
  if (stat === 'matt') return equip.base.matt || equip.base.att || 0
  return equip.base.att ?? 0
}

function lineValue(equip: EquipData, stat: string, tier: number): number {
  return FLAME.tierValue(stat, equip.level, tier, equip.isWeapon, baseAttFor(equip, stat), equip.bossReward)
}

/** Stats added by these flame lines. Items that cannot be flamed get {}. Unknown stat ids throw. */
export function flameStats(equip: EquipData, lines: FlameLine[]): Stats {
  const out: Stats = {}
  if (!equip.canFlame) return out
  for (const l of lines) {
    const def = STAT_BY_ID.get(l.stat)
    if (!def) throw new Error(`unknown flame stat ${l.stat}`)
    const v = lineValue(equip, l.stat, l.tier)
    for (const k of def.statKeys) out[k] = (out[k] ?? 0) + v
  }
  return out
}

/** Estimate notes (FLAME.valueNote) for these lines — the UI must show them next to the values. */
export function flameNotes(equip: EquipData, lines: FlameLine[]): string[] {
  const notes = new Set<string>()
  for (const l of lines) {
    const n = FLAME.valueNote(l.stat, l.tier, equip.isWeapon, equip.bossReward)
    if (n) notes.add(n)
  }
  return [...notes]
}

/** C(n, k) for small n. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/**
 * P(every target stat appears with final tier ≥ its target tier; other lines unconstrained) for ONE use of
 * `flameTypeId`, and the expected number of uses (1/p, Infinity when p = 0).
 *
 * Model (TMS official, sources.md FLAME): line count n drawn from FLAME.lineProb; n distinct lines drawn from the
 * item's pool with equal probability (no duplicates); each line's final tier drawn independently from
 * FLAME.finalTierProb. Exact enumeration over n ≤ 4:
 *   p = Σ_n q_n · C(N−k, n−k) / C(N, n) · Π_i P(tier ≥ t_i)
 * Tier tables are normalised by their sum (永遠 sums to 99.99% from official rounding).
 * canFlame=false → { p: 0, expected: Infinity } (also for an empty target: the item cannot be flamed at all).
 * Duplicate target stats keep the highest tier. Unknown flameTypeId throws.
 */
export function flameProbability(
  equip: EquipData,
  target: FlameLine[],
  flameTypeId: string,
): { p: number; expected: number } {
  const type = FLAME.flameTypes.find((t) => t.id === flameTypeId)
  if (!type) throw new Error(`unknown flame type ${flameTypeId}`)
  if (!equip.canFlame) return { p: 0, expected: Infinity }

  const want = new Map<string, number>()
  for (const t of target) want.set(t.stat, Math.max(want.get(t.stat) ?? -Infinity, t.tier))

  const pool = new Set(FLAME.poolFor(equip.isWeapon, equip.level).map((s) => s.id))
  for (const stat of want.keys()) if (!pool.has(stat)) return { p: 0, expected: Infinity }

  const tiers = FLAME.finalTierProb(type, equip.bossReward)
  const tierTotal = Object.values(tiers).reduce((a, b) => a + b, 0)
  const atLeast = (min: number) =>
    Object.entries(tiers).reduce((s, [t, p]) => (Number(t) >= min ? s + p : s), 0) / tierTotal

  let tierP = 1
  for (const min of want.values()) tierP *= atLeast(min)

  const N = pool.size
  const k = want.size
  let presentP = 0
  for (const [n, q] of Object.entries(FLAME.lineProb(equip.bossReward))) {
    presentP += q * (choose(N - k, Number(n) - k) / choose(N, Number(n)))
  }

  const p = presentP * tierP
  return { p, expected: p > 0 ? 1 / p : Infinity }
}

interface Cand {
  def: FlameStatDef
  tier: number
  value: number
}

const MAIN_STATS: StatKey[] = ['str', 'dex', 'int', 'luk']

/**
 * All line sets that produce exactly the observed flame stats (zero entries ignored), up to `limit` results.
 * Constraints: line pool + level gates of this item, line count (FLAME.lineCount), tier range (FLAME.tierRange),
 * no duplicate stats, and on boss items the one-flame family rule: all lines T1–T3 (強力/永遠, no bonus) or all
 * T3–T7 (覺醒 types, +2). Lines are listed in FLAME.stats order.
 * canFlame=false or impossible input → []. Empty observed → [[]] (an unflamed item).
 */
export function reverseFlame(equip: EquipData, observed: Stats, limit = 50): FlameLine[][] {
  if (!equip.canFlame) return []
  const remaining = new Map<StatKey, number>()
  for (const [k, v] of Object.entries(observed) as [StatKey, number][]) if (v) remaining.set(k, v)
  if (remaining.size === 0) return [[]]
  for (const v of remaining.values()) if (v < 0 || !Number.isInteger(v)) return []

  const lc = FLAME.lineCount(equip.bossReward)
  const range = FLAME.tierRange(equip.bossReward)
  // Boss items: one flame use fixes the family → tier window per family.
  const families = equip.bossReward
    ? [
        { min: Math.max(range.min, 1), max: Math.min(range.max, 3) },
        { min: Math.max(range.min, 3), max: range.max },
      ]
    : [range]

  // Candidate stats: only those whose every key is observed (any other key would stay non-zero).
  const pool = FLAME.poolFor(equip.isWeapon, equip.level).filter((d) => d.statKeys.every((k) => remaining.has(k)))
  for (const k of remaining.keys()) if (!pool.some((d) => d.statKeys.includes(k))) return []

  const results: FlameLine[][] = []
  const seen = new Set<string>()

  for (const fam of families) {
    // Per stat: tiers in this family whose value fits under the observed amounts.
    const cands: Cand[][] = pool.map((def) => {
      const list: Cand[] = []
      for (let tier = fam.min; tier <= fam.max; tier++) {
        const value = lineValue(equip, def.id, tier)
        if (value > 0 && def.statKeys.every((k) => value <= remaining.get(k)!)) list.push({ def, tier, value })
      }
      return list
    })
    // Last pool index that can still reduce each key (coverage pruning).
    const lastIdx = new Map<StatKey, number>()
    pool.forEach((d, i) => {
      if (cands[i].length) for (const k of d.statKeys) lastIdx.set(k, i)
    })
    if ([...remaining.keys()].some((k) => !lastIdx.has(k))) continue

    const chosen: Cand[] = []
    const rem = new Map(remaining)

    /** Lower bound on lines still needed: each non-main key needs its own line; a dual line covers two main stats. */
    const minLinesNeeded = (): number => {
      let main = 0
      let other = 0
      for (const [k, v] of rem) if (v > 0) (MAIN_STATS.includes(k) ? main++ : other++)
      return other + Math.ceil(main / 2)
    }

    const dfs = (i: number): void => {
      if (results.length >= limit) return
      const need = minLinesNeeded()
      if (need === 0) {
        if (chosen.length >= lc.min && chosen.length <= lc.max) {
          const lines = chosen.map((c) => ({ stat: c.def.id, tier: c.tier }))
          const key = JSON.stringify(lines)
          if (!seen.has(key)) {
            seen.add(key)
            results.push(lines)
          }
        }
        // Extra lines would add positive values to observed keys only if they could still fit — they cannot,
        // since every key is now exactly 0.
        return
      }
      if (i >= pool.length || chosen.length + need > lc.max) return
      for (const [k, v] of rem) if (v > 0 && lastIdx.get(k)! < i) return

      const keys = pool[i].statKeys
      for (const c of cands[i]) {
        if (!keys.every((k) => c.value <= rem.get(k)!)) continue
        for (const k of keys) rem.set(k, rem.get(k)! - c.value)
        chosen.push(c)
        dfs(i + 1)
        chosen.pop()
        for (const k of keys) rem.set(k, rem.get(k)! + c.value)
      }
      dfs(i + 1)
    }
    dfs(0)
  }
  return results
}

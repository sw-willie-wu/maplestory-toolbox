// Scroll slots, scroll stats and expected scroll usage. Rules: rules/scroll.ts (sources.md "SCROLLS / RECOVERY").
import { hammerSlots, type HammerState } from './hammer'
import { RECOVERY, SCROLLS, scrollGroupOf, type ScrollChoice, type ScrollDef } from './rules/scroll'
import type { EquipData, StatKey, Stats } from './types'

export type { HammerState } from './hammer'

/**
 * `count` = successful scrolls. `choice`: spell trace stat ('str' | 'dex' | 'int' | 'luk' | 'maxHp'; 'int' gives the
 * MATT version) or the ATT/MATT version of fixed scrolls ('att' | 'matt'). Default: magician gear → INT/MATT, else STR/ATT.
 * `avgPerScroll`: random-value scrolls only — the user's average gain per scroll.
 */
export type ScrollEntry = {
  scrollId: string
  count: number
  choice?: string
  avgPerScroll?: Stats
}
export interface ScrollState {
  entries: ScrollEntry[]
  /** Failed scrolls that still occupy slots (recoverable with 純白卷軸). */
  failCount: number
}

const nonNeg = (n: number) => Math.max(0, Math.floor(n || 0))

function scrollDef(id: string): ScrollDef {
  const def = SCROLLS.items.find((s) => s.id === id)
  if (!def) throw new Error(`unknown scroll ${id}`)
  return def
}

function isMagicianGear(equip: EquipData): boolean {
  return equip.isMagicWeapon || (Array.isArray(equip.jobs) && equip.jobs.length === 1 && equip.jobs[0] === 'magician')
}

function parseChoice(equip: EquipData, entry: ScrollEntry): ScrollChoice {
  const c = entry.choice
  const out: ScrollChoice = {}
  if (c === 'str' || c === 'dex' || c === 'luk' || c === 'maxHp') out.stat = c
  else if (c === 'int') {
    out.stat = 'int'
    out.magic = true
  } else if (c === 'att') out.magic = false
  else if (c === 'matt') out.magic = true
  else if (c === undefined) {
    if (isMagicianGear(equip)) {
      out.stat = 'int'
      out.magic = true
    }
  } else throw new Error(`unknown scroll choice ${c}`)
  if (out.stat === undefined && out.magic) out.stat = 'int'
  if (entry.avgPerScroll) out.values = entry.avgPerScroll
  return out
}

function addInto(out: Stats, s: Stats, times = 1): void {
  for (const [k, v] of Object.entries(s) as [StatKey, number][]) out[k] = (out[k] ?? 0) + v * times
}

/** Scroll slots: WZ tuc + hammer slots; 0 for items without scroll slots. */
export function totalSlots(equip: EquipData, hammer: HammerState): number {
  if (equip.tuc <= 0) return 0
  return equip.tuc + hammerSlots(equip, hammer)
}

/** Successful-scroll counts per entry after clamping to the slots left by failures (later entries are cut first). */
function clampedCounts(state: ScrollState, capacity: number): number[] {
  let left = Math.max(0, capacity)
  return state.entries.map((e) => {
    const n = Math.min(nonNeg(e.count), left)
    left -= n
    return n
  })
}

/**
 * Stats from successful scrolls, in entry order. Scrolls beyond totalSlots − failCount are dropped (the same clamp as
 * scrollSummary's overflowScrolls). Spell trace `nth` = cumulative count of successful spell traces of any grade on
 * the item, in entry order (armor 4th-success ATT bonus, 推測 → SCROLLS.ruleSources.traceFourthBonus); other scrolls
 * do not advance it.
 */
export function scrollStats(equip: EquipData, state: ScrollState, hammer: HammerState): Stats {
  const counts = clampedCounts(state, totalSlots(equip, hammer) - nonNeg(state.failCount))
  const out: Stats = {}
  let traceNth = 0
  state.entries.forEach((entry, i) => {
    const n = counts[i]
    if (n === 0) return
    const def = scrollDef(entry.scrollId)
    const choice = parseChoice(equip, entry)
    if (def.kind === 'random') {
      addInto(out, def.stats(equip.level, equip.slot, choice, 1), n)
      return
    }
    if (!def.spellTrace) {
      for (let k = 0; k < n; k++) addInto(out, def.stats(equip.level, equip.slot, choice, 0))
      return
    }
    for (let k = 0; k < n; k++) addInto(out, def.stats(equip.level, equip.slot, choice, ++traceNth))
  })
  return out
}

/**
 * Slot usage. used + remaining + recoverable === totalSlots. overflowScrolls = successes that do not fit (dropped by
 * scrollStats); overflowFails = failures beyond the slots; overflow = their sum (kept for「超出可上卷次數 N 張」).
 */
export function scrollSummary(
  equip: EquipData,
  state: ScrollState,
  hammer: HammerState,
): {
  used: number
  remaining: number
  recoverable: number
  overflowScrolls: number
  overflowFails: number
  overflow: number
} {
  const total = totalSlots(equip, hammer)
  const fails = nonNeg(state.failCount)
  const recoverable = Math.min(fails, total)
  const requested = state.entries.reduce((a, e) => a + nonNeg(e.count), 0)
  const used = Math.min(requested, total - recoverable)
  const overflowScrolls = requested - used
  const overflowFails = fails - recoverable
  return {
    used,
    remaining: total - used - recoverable,
    recoverable,
    overflowScrolls,
    overflowFails,
    overflow: overflowScrolls + overflowFails,
  }
}

/**
 * Expected scrolls to land every entry's `count` successes: count / successRate each. With `recoveryId`, every
 * expected failure (count / rate − count) is recovered with RECOVERY's success rate before re-scrolling.
 * Assumes every failure is recovered (no slot is left failed) and slots never run out.
 */
export function scrollExpectation(
  entries: ScrollEntry[],
  recoveryId?: string,
): { scrollsUsed: number; recoveryUsed: number } {
  let recoveryRate: number | null = null
  if (recoveryId !== undefined) {
    const r = RECOVERY.items.find((i) => i.id === recoveryId)
    if (!r) throw new Error(`unknown recovery scroll ${recoveryId}`)
    recoveryRate = r.successRate
  }
  let scrollsUsed = 0
  let recoveryUsed = 0
  for (const e of entries) {
    const n = nonNeg(e.count)
    const tries = n / scrollDef(e.scrollId).successRate
    scrollsUsed += tries
    if (recoveryRate !== null) recoveryUsed += (tries - n) / recoveryRate
  }
  return { scrollsUsed, recoveryUsed }
}

// ---------------------------------------------------------------------------------------------------------------
// Reverse calculation (Task 8): which fixed-value scroll combination explains the observed scroll stats.
// ---------------------------------------------------------------------------------------------------------------

/** Max combinations returned by reverseScroll (fewest distinct entries first). */
export const REVERSE_MAX_RESULTS = 20
/** Wall-clock budget of one reverseScroll call, post-processing included (timedOut after this). */
export const REVERSE_TIME_BUDGET_MS = 350
/** usedSlots above this (real items have at most ~20 slots) are rejected with an empty result, not searched. */
export const REVERSE_MAX_USED_SLOTS = 40
const REVERSE_COLLECT = 200

interface RevVariant {
  scrollId: string
  choice: string
  vec: Stats
  keys: StatKey[]
  trace: boolean
}

const TRACE_CHOICES = ['str', 'dex', 'int', 'luk', 'maxHp', 'att', 'matt']
const FIXED_CHOICES = ['att', 'matt']

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a.slice()]
  const out: T[][] = []
  a.forEach((x, i) => {
    for (const p of permutations([...a.slice(0, i), ...a.slice(i + 1)])) out.push([x, ...p])
  })
  return out
}

function statsEqual(a: Stats, b: Stats): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<StatKey>
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  return true
}

/**
 * Fixed-value scroll combinations (multisets of successful scrolls) whose scrollStats equal `observed` exactly.
 * `usedSlots` = number of SUCCESSFUL scrolls (failed slots are not counted). Random-value scrolls are not searched.
 * Scroll applicability follows ScrollDef.slots; each scroll is offered with its ATT/MATT (fixed) or stat (spell
 * trace) choices, and choices of the SAME scroll with an identical gain vector are collapsed to the first. The
 * 4th-success armor bonus (guess) is accounted for by searching the "fewer than 4 traces" and "4+ traces, minus the
 * bonus ATT/MATT" cases separately; trace entries are then ordered (permuted) so the real scrollStats reproduces the
 * target (every returned combination is verified with it). Limitation: the 4th success is never split inside one
 * entry (e.g. str,str,str then int of the same entry), so a bonus landing mid-variant is not searched.
 *
 * Algorithm: depth-first over variants (count per variant), subtracting from the residual target; prunes on negative
 * residual, on residual > remaining slots x best per-slot gain of the remaining variants (per stat; HP/DEF come only
 * from spell traces, so they bound the trace count), on a per-stat reachability relaxation (subset-sum DP), on two combined weighted-sum bounds (unit weights; 1/target
 * weights), and memoises failed (variant, slots left, trace count capped at 4, residual) states. Search and
 * post-processing share one deadline (REVERSE_TIME_BUDGET_MS). At most REVERSE_MAX_RESULTS combinations are returned,
 * fewest distinct entries first; `truncated` = more existed than returned, `timedOut` = the budget ran out (results
 * may be incomplete).
 */
export function reverseScroll(equip: EquipData, observed: Stats, usedSlots: number): ScrollEntry[][] {
  return reverseScrollDetailed(equip, observed, usedSlots).results
}

export function reverseScrollDetailed(
  equip: EquipData,
  observed: Stats,
  usedSlots: number,
): { results: ScrollEntry[][]; truncated: boolean; timedOut: boolean } {
  const deadline = Date.now() + REVERSE_TIME_BUDGET_MS
  const none = { results: [] as ScrollEntry[][], truncated: false, timedOut: false }
  const n = Math.floor(usedSlots)
  if (!Number.isFinite(n) || n < 0 || n > REVERSE_MAX_USED_SLOTS) return none
  const target: Stats = {}
  for (const [k, v] of Object.entries(observed) as [StatKey, number][]) if (v) target[k] = v
  const tkeys = Object.keys(target) as StatKey[]
  if (n === 0) return tkeys.length === 0 ? { ...none, results: [[]] } : none
  // scrollStats clamps to the slots (tuc + hammers); give the probe equip enough slots for exactly `n` successes.
  const probe: EquipData = { ...equip, tuc: Math.max(equip.tuc, n, 1) }
  const group = scrollGroupOf(equip.slot)

  const V: RevVariant[] = []
  const seen = new Set<string>()
  for (const def of SCROLLS.items) {
    if (def.kind !== 'fixed') continue
    if (def.slots && !def.slots.includes(group)) continue
    for (const choice of def.spellTrace ? TRACE_CHOICES : FIXED_CHOICES) {
      const vec = scrollStats(probe, { entries: [{ scrollId: def.id, choice, count: 1 }], failCount: 0 }, {})
      const keys = (Object.keys(vec) as StatKey[]).filter((k) => vec[k])
      if (keys.length === 0) continue
      // Gains are non-negative, so a variant gaining a stat the target lacks can never be used.
      if (!keys.every((k) => target[k] !== undefined)) continue
      const sig = def.id + (def.spellTrace ? 't' : 'f') + keys.map((k) => k + vec[k]).sort().join(',')
      if (seen.has(sig)) continue
      seen.add(sig)
      V.push({ scrollId: def.id, choice, vec, keys, trace: !!def.spellTrace })
    }
  }
  // Search order: fixed scrolls first (they give every main stat the same amount), then spell traces grouped by the
  // stat they pick. After the fixed part each stat's remaining trace sum is then known exactly, which makes the
  // per-stat reachability pruning (and the failed-state memo) effective.
  const rank = (v: RevVariant) => (v.trace ? 1 + TRACE_CHOICES.indexOf(v.choice) : 0)
  V.sort((a, b) => rank(a) - rank(b))
  const keysAll = tkeys
  const suffixMax: Record<string, number[]> = {}
  for (const k of keysAll) {
    const arr = new Array<number>(V.length + 1).fill(0)
    for (let i = V.length - 1; i >= 0; i--) arr[i] = Math.max(arr[i + 1], V[i].vec[k] ?? 0)
    suffixMax[k] = arr
  }
  const wInv: Record<string, number> = {}
  for (const k of keysAll) wInv[k] = 1 / (target[k] as number)
  const unitOf = (vec: Stats) => keysAll.reduce((a, k) => a + (vec[k] ?? 0), 0)
  const invOf = (vec: Stats) => keysAll.reduce((a, k) => a + wInv[k] * (vec[k] ?? 0), 0)
  const sufU = new Array<number>(V.length + 1).fill(0)
  const sufI = new Array<number>(V.length + 1).fill(0)
  for (let i = V.length - 1; i >= 0; i--) {
    sufU[i] = Math.max(sufU[i + 1], unitOf(V[i].vec))
    sufI[i] = Math.max(sufI[i + 1], invOf(V[i].vec))
  }
  const hasBonus = group === 'armor' && V.some((v) => v.trace)
  const found: number[][] = []
  let timedOut = false

  // mode 0: no constraint (no bonus possible); 1: fewer than 4 traces; 2: 4+ traces (target already minus the bonus)
  function run(res0: Stats, mode: 0 | 1 | 2): void {
    const residual: Record<string, number> = {}
    for (const k of keysAll) residual[k] = res0[k] ?? 0
    for (const k of keysAll) if (residual[k] < 0) return
    const counts = new Array<number>(V.length).fill(0)
    const failed = new Set<string>()
    // Per-stat reachability relaxation: reach[k][i][m] = sums of stat k that variants i.. can make with at most m
    // slots (other stats ignored). A residual outside it can never be completed.
    const reach: Set<number>[][][] = keysAll.map((k) => {
      const cap = residual[k]
      const tab: Set<number>[][] = []
      for (let i = 0; i <= V.length; i++) tab.push([])
      for (let m = 0; m <= n; m++) tab[V.length][m] = new Set([0])
      for (let i = V.length - 1; i >= 0; i--) {
        if (Date.now() > deadline) {
          timedOut = true
          return tab
        }
        const g = V[i].vec[k] ?? 0
        for (let m = 0; m <= n; m++) {
          const s = new Set<number>()
          for (let c = 0; c <= m && c * g <= cap; c++) for (const x of tab[i + 1][m - c]) if (x + c * g <= cap) s.add(x + c * g)
          tab[i][m] = s
        }
      }
      return tab
    })
    if (timedOut) return
    let ticks = 0

    function dfs(i: number, rem: number, traces: number): boolean {
      if (timedOut) return false
      if ((++ticks & 1023) === 0 && Date.now() > deadline) {
        timedOut = true
        return false
      }
      for (const k of keysAll) {
        const r = residual[k]
        if (r < 0 || r > rem * suffixMax[k][i]) return false
      }
      let su = 0
      let si = 0
      for (const k of keysAll) {
        su += residual[k]
        si += residual[k] * wInv[k]
      }
      if (su > rem * sufU[i] + 1e-9 || si > rem * sufI[i] + 1e-9) return false
      for (let q = 0; q < keysAll.length; q++) if (!reach[q][i][rem].has(residual[keysAll[q]])) return false
      if (rem === 0) {
        if (!keysAll.every((k) => residual[k] === 0)) return false
        if (mode === 2 && traces < 4) return false
        found.push(counts.slice())
        return true
      }
      if (i === V.length) return false
      const key = i + '|' + rem + '|' + Math.min(traces, 4) + '|' + keysAll.map((k) => residual[k]).join(',')
      if (failed.has(key)) return false
      const v = V[i]
      let max = rem
      for (const k of v.keys) max = Math.min(max, Math.floor(residual[k] / (v.vec[k] as number)))
      if (v.trace && mode === 1) max = Math.min(max, 3 - traces)
      let any = false
      for (let c = 0; c <= max; c++) {
        counts[i] = c
        for (const k of v.keys) residual[k] -= c * (v.vec[k] as number)
        const ok = dfs(i + 1, rem - c, traces + (v.trace ? c : 0))
        for (const k of v.keys) residual[k] += c * (v.vec[k] as number)
        if (ok) any = true
        if (found.length >= REVERSE_COLLECT || timedOut) break
      }
      counts[i] = 0
      if (!any && !timedOut) failed.add(key)
      return any
    }
    dfs(0, n, 0)
  }

  if (!hasBonus) run(target, 0)
  else {
    run(target, 1)
    for (const bk of ['att', 'matt'] as StatKey[]) {
      if (found.length >= REVERSE_COLLECT || timedOut) break
      if ((target[bk] ?? 0) >= 1) run({ ...target, [bk]: (target[bk] as number) - 1 }, 2)
    }
  }

  const capped = found.length >= REVERSE_COLLECT
  const results: ScrollEntry[][] = []
  const dedupe = new Set<string>()
  for (const counts of found) {
    if (Date.now() > deadline) {
      timedOut = true
      break
    }
    const entries: ScrollEntry[] = []
    counts.forEach((c, idx) => {
      if (c > 0) entries.push({ scrollId: V[idx].scrollId, choice: V[idx].choice, count: c })
    })
    const traceIdx = entries.map((e, i) => (scrollDef(e.scrollId).spellTrace ? i : -1)).filter((i) => i >= 0)
    const orders = traceIdx.length > 1 && traceIdx.length <= 5 ? permutations(traceIdx) : [traceIdx]
    for (const order of orders) {
      const arranged = entries.slice()
      order.forEach((src, j) => (arranged[traceIdx[j]] = entries[src]))
      if (statsEqual(scrollStats(probe, { entries: arranged, failCount: 0 }, {}), target)) {
        const sig = JSON.stringify(arranged)
        if (!dedupe.has(sig)) {
          dedupe.add(sig)
          results.push(arranged)
        }
        break
      }
    }
  }
  results.sort((a, b) => a.length - b.length)
  return { results: results.slice(0, REVERSE_MAX_RESULTS), truncated: capped || results.length > REVERSE_MAX_RESULTS, timedOut }
}

/** Random-value scrolls: average gain per scroll = observed / count (per stat). count <= 0 gives empty stats. */
export function reverseRandomAverage(observed: Stats, count: number): Stats {
  const out: Stats = {}
  if (!(count > 0)) return out
  for (const [k, v] of Object.entries(observed) as [StatKey, number][]) out[k] = v / count
  return out
}

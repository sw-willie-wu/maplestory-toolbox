// Scroll slots, scroll stats and expected scroll usage. Rules: rules/scroll.ts (sources.md "SCROLLS / RECOVERY").
import { hammerSlots, type HammerState } from './hammer'
import { RECOVERY, SCROLLS, type ScrollChoice, type ScrollDef } from './rules/scroll'
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

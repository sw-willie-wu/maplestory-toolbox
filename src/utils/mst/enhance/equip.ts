// Compose every enhancement module into the stat breakdown the tooltip shows (Task 10).
// Order: base → scroll (slots incl. hammers) → starforce (compounds on base + scroll) → flame → exceptional.
import { exceptionalAvailable, exceptionalStats } from './exceptional'
import { flameStats, type FlameLine } from './flame'
import { hammerUses, type HammerState } from './hammer'
import { HAMMER } from './rules/hammer'
import { STARFORCE } from './rules/starforce'
import { starforceStats, starforceUnsourced } from './starforce'
import { scrollStats, type ScrollState } from './scroll'
import type { EquipData, StatBreakdown, StatKey, Stats } from './types'

/** Potential pick (UI selection only; potential is not part of the stat calculation). */
export type PotentialPick = { grade: string | null; lines: [string | null, string | null, string | null] }

export interface EnhanceState {
  star: number
  scroll: ScrollState
  hammer: HammerState
  flame: FlameLine[]
  exceptional: number
  potential: PotentialPick
  additional: PotentialPick
}

export type EnhanceTab = 'starforce' | 'scroll' | 'hammer' | 'flame' | 'exceptional'

/** StatBreakdown plus the flags the UI needs next to it. */
export interface EquipBreakdown extends StatBreakdown {
  /** Exceptional part is {} only because there is no data for this item / level (UI「無資料」). */
  exceptionalNoData: boolean
  /** Star actually applied: state star floored to 0..STARFORCE.maxStarByLevel(level); 0 when starforce is locked. */
  star: number
  /** starforceUnsourced(equip, star) for the applied star (ATT/MATT understated); false when starforce is locked. */
  starforceUnsourced: boolean
}

const emptyPick = (): PotentialPick => ({ grade: null, lines: [null, null, null] })

/** An unenhanced item. `equip` is accepted so callers do not need to change if defaults ever depend on it. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature fixed by the plan (Task 10 brief)
export function emptyState(_equip: EquipData): EnhanceState {
  return {
    star: 0,
    scroll: { entries: [], failCount: 0 },
    hammer: {},
    flame: [],
    exceptional: 0,
    potential: emptyPick(),
    additional: emptyPick(),
  }
}

/** Non-negative integer; NaN / non-finite / negative → 0. */
const level = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/** Finite, non-zero entries only, so a part can never carry NaN / undefined. */
function clean(s: Stats): Stats {
  const out: Stats = {}
  for (const [k, v] of Object.entries(s) as [StatKey, number][]) if (Number.isFinite(v) && v !== 0) out[k] = v
  return out
}

function sum(parts: Stats[]): Stats {
  const out: Stats = {}
  for (const p of parts) for (const [k, v] of Object.entries(p) as [StatKey, number][]) out[k] = (out[k] ?? 0) + v
  return clean(out)
}

/**
 * Breakdown with the scroll part given directly (e.g. the Nexon API value) instead of computed from `s.scroll`;
 * everything after it (starforce on base + scroll, flame, exceptional) is computed from `s`.
 */
export function breakdownWithScroll(equip: EquipData, s: EnhanceState, scrollPart: Stats): EquipBreakdown {
  const base = clean(equip.base)
  const scroll = clean(scrollPart)
  const afterScroll = sum([base, scroll])
  const star = effectiveStar(equip, s.star)
  const starforce = clean(starforceStats(equip, star, afterScroll))
  const flame = clean(flameStats(equip, s.flame))
  const ex = exceptionalStats(equip, level(s.exceptional))
  const exceptional = clean(ex ?? {})
  return {
    base,
    scroll,
    starforce,
    flame,
    exceptional,
    total: sum([base, scroll, starforce, flame, exceptional]),
    exceptionalNoData: ex === null,
    star,
    starforceUnsourced: starforceUnsourced(equip, star),
  }
}

/** Star applied to the item: floored to 0..maxStarByLevel; 0 when star force is not supported. */
function effectiveStar(equip: EquipData, star: number): number {
  if (!STARFORCE.supports(equip)) return 0
  return Math.min(level(star), STARFORCE.maxStarByLevel(equip.level))
}

/**
 * Full breakdown of `s` on `equip`. `total` = sum of every part (display value, exceptional included — note the
 * Nexon API total excludes exceptional). Locked features (lockedTabs) contribute {} whatever the state holds.
 */
export function computeBreakdown(equip: EquipData, s: EnhanceState): EquipBreakdown {
  return breakdownWithScroll(equip, s, scrollStats(equip, s.scroll, s.hammer))
}

/**
 * Editor tabs that do not apply to this item: starforce when not supported (cannot star force, or superior);
 * scroll when there are no scroll slots (tuc 0); hammer when no hammer type can be applied (no slots, or every type
 * blocked by blockGoldHammer); flame when canFlame is false; exceptional when no rules or canExceptional is false.
 */
export function lockedTabs(equip: EquipData): Set<EnhanceTab> {
  const out = new Set<EnhanceTab>()
  if (!STARFORCE.supports(equip)) out.add('starforce')
  if (equip.tuc <= 0) out.add('scroll')
  // Probe every HAMMER type with one use and lock only when none applies: rules stay in hammerUse (noSlots / blocked),
  // so a future hammer type (or a changed blockedByBlockGoldHammer) needs no change here.
  const probe: HammerState = Object.fromEntries(HAMMER.types.map((d) => [d.id, 1]))
  const uses = hammerUses(equip, probe)
  if (uses.every((u) => u.applied === 0)) out.add('hammer')
  if (!equip.canFlame) out.add('flame')
  if (!exceptionalAvailable() || !equip.canExceptional) out.add('exceptional')
  return out
}

// Hammers (extra scroll slots). Rules: rules/hammer.ts (sources.md "HAMMER").
import { HAMMER, type HammerDef } from './rules/hammer'
import type { EquipData } from './types'

/** Hammer type id (HAMMER.types[].id) → number of successful uses. Missing ids count as 0. */
export type HammerState = Record<string, number>

/** Why some of the requested uses were ignored: no scroll slots (tuc 0), blocked by WZ blockGoldHammer, or above max. */
export type HammerClampReason = 'noSlots' | 'blocked' | 'max'

export interface HammerUse {
  id: HammerDef['id']
  /** Uses the caller asked for (non-negative integer). */
  requested: number
  /** Uses that apply to the item. */
  applied: number
  /** Set when applied < requested. */
  reason: HammerClampReason | null
}

/** Requested vs. applied uses of one hammer type, so the UI can tell when input was ignored. */
export function hammerUse(equip: EquipData, hammer: HammerState, def: HammerDef): HammerUse {
  const requested = Math.max(0, Math.floor(hammer[def.id] ?? 0) || 0)
  let applied = requested
  let reason: HammerClampReason | null = null
  if (requested > 0 && equip.tuc <= 0) {
    applied = 0
    reason = 'noSlots'
  } else if (requested > 0 && def.blockedByBlockGoldHammer && equip.blockGoldHammer) {
    applied = 0
    reason = 'blocked'
  } else if (requested > def.max) {
    applied = def.max
    reason = 'max'
  }
  return { id: def.id, requested, applied, reason }
}

/** hammerUse for every HAMMER type, in HAMMER.types order. */
export function hammerUses(equip: EquipData, hammer: HammerState): HammerUse[] {
  return HAMMER.types.map((def) => hammerUse(equip, hammer, def))
}

/** Extra scroll slots added by hammers. */
export function hammerSlots(equip: EquipData, hammer: HammerState): number {
  let slots = 0
  for (const def of HAMMER.types) slots += hammerUse(equip, hammer, def).applied * def.slotsPerUse
  return slots
}

/**
 * Expected costs and attempts to reach the given (applied) hammer state.
 * null when any used type has an unknown success rate (platinum refine → UI「規則待查證」).
 * Costs are per attempt: `meso` from mesoCost, `spellTrace` (咒文的痕跡) from traceCost — the golden hammer is paid
 * only in spell traces, so meso 0 does not mean free.
 */
export function hammerExpectation(
  equip: EquipData,
  hammer: HammerState,
): { meso: number; spellTrace: number; attempts: number } | null {
  let meso = 0
  let spellTrace = 0
  let attempts = 0
  for (const def of HAMMER.types) {
    const n = hammerUse(equip, hammer, def).applied
    if (n === 0) continue
    if (def.successRate === null) return null
    const tries = n / def.successRate
    attempts += tries
    if (def.mesoCost) meso += tries * def.mesoCost(equip.level)
    if (def.traceCost) spellTrace += tries * def.traceCost
  }
  return { meso, spellTrace, attempts }
}

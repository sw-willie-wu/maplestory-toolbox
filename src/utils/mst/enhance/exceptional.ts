// 卓越強化 (Exceptional Enhancement). Rules: rules/exceptional.ts.
import { EXCEPTIONAL } from './rules/exceptional'
import type { EquipData, Sourced, Stats } from './types'

/** True when exceptional rules exist (UI shows the tab). */
export function exceptionalAvailable(): boolean {
  return EXCEPTIONAL !== null
}

/** Integer level >= 0 clamped to equip.exceptionalMax; null for NaN/non-finite. Fractions are floored. */
function normLevel(equip: EquipData, level: number): number | null {
  if (!Number.isFinite(level)) return null
  return Math.max(0, Math.min(Math.floor(level), equip.exceptionalMax))
}

/**
 * Cumulative exceptional stats at `level` (floored, clamped to equip.exceptionalMax).
 * {} when level <= 0, NaN, or the item cannot be enhanced (canExceptional false).
 * null = no observed data for this item / level (UI shows「無資料」; breakdown treats it as {}).
 */
export function exceptionalStats(equip: EquipData, level: number): Stats | null {
  if (!EXCEPTIONAL || !equip.canExceptional) return {}
  const lv = normLevel(equip, level)
  if (!lv) return {}
  return EXCEPTIONAL.stats(equip, lv)
}

/**
 * Expected totals to go from level 0 to `level` (floored, clamped to equip.exceptionalMax like exceptionalStats).
 * Only single-hammer mode is modelled (the two-hammer higher-rate option is not).
 * `exceptionalHammer` = expected 卓越鐵鎚 used (one per attempt, so equals attempts). `meso` 0 does NOT mean free:
 * the 0->1 step costs no meso but still uses a hammer. Source marks the data (GMS values, KMS-estimate).
 * null for NaN/negative level, canExceptional false, or missing rates/costs.
 */
export function exceptionalExpectation(
  equip: EquipData,
  level: number,
): { meso: number; exceptionalHammer: number; attempts: number; source: Sourced } | null {
  const r = EXCEPTIONAL
  if (!r || !r.successRate || !r.cost || !equip.canExceptional) return null
  if (!Number.isFinite(level) || level < 0) return null
  const lv = normLevel(equip, level)!
  let meso = 0
  let attempts = 0
  for (let l = 0; l < lv; l++) {
    const p = r.successRate(l)
    if (p <= 0) return null
    attempts += 1 / p
    meso += r.cost(l) / p
  }
  return { meso, exceptionalHammer: attempts * (r.hammerPerAttempt ?? 1), attempts, source: r.attemptSource ?? r }
}

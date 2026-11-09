// Star force for normal (non-superior) equipment: stat bonuses and expected cost; rules in rules/starforce.ts.
import { STARFORCE, type StarforceEvent, type VipDiscount } from './rules/starforce'
import type { EquipData, StatKey, Stats } from './types'

/**
 * Stats gained from star force at `star` (cumulative 1..star), zero entries omitted.
 *
 * `afterScroll` = base + scroll stats. Weapon ATT/MATT (1–15★) and DEF compound on it, and it decides
 * which off-job main stats get the 16–22★ bonus (see `STARFORCE.statTable.statKeys`).
 *
 * Returns `{}` when `star <= 0` or when star force is not supported for the item
 * (`STARFORCE.supports(equip)` false: superior equipment, or items that cannot be star-forced);
 * the caller decides what notice to show based on `STARFORCE.supports`.
 *
 * Unsourced ATT cells (`STARFORCE.attTable` → null, e.g. weapons Lv250 / Lv138–199 at 26★+)
 * contribute 0; use `starforceUnsourced(equip, star)` to tell that apart from a real 0.
 */
export function starforceStats(equip: EquipData, star: number, afterScroll: Stats): Stats {
  if (star <= 0 || !STARFORCE.supports(equip)) return {}
  const { statTable, attTable } = STARFORCE
  const weaponTable = STARFORCE.usesWeaponTable(equip)
  const getsHp = !statTable.noHpSlots.includes(equip.slot)
  const getsDef = !weaponTable && !statTable.noDefSlots.includes(equip.slot)
  const defMaxStar = statTable.defMaxStar(equip)
  const out: Stats = {}
  const gain = (key: StatKey, value: number) => {
    if (value) out[key] = (out[key] ?? 0) + value
  }

  const startAtt = afterScroll.att ?? 0
  const startMatt = afterScroll.matt ?? 0
  const startDef = afterScroll.def ?? 0
  let att = startAtt
  let matt = startMatt
  let def = statTable.defSeed(startDef)

  for (let s = 1; s <= star; s++) {
    const per = statTable.perStar(equip.level, s)
    for (const k of statTable.statKeys(s, equip.jobs, afterScroll)) gain(k, per)
    if (getsDef && s <= defMaxStar) def = statTable.nextDef(def)

    if (s <= 15) {
      if (getsHp) {
        const hp = statTable.hpPerStar(s)
        gain('maxHp', hp)
        if (weaponTable) gain('maxMp', hp)
      }
      if (equip.slot === 'So') {
        gain('speed', statTable.shoeSpeedJumpPerStar(s))
        gain('jump', statTable.shoeSpeedJumpPerStar(s))
      }
      if (equip.slot === 'Gv') {
        gain((equip.base.matt ?? 0) > (equip.base.att ?? 0) ? 'matt' : 'att', statTable.gloveAttPerStar(s))
      }
      if (weaponTable) {
        // Only the attack types the weapon has (a non-magic weapon gains no MATT).
        if (att > 0) att = attTable.nextWeaponAttLow(att)
        if (matt > 0) matt = attTable.nextWeaponAttLow(matt)
      }
    } else {
      const v = highStarAtt(equip, weaponTable, s) ?? 0
      if (!weaponTable) {
        gain('att', v)
        gain('matt', v)
      } else {
        if (att > 0) att += v
        if (matt > 0) matt += v
      }
    }
  }

  gain('att', att - startAtt)
  gain('matt', matt - startMatt)
  if (getsDef) gain('def', def - startDef)
  return out
}

/**
 * true when `starforceStats(equip, star, …)` used an unsourced (null) ATT table cell for some star in 1..star,
 * i.e. its ATT/MATT is understated. false for unsupported items (nothing is computed for them).
 */
export function starforceUnsourced(equip: EquipData, star: number): boolean {
  if (!STARFORCE.supports(equip)) return false
  const weaponTable = STARFORCE.usesWeaponTable(equip)
  for (let s = 16; s <= star; s++) if (highStarAtt(equip, weaponTable, s) === null) return true
  return false
}

/** ATT/MATT gained by reaching `star` (16+) from the weapon or non-weapon table; null = no sourced value. */
function highStarAtt(equip: EquipData, weaponTable: boolean, star: number): number | null {
  const { attTable } = STARFORCE
  return weaponTable ? attTable.weapon(equip.level, star) : attTable.nonWeapon(equip.level, star)
}

// ---------------------------------------------------------------------------------------------
// Expected cost (absorbing Markov chain)
// ---------------------------------------------------------------------------------------------

export type VipTier = 'none' | 'gold' | 'diamond' | 'royal'

export interface StarforceOptions {
  /** Star catch ×`STARFORCE.starCatch.multiplier` on success; destroy (and drop) shrink with keep. UI default: `STARFORCE.starCatch.alwaysOn`. */
  starCatch: boolean
  /** Safeguard for current stars `STARFORCE.safeguard.fromStar..toStar`. */
  safeguard: boolean
  /** Id from `STARFORCE.events`; unknown ids throw (no invented effects). */
  event: string | null
  /** VIP tier from `STARFORCE.vipDiscounts` ('none' = no discount). */
  vip: VipTier
  /** Price of one replacement item; adds `totalWithItemCost = meso + destroys × itemPrice`. */
  itemPrice?: number
}

export interface StarforceExpectation {
  meso: number
  attempts: number
  destroys: number
  /** Probability of at least one destroy before reaching `to`. */
  pDestroyAtLeastOnce: number
  totalWithItemCost?: number
}

/** One attempt from a star: per-attempt probabilities (keep = 1 − success − destroy − down) and meso cost. */
export interface StarforceStep {
  success: number
  destroy: number
  /** Star drop (to star − 1). TMS normal items: always 0. */
  down: number
  cost: number
  /** Star the item continues from after a destroy (counted as one destroy). */
  destroyTo: number
}

/**
 * Expected meso / attempts / destroys and P(≥1 destroy) to go from `from` to `to` (TMS normal equipment).
 *
 * `to` is clamped to `STARFORCE.maxStarByLevel(level)`, `from` to ≥ 0; `from >= to` → all zeros.
 * Only for items with `STARFORCE.supports(equip)` (superior items are not modelled; the caller must not call this).
 * Costs are not re-rounded after discounts. Throws for an unknown `event` id, and when
 * `STARFORCE.chanceTime` is set (chance time is not modelled; TMS has none since V272).
 */
export function starforceExpectation(
  level: number,
  from: number,
  to: number,
  opt: StarforceOptions,
): StarforceExpectation {
  const event = opt.event === null ? null : STARFORCE.events.find((e) => e.id === opt.event)
  if (event === undefined) throw new Error(`Unknown star force event: ${opt.event}`)
  const vip = opt.vip === 'none' ? null : STARFORCE.vipDiscounts.find((v) => v.id === opt.vip)
  if (vip === undefined) throw new Error(`Unknown VIP tier: ${opt.vip}`)
  if (STARFORCE.chanceTime !== null) throw new Error('Star force chance time is not modelled')

  const start = Math.max(0, Math.floor(from))
  const end = Math.min(Math.floor(to), STARFORCE.maxStarByLevel(level))
  const withItem = (r: StarforceExpectation): StarforceExpectation =>
    opt.itemPrice === undefined ? r : { ...r, totalWithItemCost: r.meso + r.destroys * opt.itemPrice }
  if (!(start < end)) return withItem({ meso: 0, attempts: 0, destroys: 0, pDestroyAtLeastOnce: 0 })

  const steps: StarforceStep[] = []
  for (let star = 0; star < end; star++) steps.push(tmsStep(level, star, opt, event, vip))
  return withItem(solveStarforceChain(steps, start, end))
}

/** Per-attempt probabilities and cost from `star` under the TMS rules and the chosen options. */
function tmsStep(
  level: number,
  star: number,
  opt: StarforceOptions,
  event: StarforceEvent | null,
  vip: VipDiscount | null,
): StarforceStep {
  const rate = STARFORCE.rates[star]
  const eventHere = event !== null && (event.effect.maxStar === undefined || star <= event.effect.maxStar)
  let success = rate.success
  // Event destroy reduction applies to the base rate; the removed part goes to keep.
  let destroy = rate.destroy * (eventHere ? event.effect.destroyMultiplier ?? 1 : 1)
  let down = rate.down
  if (opt.starCatch) {
    const boosted = Math.min(1, success * STARFORCE.starCatch.multiplier)
    const shrink = success < 1 ? (1 - boosted) / (1 - success) : 0
    destroy *= shrink
    down *= shrink
    success = boosted
  }
  const { safeguard: sg } = STARFORCE
  const guarded = opt.safeguard && star >= sg.fromStar && star <= sg.toStar
  if (guarded) destroy = 0

  const base = STARFORCE.costFormula(level, star)
  const vipRate = vip !== null && star <= vip.maxStar ? vip.rate : 0
  const eventCost = eventHere ? event.effect.costMultiplier ?? 1 : 1
  const cost = base * (1 - vipRate) * eventCost + (guarded ? sg.costMultiplier * base : 0)
  return { success, destroy, down, cost, destroyTo: STARFORCE.destroyReturnStar(star) }
}

/**
 * Exact solution of the absorbing chain over states 0..to−1 (`steps[s]` = attempt from star s), absorbing at `to`.
 * E[s] = c_s + success·E[s+1] + keep·E[s] + down·E[s−1] + destroy·E[destroyTo], solved by Gaussian elimination
 * for meso (c = cost), attempts (c = 1) and destroys (c = destroy). P(≥1 destroy) uses the same chain with
 * destroy as an absorbing "hit" state: P[s] = success·P[s+1] + keep·P[s] + down·P[s−1] + destroy.
 */
export function solveStarforceChain(
  steps: StarforceStep[],
  from: number,
  to: number,
): Omit<StarforceExpectation, 'totalWithItemCost'> {
  if (!(from >= 0 && from < to && to <= steps.length)) return { meso: 0, attempts: 0, destroys: 0, pDestroyAtLeastOnce: 0 }
  const n = to
  // A destroy must land on a star inside the chain; otherwise the destroy branch would silently absorb at the target.
  steps.slice(0, n).forEach((st, s) => {
    if (st.destroy > 0 && st.destroyTo >= n)
      throw new Error(`solveStarforceChain: destroyTo (${st.destroyTo}) >= n (${n}) at star ${s}`)
  })
  const build = (destroyReturns: boolean) =>
    steps.slice(0, n).map((st, s) => {
      const row = new Array<number>(n).fill(0)
      row[s] += st.success + st.destroy + st.down // = 1 − keep
      if (s + 1 < n) row[s + 1] -= st.success
      if (st.down > 0 && s > 0) row[s - 1] -= st.down
      if (destroyReturns && st.destroy > 0) row[st.destroyTo] -= st.destroy
      return row
    })
  const [meso, attempts, destroys] = solveLinear(
    build(true),
    steps.slice(0, n).map((st) => [st.cost, 1, st.destroy]),
  ).map((col) => col[from])
  const [pDestroy] = solveLinear(
    build(false),
    steps.slice(0, n).map((st) => [st.destroy]),
  ).map((col) => col[from])
  return { meso, attempts, destroys, pDestroyAtLeastOnce: pDestroy }
}

/** Solve A·X = B (B has k columns) by Gaussian elimination with partial pivoting; returns X column by column. */
function solveLinear(a: number[][], b: number[][]): number[][] {
  const n = a.length
  const k = b[0].length
  const m = a.map((row, i) => [...row, ...b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r
    if (m[p][c] === 0) throw new Error('Star force chain is singular (a star can never be passed)')
    ;[m[c], m[p]] = [m[p], m[c]]
    for (let r = 0; r < n; r++) {
      if (r === c || m[r][c] === 0) continue
      const f = m[r][c] / m[c][c]
      for (let j = c; j < n + k; j++) m[r][j] -= f * m[c][j]
    }
  }
  return Array.from({ length: k }, (_, j) => m.map((row, i) => row[n + j] / row[i]))
}

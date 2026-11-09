// Star force stat bonuses for normal (non-superior) equipment; rules in rules/starforce.ts.
import { STARFORCE } from './rules/starforce'
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
    if (getsDef) def = statTable.nextDef(def)

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

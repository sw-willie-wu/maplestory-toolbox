// Potential / bonus potential: dropdown data only. The UI shows what you pick; nothing is calculated (spec §3, §5).
// The option list comes from WZ Item/ItemOption (public/data/tms-v283/potential-options.json). The rules module
// cannot fetch or import files outside src, so the UI loads that file and passes it to `buildOptions`.
import type { Sourced } from '../types'

/** One row of potential-options.json (see tools/wz-export/README.md). */
export interface RawPotentialOption {
  id: number
  grade: number // id / 10000, raw
  text: string // WZ template, e.g. "STR +#incSTRr%"
  optionType?: number
  reqLevel?: number
  weight?: number
  levels: Record<string, Record<string, number>>
}

export type PotentialKind = 'main' | 'additional'

/** Which equipment an option can roll on, from the WZ `optionType` field. */
export type OptionSlotGroup =
  | 'any' // optionType absent / 0
  | 'weapon' // 10
  | 'nonWeapon' // 11
  | 'armor' // 20
  | 'accessory' // 40
  | 'cap' // 51
  | 'top' // 52
  | 'bottom' // 53
  | 'gloves' // 54
  | 'shoes' // 55

/** The slot group of a piece of equipment (what `slotGroupOf` returns). */
export type EquipSlotGroup =
  | 'weapon' // weapons, secondaries, emblems
  | 'cap'
  | 'top' // tops and overalls
  | 'bottom'
  | 'gloves'
  | 'shoes'
  | 'armor' // cape, belt, shoulder
  | 'accessory' // face, eye, earring, ring, pendant, pocket
  | 'other' // badge, medal, heart and anything else

export interface PotentialOption {
  id: number
  /** 1..4 = index into POTENTIAL.grades + 1 */
  grade: number
  kind: PotentialKind
  slotGroup: OptionSlotGroup
  text: string
  reqLevel: number
  levels: Record<string, Record<string, number>>
}

const OPTION_TYPE_GROUP: Record<number, OptionSlotGroup> = {
  0: 'any',
  10: 'weapon',
  11: 'nonWeapon',
  20: 'armor',
  40: 'accessory',
  51: 'cap',
  52: 'top',
  53: 'bottom',
  54: 'gloves',
  55: 'shoes',
}

const SLOT_GROUP: Record<string, EquipSlotGroup> = {
  Wp: 'weapon',
  WpSi: 'weapon',
  Si: 'weapon',
  Cp: 'cap',
  HrCp: 'cap',
  Ma: 'top',
  MaPn: 'top',
  Pn: 'bottom',
  Gv: 'gloves',
  So: 'shoes',
  Sr: 'armor',
  Be: 'armor',
  Sh: 'armor',
  Af: 'accessory',
  Ay: 'accessory',
  Ae: 'accessory',
  Ri: 'accessory',
  Pe: 'accessory',
  Po: 'accessory',
}

/** Which option groups each equipment group accepts. */
const ACCEPTS: Record<EquipSlotGroup, OptionSlotGroup[]> = {
  weapon: ['any', 'weapon'],
  cap: ['any', 'nonWeapon', 'armor', 'cap'],
  top: ['any', 'nonWeapon', 'armor', 'top'],
  bottom: ['any', 'nonWeapon', 'armor', 'bottom'],
  gloves: ['any', 'nonWeapon', 'armor', 'gloves'],
  shoes: ['any', 'nonWeapon', 'armor', 'shoes'],
  armor: ['any', 'nonWeapon', 'armor'],
  accessory: ['any', 'nonWeapon', 'accessory'],
  other: ['any', 'nonWeapon'],
}

export type PotentialRuleKey = 'grades' | 'slotMapping' | 'additionalId' | 'optionLevel'

export interface PotentialRules extends Sourced {
  /** Per-rule sources; the top-level TMS source covers the WZ option list itself. */
  ruleSources: Record<PotentialRuleKey, Sourced>
  /** Grade names, low → high; option.grade N ↔ grades[N - 1]. */
  grades: string[]
  slotGroupOf(category: string, slot: string): EquipSlotGroup
  /** Keep rare..legendary main/additional options; drop grade 0 (no grade) and 6/7 (not equipment potential). */
  buildOptions(raw: RawPotentialOption[]): PotentialOption[]
  /** Can this option roll on equipment of this slot group? */
  fits(option: PotentialOption, group: EquipSlotGroup): boolean
  /** Option level used for values: ceil(equipLevel / 10), 1..25 (clamped to the levels present). */
  optionLevel(equipLevel: number): number
  /** Fill the WZ template with the values for this equipment level, e.g. "STR +9%". */
  resolveText(option: PotentialOption, equipLevel: number): string
}

export const POTENTIAL: PotentialRules = {
  source: 'TMS',
  ref:
    'Options: WZ Item/ItemOption.img exported from the TMS v283 client (public/data/tms-v283/potential-options.json). ' +
    'Grade names 特殊/稀有/罕見/傳說: TMS in-game names, see sources.md. ' +
    'optionType → slot mapping, id x2xxx = bonus potential and option level = ceil(level/10): KMS WZ conventions, see sources.md.',
  ruleSources: {
    grades: {
      source: 'TMS',
      ref: 'TMS in-game names; https://www.lootbar.com/blog/zh-Hant/maplestory-gear-starter-to-endgame-progression.html (特殊 → 稀有 → …)',
    },
    slotMapping: {
      source: 'KMS-estimate',
      ref: 'KMS WZ optionType convention (10 weapon, 11 non-weapon, 20 armor, 40 accessory, 51–55 cap/top/bottom/gloves/shoes), checked against option texts; see sources.md POTENTIAL',
    },
    additionalId: { source: 'KMS-estimate', ref: 'KMS WZ convention: id thousands digit 2 (x2xxx) = bonus potential; see sources.md POTENTIAL' },
    optionLevel: { source: 'KMS-estimate', ref: 'KMS WZ convention: option level = ceil(equip level / 10), 1..25; see sources.md POTENTIAL' },
  },
  grades: ['特殊', '稀有', '罕見', '傳說'],

  slotGroupOf(category, slot) {
    if (category === 'Weapon' || category === 'Shield') return 'weapon'
    return SLOT_GROUP[slot] ?? 'other'
  },

  buildOptions(raw) {
    const out: PotentialOption[] = []
    for (const r of raw) {
      if (r.grade < 1 || r.grade > 4) continue
      out.push({
        id: r.id,
        grade: r.grade,
        kind: Math.floor((r.id % 10000) / 1000) === 2 ? 'additional' : 'main',
        slotGroup: OPTION_TYPE_GROUP[r.optionType ?? 0] ?? 'any',
        text: r.text,
        reqLevel: r.reqLevel ?? 0,
        levels: r.levels,
      })
    }
    return out
  },

  fits(option, group) {
    return ACCEPTS[group].includes(option.slotGroup)
  },

  optionLevel(equipLevel) {
    return Math.min(25, Math.max(1, Math.ceil(equipLevel / 10)))
  },

  resolveText(option, equipLevel) {
    const keys = Object.keys(option.levels).map(Number)
    if (keys.length === 0) return option.text
    const lv = Math.min(this.optionLevel(equipLevel), Math.max(...keys))
    const values = option.levels[String(lv)] ?? {}
    // Longest key first so "#incSTRr" is not matched as "#incSTR" + "r".
    const names = Object.keys(values).sort((a, b) => b.length - a.length)
    let text = option.text
    for (const n of names) text = text.split('#' + n).join(String(values[n]))
    return text
  },
}

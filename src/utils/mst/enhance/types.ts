export type StatKey =
  | 'str'
  | 'dex'
  | 'int'
  | 'luk'
  | 'maxHp'
  | 'maxMp'
  | 'att'
  | 'matt'
  | 'def'
  | 'speed'
  | 'jump'
  | 'bossDamage'
  | 'ignoreDef'
  | 'allStatPct'
  | 'damagePct'
  | 'maxHpPct'
  | 'maxMpPct'
  | 'levelReduce'
// levelReduce ← API item_add_option.equipment_level_decrease（星火「要求等級減少」）

export interface IndexEntry {
  id: number
  name: string
  category: string
  slot: string
  level: number
  cash: boolean
  tuc: number
  setId: number | null
  jobs: JobGroup[] | 'all'
  /** Exactly one entry per (slot, name, cash) group is canonical (no event / time-limited / fixed-potential variant if possible, then lowest id). */
  canonical: boolean
  /**
   * '' for canonical entries; otherwise 活動版・期限・固定潛能 parts (that order) or 綁定版; else a fallback from the first
   * field differing from the canonical: 可上卷N次 (tuc) / Lv.N (level) / 數值不同 (base) / #<id> (anything else);
   * '' when identical to the canonical except id (collapse in the UI). See tools/wz-export/README.md.
   */
  variantLabel: string
}

export interface SetInfo {
  name: string
  completeCount: number
}

export type Stats = Partial<Record<StatKey, number>>

export type JobGroup = 'warrior' | 'magician' | 'bowman' | 'thief' | 'pirate'

export interface EquipData {
  id: number
  name: string
  category: string
  slot: string
  level: number
  jobs: JobGroup[] | 'all'
  isWeapon: boolean
  isMagicWeapon: boolean
  base: Stats
  tuc: number
  cash: boolean
  setId: number | null
  bossReward: boolean
  canStarforce: boolean
  canFlame: boolean
  canExceptional: boolean
  tradeBlock: boolean
  superior: boolean // WZ info/superiorEqp
  blockGoldHammer: boolean // WZ info/blockGoldHammer
  exceptionalMax: number // WZ info/Etuc (0 if absent); canExceptional === exceptionalMax > 0
  /** Boss rules for flames (4 lines, boss tier bonus). = bossReward except per-id overrides (古代石板複製品 1202287: false). */
  flameBoss: boolean
  timeLimited: boolean // WZ info/timeLimited
  fixedPotential: boolean // WZ info/fixedPotential
  eventVariant: boolean // WZ info/exceptTransmission || info/undecomposable
  accountShare: boolean // WZ info/accountSharable || info/sharableOnce
}

export interface Sourced {
  source: 'TMS' | 'KMS-estimate'
  ref: string
}

export interface StatBreakdown {
  base: Stats
  scroll: Stats
  starforce: Stats
  flame: Stats
  exceptional: Stats
  total: Stats
}

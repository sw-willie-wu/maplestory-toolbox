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

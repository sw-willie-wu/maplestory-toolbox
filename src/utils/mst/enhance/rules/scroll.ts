// Scrolls. Sources: research/scroll.md → sources.md "SCROLLS". Values are TMS player-compiled tables (巴哈姆特,
// with in-game screenshots), cross-checked against the Nexon fixture where noted. No official beanfun table exists.
import type { Sourced, StatKey, Stats } from '../types'

export type MainStat = 'str' | 'dex' | 'int' | 'luk'

export interface ScrollChoice {
  /** Spell trace: the stat picked (or 'maxHp' for the HP version). Default 'str'. */
  stat?: MainStat | 'maxHp'
  /** true → ATT gains go to MATT (magician gear). */
  magic?: boolean
  /** Random-value scrolls: the average gain per scroll entered by the user. */
  values?: Stats
}

export interface ScrollDef {
  id: string
  name: string
  kind: 'fixed' | 'random'
  successRate: number
  /**
   * Gain of one successful scroll. `slot` = EquipData.slot (WZ islot code).
   * `nth` = 1-based cumulative count of successful spell traces (any grade, `spellTrace: true`) on the item, this
   * one included; other scrolls do not count and ignore it (see SCROLLS.ruleSources.traceFourthBonus).
   */
  stats(level: number, slot: string, choice: ScrollChoice | undefined, nth: number): Stats
  /** ScrollGroup ids (see scrollGroupOf) this scroll can be used on; absent = all. */
  slots?: string[]
  /** true for 咒文的痕跡 (all grades): these share the item's success counter for the 4th-success bonus. */
  spellTrace?: boolean
  source?: Sourced['source']
  ref?: string
}

export type ScrollGroup = 'weapon' | 'gloves' | 'armor' | 'accessory' | 'heart'

/**
 * Scroll group of an equipment slot.
 * Shields/secondaries (Si) use the armor table: fixture 1352xxx 惡魔賢者盾 (8 × 15%: INT 80, HP 1360, DEF 120, MATT 1).
 * Shoulder (Sh) uses the armor table: fixture 永恆盜賊肩膀 (2 × 15%: LUK 20, HP 340, DEF 30).
 * Tm with scroll slots is a heart (androids have tuc 0).
 */
export function scrollGroupOf(slot: string): ScrollGroup {
  switch (slot) {
    case 'Wp':
    case 'WpSi':
      return 'weapon'
    case 'Gv':
      return 'gloves'
    case 'Cp':
    case 'HrCp':
    case 'Ma':
    case 'MaPn':
    case 'Pn':
    case 'So':
    case 'Sr':
    case 'Sh':
    case 'Si':
      return 'armor'
    case 'Tm':
      return 'heart'
    default:
      return 'accessory' // Af Ay Ae Ri Pe Be Po Ba Me …
  }
}

const MAIN: MainStat[] = ['str', 'dex', 'int', 'luk']
const band = (level: number): 0 | 1 | 2 => (level <= 70 ? 0 : level <= 110 ? 1 : 2)
const attKey = (c: ScrollChoice | undefined): StatKey => (c?.magic ? 'matt' : 'att')

/** One picked stat; HP version = 50 HP per stat point (+ the HP the armor line already has). */
function picked(c: ScrollChoice | undefined, n: number, armorHp = 0): Stats {
  const stat = c?.stat ?? 'str'
  if (stat === 'maxHp') return n === 0 && armorHp === 0 ? {} : { maxHp: n * 50 + armorHp }
  const out: Stats = {}
  if (n) out[stat] = n
  if (armorHp) out.maxHp = armorHp
  return out
}

function allStats(n: number): Stats {
  const out: Stats = {}
  if (n) for (const k of MAIN) out[k] = n
  return out
}

function merge(...parts: Stats[]): Stats {
  const out: Stats = {}
  for (const p of parts) for (const [k, v] of Object.entries(p) as [StatKey, number][]) out[k] = (out[k] ?? 0) + v
  return out
}

type Tier = 0 | 1 | 2 | 3 // 100% 70% 30% 15%

// Spell trace tables [band][tier]. null = not available.
// Armor: [stat, hp, def]
const ARMOR: ([number, number, number] | null)[][] = [
  [[1, 5, 1], [2, 15, 2], [3, 30, 4], null],
  [[2, 20, 2], [3, 40, 4], [5, 70, 7], null],
  // 15% at 111+: stat 10 from S2; HP 170 / DEF 15 derived from fixture (永恆弓箭手帽 14×: DEX 140, HP 2380, DEF 210)
  [[3, 30, 3], [4, 70, 5], [7, 120, 10], [10, 170, 15]],
]
// Gloves: [att, def]
const GLOVES: ([number, number] | null)[][] = [
  [[0, 3], [1, 0], [2, 0], null],
  [[1, 0], [2, 0], [3, 0], [4, 0]],
  [[1, 0], [2, 0], [3, 0], [4, 0]],
]
// Accessory: stat
const ACCESSORY: (number | null)[][] = [
  [1, 2, 3, null],
  [1, 2, 4, null],
  [2, 3, 5, null],
]
// Heart: att (S1 lists ≤100 only; 101+ not sourced → null)
const HEART: (number | null)[][] = [
  [1, 2, 3, null],
  [2, 3, 5, null],
  [null, null, null, null],
]
// Weapon: [stat, att]
const WEAPON: ([number, number] | null)[][] = [
  [[0, 1], [0, 2], [1, 3], [2, 5]],
  [[0, 2], [1, 3], [2, 5], [3, 7]],
  [[1, 3], [2, 5], [3, 7], [4, 9]],
]

function traceStats(tier: Tier, level: number, slot: string, c: ScrollChoice | undefined, nth: number): Stats {
  const b = band(level)
  const ak = attKey(c)
  switch (scrollGroupOf(slot)) {
    case 'armor': {
      const row = ARMOR[b][tier]
      if (!row) return {}
      const [stat, hp, def] = row
      // 4th successful spell trace on armor (not gloves): +1 ATT/MATT once (S1 in-game text "進行4次強化攻擊力增加：+1";
      // fixture: 9× and 14× 15% armor show ATT 1, fixed-value scrolls show none). nth counts all spell-trace grades
      // together; non-trace scrolls do not count — 推測, see SCROLLS.ruleSources.traceFourthBonus.
      return merge(picked(c, stat, hp), { def }, nth === 4 ? { [ak]: 1 } : {})
    }
    case 'gloves': {
      const row = GLOVES[b][tier]
      if (!row) return {}
      const [att, def] = row
      return merge(att ? { [ak]: att } : {}, def ? { def } : {})
    }
    case 'accessory': {
      const n = ACCESSORY[b][tier]
      return n == null ? {} : picked(c, n)
    }
    case 'heart': {
      const n = HEART[b][tier]
      return n == null ? {} : { [ak]: n }
    }
    case 'weapon': {
      const row = WEAPON[b][tier]
      if (!row) return {}
      const [stat, att] = row
      return merge(picked(c, stat), { [ak]: att })
    }
  }
}

const TRACE_REF =
  'TMS 玩家整理（含遊戲內截圖）：巴哈姆特 https://home.gamer.com.tw/artwork.php?sn=5180421 (S1) ; ' +
  'https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (S2, 2025-02-16)'

function trace(id: string, name: string, rate: number, tier: Tier, slots?: string[]): ScrollDef {
  return {
    id,
    name,
    kind: 'fixed',
    successRate: rate,
    stats: (level, slot, choice, nth) => traceStats(tier, level, slot, choice, nth),
    slots,
    spellTrace: true,
    source: 'TMS',
    ref: TRACE_REF,
  }
}

// Fixed-value 100% scrolls (S2 「常用卷軸素質一覽表」). Weapon/heart [all stats, att]; armor/gloves [all stats, att]; accessory att.
// Weapon/heart "屬" = all four stats (fixture 鈦之心 10× V: 110 each / MATT 130). Gloves use the armor values
// (fixture 永恆*手套 13× B: 26 each / 117 ATT). Armor B = all stats +2 / ATT 9 (fixture 永恆*頭盔 17×: 34 / 153).
function fixed(id: string, name: string, weapon: [number, number], armor: [number, number], acc: number, slots?: string[]): ScrollDef {
  return {
    id,
    name,
    kind: 'fixed',
    successRate: 1,
    stats: (_level, slot, choice) => {
      const ak = attKey(choice)
      const g = scrollGroupOf(slot)
      const [s, a] = g === 'weapon' || g === 'heart' ? weapon : g === 'accessory' ? [0, acc] : armor
      return merge(allStats(s), a ? { [ak]: a } : {})
    },
    slots,
    source: 'TMS',
    ref: 'TMS 玩家整理 https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (S2, 2025-02-16) ; fixture checks in sources.md',
  }
}

function random(id: string, name: string, rate: number, slots?: string[]): ScrollDef {
  return {
    id,
    name,
    kind: 'random',
    successRate: rate,
    // Random-value scrolls: the user enters the average gain per scroll (spec §5).
    stats: (_level, _slot, choice) => ({ ...(choice?.values ?? {}) }),
    slots,
    source: 'TMS',
    ref: 'TMS 玩家整理 https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (S2, 2025-02-16)',
  }
}

const NOT_ACC = ['weapon', 'armor', 'gloves', 'heart']

/** A rule whose exact condition is a reading of player data, not stated by any source (`guess: true` → UI notes「推測」). */
export type ScrollRuleSource = Sourced & { guess?: boolean; note?: string }
export type ScrollRuleKey = 'traceFourthBonus'

export const SCROLLS: { items: ScrollDef[]; ruleSources: Record<ScrollRuleKey, ScrollRuleSource> } & Sourced = {
  source: 'TMS',
  ref: TRACE_REF,
  ruleSources: {
    traceFourthBonus: {
      source: 'TMS',
      ref: TRACE_REF + ' ; research/scroll.md (第 4 次加攻規則)',
      guess: true,
      note: '推測：防具第 4 次成功的 +1 攻擊（魔攻）以該件所有咒文的痕跡（不分成功率）累計成功次數計算，僅一次；其他卷軸不計入',
    },
  },
  items: [
    trace('trace100', '咒文的痕跡 100%', 1, 0),
    trace('trace70', '咒文的痕跡 70%', 0.7, 1),
    trace('trace30', '咒文的痕跡 30%', 0.3, 2),
    // 15%: weapons, armor (incl. shoulder), gloves; not accessories (S2). Heart 15% is not sourced.
    trace('trace15', '咒文的痕跡 15%', 0.15, 3, ['weapon', 'armor', 'gloves']),
    fixed('lightning', '極電卷軸', [5, 9], [0, 4], 4),
    fixed('red', 'RED 卷軸', [8, 10], [0, 5], 5),
    fixed('x', 'X 卷軸', [10, 12], [0, 7], 7),
    fixed('v', 'V 卷軸', [11, 13], [0, 8], 8),
    fixed('b', 'B（究極）卷軸', [14, 14], [2, 9], 9),
    // 培羅德卷軸 (S2 "3 / 4"): accessories of the 頂級培羅德 set only (fixture 頂級培羅德戒指 3×: 9 each / 12 ATT)
    {
      id: 'pensalir',
      name: '培羅德卷軸',
      kind: 'fixed',
      successRate: 1,
      stats: (_level, slot, choice) =>
        scrollGroupOf(slot) === 'accessory' ? merge(allStats(3), { [attKey(choice)]: 4 }) : {},
      slots: ['accessory'],
      source: 'TMS',
      ref: 'TMS 玩家整理 https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (S2, 2025-02-16)',
    },
    random('destiny', '命運卷軸（隨機）', 1, NOT_ACC),
    random('savior', '救世卷軸（隨機）', 1, NOT_ACC),
    random('chaosAmazing', '卡勒馬驚奇樂觀的混沌卷軸 60%（隨機）', 0.6),
  ],
}


export const RECOVERY: { items: { id: string; name: string; successRate: number }[] } & Sourced = {
  source: 'TMS',
  ref: 'TMS 玩家整理 https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (S2, 2025-02-16: 純白 100%, 20000 咒文)',
  items: [{ id: 'cleanSlate', name: '純白卷軸', successRate: 1 }],
}

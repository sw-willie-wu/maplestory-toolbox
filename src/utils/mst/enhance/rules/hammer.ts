// Hammer (extra scroll slots). See sources.md "HAMMER" for the evidence.
//
// Fixture evidence (422 Nexon API items vs WZ tuc, 422/422): scrollUpgrade + scrollUpgradeable − tuc === −resilience;
// extra slots range 0..5 (96 items at +5, matching the in-game "白金鐵鎚：提煉 5/5"); goldenHammer=true only ever
// appears with exactly +1 extra slot (10 items). Controller ruling: model two types — golden hammer (+1, once,
// sets the goldenHammer flag, blocked by EquipData.blockGoldHammer) and platinum refine (+1 per success, max 5).
import type { Sourced } from '../types'

export interface HammerDef {
  id: 'golden' | 'platinum'
  name: string
  slotsPerUse: number
  max: number
  /** null = unknown (no TMS/KMS source): expectation code returns null, UI shows "規則待查證". */
  successRate: number | null
  /** null = unknown, or not paid in mesos (golden hammer costs 咒文的痕跡). */
  mesoCost: ((level: number) => number) | null
  /** 咒文的痕跡 per attempt; absent = not paid in spell traces (or unknown). */
  traceCost?: number
  /** WZ blockGoldHammer forbids this type. */
  blockedByBlockGoldHammer: boolean
  /** Shown by the Nexon API golden_hammer_flag. */
  setsGoldenHammerFlag: boolean
}

export interface HammerRules extends Sourced {
  types: HammerDef[]
  /** Hammer-added slots implied by Nexon API data: max(0, −scroll_resilience_count). */
  extraSlotsFromApi(resilience: number): number
}

export const HAMMER: HammerRules = {
  source: 'TMS',
  ref:
    'derived from Nexon fixture src/utils/mst/enhance/__tests__/fixtures/nexon-items.json (422 items: su + sua − WZ tuc = −resilience; ' +
    'e.g. 1005983 永恆盜賊頭巾 tuc 12, 17+0, resilience −5; goldenHammer only with +1) ; in-game "白金鐵鎚：提煉 5/5" (.claude/ref/ui.png) ; ' +
    'golden hammer 100% / 24000 咒文: TMS 玩家整理 https://forum.gamer.com.tw/C.php?bsn=7650&snA=1031391 (2025-02-16)',
  types: [
    {
      id: 'golden',
      name: '黃金鐵鎚',
      slotsPerUse: 1,
      max: 1,
      successRate: 1, // S2 "黃金鐵鎚 100%" (TMS player data)
      mesoCost: null, // paid in 咒文的痕跡, not mesos
      traceCost: 24000, // S2 "黃金鐵鎚 … 24000 咒文" (TMS player data, see ref)
      blockedByBlockGoldHammer: true,
      setsGoldenHammerFlag: true,
    },
    {
      id: 'platinum',
      name: '白金鐵鎚（提煉）',
      slotsPerUse: 1,
      max: 5,
      successRate: null, // unknown in TMS (S1 only says "機率低")
      mesoCost: null, // unknown
      blockedByBlockGoldHammer: false, // unknown; WZ flag is named for the golden hammer only
      setsGoldenHammerFlag: false,
    },
  ],
  extraSlotsFromApi(resilience) {
    return Math.max(0, -resilience)
  },
}

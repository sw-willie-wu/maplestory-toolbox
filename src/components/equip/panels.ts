import { lockedTabs, type EnhanceTab } from '@/utils/mst/enhance/equip'
import type { EquipData } from '@/utils/mst/enhance/types'
import type { LineIconName } from './ui/LineIcon.vue'

/** What the middle column shows: the equip picker or one enhancement panel. */
export type PanelId =
  | 'picker'
  | 'starforce'
  | 'scroll'
  | 'hammer'
  | 'flame'
  | 'potential'
  | 'bonusPotential'
  | 'exceptional'
  | 'reverse'

export type EnhancePanelId = Exclude<PanelId, 'picker'>

/** Sidebar enhancement menu, in game order with game names. `tab` = the lockedTabs() key that can lock it. */
export const PANELS: readonly { id: EnhancePanelId; label: string; icon: LineIconName; tab?: EnhanceTab }[] = Object.freeze([
  { id: 'starforce', label: '星力', icon: 'starforce', tab: 'starforce' },
  { id: 'scroll', label: '卷軸', icon: 'scroll', tab: 'scroll' },
  { id: 'hammer', label: '強化次數增加', icon: 'hammer', tab: 'hammer' },
  { id: 'flame', label: '星火', icon: 'flame', tab: 'flame' },
  { id: 'potential', label: '潛在能力', icon: 'potential' },
  { id: 'bonusPotential', label: '附加潛在能力', icon: 'bonusPotential' },
  { id: 'exceptional', label: '卓越', icon: 'exceptional', tab: 'exceptional' },
  { id: 'reverse', label: '反算', icon: 'reverse' }
])

export const NO_EQUIP_REASON = '請先選擇裝備'

function tabReason(equip: EquipData, tab: EnhanceTab): string {
  switch (tab) {
    case 'starforce':
      return equip.canStarforce && equip.superior ? '精銳（superior）裝備不支援星力計算' : '此裝備無法強化星力'
    case 'scroll':
      return '此裝備沒有可上卷次數'
    case 'hammer':
      return equip.tuc <= 0 ? '此裝備沒有可上卷次數，無法使用強化次數增加' : '此裝備無法使用強化次數增加'
    case 'flame':
      return '此裝備無法使用星火'
    case 'exceptional':
      return '此裝備無法卓越強化'
  }
}

/**
 * Locked panels → reason shown in the sidebar (title). No equip → every enhancement panel (never the picker) is
 * locked with 請先選擇裝備; otherwise the panels whose lockedTabs() key applies.
 */
export function lockReasons(equip: EquipData | null): Map<PanelId, string> {
  const out = new Map<PanelId, string>()
  if (!equip) {
    for (const p of PANELS) out.set(p.id, NO_EQUIP_REASON)
    return out
  }
  const locked = lockedTabs(equip)
  for (const p of PANELS) if (p.tab && locked.has(p.tab)) out.set(p.id, tabReason(equip, p.tab))
  return out
}

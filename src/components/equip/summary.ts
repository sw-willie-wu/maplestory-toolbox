// Tooltip summary rows (星力 / 卷軸 / 鐵鎚 / 追加屬性) derived from the enhance modules. UI helper only.
import type { EnhanceState, EnhanceTab, EquipBreakdown } from '@/utils/mst/enhance/equip'
import { hammerUses } from '@/utils/mst/enhance/hammer'
import { HAMMER } from '@/utils/mst/enhance/rules/hammer'
import { STARFORCE } from '@/utils/mst/enhance/rules/starforce'
import { scrollSummary } from '@/utils/mst/enhance/scroll'
import type { EquipData } from '@/utils/mst/enhance/types'

export interface TooltipSummary {
  /** Effective star (breakdown.star). */
  star: number
  /** STARFORCE.maxStarByLevel(level); 0 when star force is not supported. */
  maxStar: number
  scroll: { used: number; remaining: number; recoverable: number }
  /** Hammer types that can apply to this item (blocked types are left out). */
  hammer: { id: string; name: string; used: number; max: number }[]
  flameLocked: boolean
}

export function tooltipSummary(
  equip: EquipData,
  state: EnhanceState,
  breakdown: EquipBreakdown,
  locked: ReadonlySet<EnhanceTab>
): TooltipSummary {
  const { used, remaining, recoverable } = scrollSummary(equip, state.scroll, state.hammer)
  const uses = hammerUses(equip, state.hammer)
  const hammer = HAMMER.types
    .filter((def) => !(def.blockedByBlockGoldHammer && equip.blockGoldHammer))
    .map((def) => ({
      id: def.id,
      name: def.name,
      used: uses.find((u) => u.id === def.id)?.applied ?? 0,
      max: def.max
    }))
  return {
    star: breakdown.star,
    maxStar: STARFORCE.supports(equip) ? STARFORCE.maxStarByLevel(equip.level) : 0,
    scroll: { used, remaining, recoverable },
    hammer,
    flameLocked: locked.has('flame')
  }
}

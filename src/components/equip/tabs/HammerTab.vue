<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { hammerExpectation, hammerUses, type HammerUse } from '@/utils/mst/enhance/hammer'
import { HAMMER, type HammerDef } from '@/utils/mst/enhance/rules/hammer'
import { totalSlots } from '@/utils/mst/enhance/scroll'
import type { EquipData } from '@/utils/mst/enhance/types'
import { clampInt, formatMeso, formatNum } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const uses = computed(() => hammerUses(props.equip, state.value.hammer))
const useOf = (def: HammerDef): HammerUse => uses.value.find((u) => u.id === def.id)!
const blocked = (def: HammerDef) => def.blockedByBlockGoldHammer && props.equip.blockGoldHammer

function setUses(def: HammerDef, v: string) {
  // Keep the raw request (up to 99) so an over-max input is reported instead of silently rewritten.
  state.value.hammer[def.id] = clampInt(v, 0, 99)
}

function reason(def: HammerDef): string {
  if (blocked(def)) return `此裝備不可使用${def.name}`
  const u = useOf(def)
  switch (u.reason) {
    case 'noSlots':
      return '此裝備沒有可上卷次數，鐵鎚不生效'
    case 'blocked':
      return `此裝備不可使用${def.name}`
    case 'max':
      return `超過上限 ${def.max} 次，只計 ${u.applied} 次`
    default:
      return ''
  }
}

type Expect =
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'ok'; attempts: number; meso: number; spellTrace: number }

/** Expectation of one hammer type at its applied uses; unknown rate → 「規則待查證」. */
function expectation(def: HammerDef): Expect {
  const n = useOf(def).applied
  if (n === 0) return { kind: 'none' }
  const x = hammerExpectation(props.equip, { [def.id]: n })
  return x === null ? { kind: 'unknown' } : { kind: 'ok', ...x }
}

const rows = computed(() => HAMMER.types.map((def) => ({ def, reason: reason(def), exp: expectation(def) })))

const slots = computed(() => totalSlots(props.equip, state.value.hammer))
</script>

<template>
  <div class="hammer-tab">
    <div class="text-muted small mb-2">可上卷次數：基本 {{ equip.tuc }} → 含鐵鎚 {{ slots }}</div>
    <div v-for="{ def, reason: why, exp } in rows" :key="def.id" class="hammer-row">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <label class="hammer-name" :for="`hammer-${def.id}`">{{ def.name }}</label>
        <div class="input-group input-group-sm count-input">
          <input :id="`hammer-${def.id}`" type="number" min="0" :max="def.max" class="form-control"
            :value="state.hammer[def.id] ?? 0" :disabled="blocked(def)" :data-test="`hammer-${def.id}`"
            @input="setUses(def, ($event.target as HTMLInputElement).value)" />
          <span class="input-group-text">/ {{ def.max }}</span>
        </div>
        <span v-if="why" class="text-warning small" :data-test="`hammer-reason-${def.id}`">{{ why }}</span>
      </div>
      <div class="expect mt-1 small" :data-test="`hammer-expect-${def.id}`">
        <span v-if="exp.kind === 'none'" class="text-muted">未使用</span>
        <template v-else-if="exp.kind === 'unknown'">成功率／費用：<strong>規則待查證</strong>（只計入可上卷次數）</template>
        <template v-else>
          期望嘗試 {{ formatNum(exp.attempts, 2) }} 次
          <template v-if="exp.meso > 0">・期望楓幣 {{ formatMeso(exp.meso) }}</template>
          <template v-if="exp.spellTrace > 0">・咒文的痕跡 {{ formatNum(exp.spellTrace, 0) }}</template>
        </template>
      </div>
    </div>
    <div class="text-muted small mt-2">黃金鐵鎚成功率與費用為台版玩家整理資料。</div>
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

.hammer-row + .hammer-row {
  margin-top: 0.75rem;
}

.hammer-name {
  min-width: 8rem;
  font-weight: 600;
}

.count-input {
  width: 7rem;
}
</style>

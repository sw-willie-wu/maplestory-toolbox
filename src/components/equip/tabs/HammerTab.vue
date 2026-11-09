<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { hammerExpectation, hammerUses, type HammerUse } from '@/utils/mst/enhance/hammer'
import { HAMMER, type HammerDef } from '@/utils/mst/enhance/rules/hammer'
import { totalSlots } from '@/utils/mst/enhance/scroll'
import type { EquipData } from '@/utils/mst/enhance/types'
import StepperInput from '../ui/StepperInput.vue'
import { formatMeso, formatNum } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const uses = computed(() => hammerUses(props.equip, state.value.hammer))
const useOf = (def: HammerDef): HammerUse => uses.value.find((u) => u.id === def.id)!
const blocked = (def: HammerDef) => def.blockedByBlockGoldHammer && props.equip.blockGoldHammer

/** Stepper value; the stepper clamps new input to 0..def.max (an over-max value already in the state is kept and reported). */
function usesOf(def: HammerDef): number {
  return state.value.hammer[def.id] ?? 0
}
function setUses(def: HammerDef, v: number) {
  state.value.hammer[def.id] = v
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
    <h3 class="eq-card__title">
      強化次數增加
      <span class="hm-sub">可上卷次數：基本 {{ equip.tuc }} → 含鐵鎚 {{ slots }}</span>
    </h3>
    <div class="eq-form">
      <template v-for="{ def, reason: why, exp } in rows" :key="def.id">
        <label :for="`hammer-${def.id}`">{{ def.name }}：</label>
        <StepperInput v-if="!blocked(def)" :id="`hammer-${def.id}`" :model-value="usesOf(def)" :min="0"
          :max="def.max" :suffix="`/ ${def.max}`" :ariaLabel="def.name" :data-test="`hammer-${def.id}`"
          @update:model-value="setUses(def, $event)" />
        <span v-else class="hm-blocked">不可使用</span>
        <div class="hm-info">
          <span v-if="why" class="hm-reason" :data-test="`hammer-reason-${def.id}`">{{ why }}</span>
          <span v-if="!blocked(def)" class="hm-exp" :data-test="`hammer-expect-${def.id}`">
            <template v-if="exp.kind === 'none'">未使用</template>
            <template v-else-if="exp.kind === 'unknown'">成功率／費用：<b>規則待查證</b>（只計入可上卷次數）</template>
            <template v-else>
              期望嘗試 <b>{{ formatNum(exp.attempts, 2) }}</b> 次
              <template v-if="exp.meso > 0">・期望楓幣 <b>{{ formatMeso(exp.meso) }}</b></template>
              <template v-if="exp.spellTrace > 0">・咒文的痕跡 <b>{{ formatNum(exp.spellTrace, 0) }}</b></template>
            </template>
          </span>
        </div>
      </template>
    </div>
    <p class="hm-note">黃金鐵鎚成功率與費用為台版玩家整理資料。</p>
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

$muted: #7a8597;

.hm-sub {
  font-weight: 400;
  font-size: 13px;
  color: $muted;
}

.hm-blocked {
  color: $muted;
}

.hm-info {
  grid-column: 3 / span 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;

  // .eq-form folds to label | control below 992px: info goes under the stepper
  @media (max-width: 991.98px) {
    grid-column: 2;
  }
}

.hm-reason {
  color: #a86a00;
}

.hm-exp {
  color: #333;

  b {
    color: var(--color-navbar, rgb(40, 50, 65));
  }
}

.hm-note {
  margin: 14px 0 0;
  font-size: 12px;
  color: $muted;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { STARFORCE, type StarforceRuleKey } from '@/utils/mst/enhance/rules/starforce'
import { starforceExpectation, starforceUnsourced, type VipTier } from '@/utils/mst/enhance/starforce'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import StepperInput from '../ui/StepperInput.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import { formatMeso, formatNum, formatPct, kmsNotices } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const maxStar = computed(() => STARFORCE.maxStarByLevel(props.equip.level))

/** Final star shown on the item (state.star); the stepper clamps to 0..maxStar. */
const target = computed({
  get: () => state.value.star,
  set: (v: number) => (state.value.star = v)
})
/** Star the enhancement starts from (expectation only). */
const from = ref(0)

// Star catch is applied in every calculation while it is always on (TMS CROWN), so there is no control for it.
const starCatch = ref(STARFORCE.starCatch.alwaysOn)
const safeguard = ref(false)
const event = ref('')
const vip = ref<VipTier>('none')

const sg = STARFORCE.safeguard
const safeguardLabel = `防爆（${sg.fromStar}～${sg.toStar} 星，費用 +${sg.costMultiplier * 100}%）`

/** No item price: the expectation does not include replacing a destroyed item (spec: same as passing 0). */
const expectation = computed(() => {
  if (from.value >= target.value) return null
  try {
    return starforceExpectation(props.equip.level, from.value, target.value, {
      starCatch: starCatch.value,
      safeguard: safeguard.value,
      event: event.value || null,
      vip: vip.value
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
})

const unsourced = computed(() => starforceUnsourced(props.equip, target.value))

const notices = computed(() => {
  const labels: Partial<Record<StarforceRuleKey, string>> = {
    maxStarByLevel: '星數上限',
    statTable: '屬性加成表',
    attTable: '攻擊力加成表',
    destroyReturnStar: '爆裝後回到 12 星繼續'
  }
  if (starCatch.value) labels.starCatch = `抓星星（成功率 ×${STARFORCE.starCatch.multiplier}）`
  // TMS official (bid=74681), so kmsNotices leaves it out; listed so a future KMS-sourced change would show up.
  if (safeguard.value) labels.safeguard = '防爆'
  if (props.equip.slot === 'Si') labels.usesWeaponTable = '副武器套用的加成表'
  if (event.value) labels[event.value as StarforceRuleKey] = '活動效果'
  return kmsNotices(STARFORCE.ruleSources, labels)
})
</script>

<template>
  <div class="sf-tab">
    <h3 class="eq-card__title">星力強化</h3>
    <div class="eq-form">
      <label for="sf-from">目前星數：</label>
      <StepperInput id="sf-from" v-model="from" :min="0" :max="maxStar" ariaLabel="目前星數" data-test="sf-from" />
      <label for="sf-target">目標星數：</label>
      <StepperInput id="sf-target" v-model="target" :min="0" :max="maxStar" :suffix="`/ ${maxStar}`"
        ariaLabel="目標星數" data-test="sf-target" />
      <label for="sf-event">活動：</label>
      <select id="sf-event" v-model="event" data-test="sf-event">
        <option value="">無</option>
        <option v-for="ev in STARFORCE.events" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
      </select>
      <label for="sf-vip">VIP 折扣：</label>
      <select id="sf-vip" v-model="vip" data-test="sf-vip">
        <option value="none">無</option>
        <option v-for="v in STARFORCE.vipDiscounts" :key="v.id" :value="v.id">{{ v.name }}</option>
      </select>
      <span></span>
      <div class="full">
        <ToggleSwitch v-model="safeguard" :label="safeguardLabel" data-test="sf-safeguard" />
      </div>
    </div>

    <h3 class="eq-card__title">期望值（{{ from }} → {{ target }} 星）</h3>
    <p v-if="!expectation" class="sf-msg" data-test="sf-expect-empty">目標星數需高於目前星數</p>
    <p v-else-if="'error' in expectation" class="sf-msg sf-msg--error">{{ expectation.error }}</p>
    <div v-else class="eq-res" data-test="sf-expect">
      <span>期望楓幣：</span><b data-test="sf-meso">{{ formatMeso(expectation.meso) }}</b>
      <span>嘗試次數：</span><b>{{ formatNum(expectation.attempts, 1) }}</b>
      <span>爆裝次數：</span><b>{{ formatNum(expectation.destroys, 2) }}</b>
      <span>至少爆一次：</span><b>{{ formatPct(expectation.pDestroyAtLeastOnce) }}</b>
    </div>
    <p class="sf-hint">期望楓幣不含爆裝後補裝備的成本。</p>
    <p v-if="unsourced" class="sf-msg sf-msg--warn">此星數的攻擊力星力加成無資料，說明框數值可能偏低。</p>

    <SourceNotice :kms="notices" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

.sf-msg {
  margin: 0;
  color: #8a93a0;

  &--error {
    color: #c0392b;
  }

  &--warn {
    margin-top: 8px;
    color: #a86a00;
    font-size: 13px;
  }
}

.sf-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #7a8597;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { exceptionalExpectation, exceptionalStats } from '@/utils/mst/enhance/exceptional'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import StepperInput from '../ui/StepperInput.vue'
import { formatMeso, formatNum, formatStats, type NoticeItem } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const level = computed({
  get: () => state.value.exceptional,
  set: (v: number) => (state.value.exceptional = v)
})
const stats = computed(() => exceptionalStats(props.equip, state.value.exceptional))
const expectation = computed(() =>
  state.value.exceptional > 0 ? exceptionalExpectation(props.equip, state.value.exceptional) : null
)
const kms = computed<NoticeItem[]>(() => {
  const src = expectation.value?.source
  return src && src.source === 'KMS-estimate' ? [{ label: '成功率與費用（GMS 資料）', ref: src.ref }] : []
})
</script>

<template>
  <div class="exceptional-tab">
    <h3 class="eq-card__title">卓越強化</h3>
    <div class="eq-form">
      <label for="ex-level">強化程度：</label>
      <StepperInput id="ex-level" v-model="level" :min="0" :max="equip.exceptionalMax"
        :suffix="`/ ${equip.exceptionalMax}`" ariaLabel="強化程度" data-test="ex-level" />
      <span class="ex-row">加成：</span>
      <div class="full ex-stats" data-test="ex-stats">
        <template v-if="stats === null">
          <b>無資料</b><span class="ex-sub">（此裝備此階段尚無實測數值，說明框不計入）</span>
        </template>
        <template v-else-if="Object.keys(stats).length === 0">—</template>
        <template v-else>{{ formatStats(stats) }}</template>
      </div>
    </div>

    <h3 class="eq-card__title">期望值（0 → {{ state.exceptional }}，單鐵鎚模式）</h3>
    <p v-if="state.exceptional === 0" class="eq-msg" data-test="ex-expect">強化程度大於 0 後顯示</p>
    <p v-else-if="!expectation" class="eq-msg" data-test="ex-expect">無機率／費用資料</p>
    <template v-else>
      <div class="eq-res" data-test="ex-expect">
        <span>卓越鐵鎚：</span><b>{{ formatNum(expectation.exceptionalHammer, 2) }} 個</b>
        <span>嘗試次數：</span><b>{{ formatNum(expectation.attempts, 2) }}</b>
        <span>期望楓幣：</span><b>{{ formatMeso(expectation.meso) }}</b>
      </div>
      <p class="ex-hint">0 → 1 不需楓幣但仍消耗卓越鐵鎚。</p>
    </template>

    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
// starts a new form row
.ex-row {
  grid-column: 1;
}

.ex-stats {
  font-size: 14px;
  color: #333;
}

.ex-sub {
  font-size: 12px;
  color: #7a8597;
}

.ex-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #7a8597;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { exceptionalExpectation, exceptionalStats } from '@/utils/mst/enhance/exceptional'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { formatMeso, formatNum, formatStats, type NoticeItem } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const levels = computed(() => Array.from({ length: props.equip.exceptionalMax + 1 }, (_, i) => i))
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
    <div class="d-flex align-items-end gap-2">
      <div>
        <label class="form-label" for="ex-level">強化程度</label>
        <select id="ex-level" v-model.number="state.exceptional" class="form-select form-select-sm" data-test="ex-level">
          <option v-for="l in levels" :key="l" :value="l">{{ l }} / {{ equip.exceptionalMax }}</option>
        </select>
      </div>
    </div>

    <div class="mt-2" data-test="ex-stats">
      <span class="text-muted">卓越強化加成：</span>
      <template v-if="stats === null">
        <strong>無資料</strong><span class="text-muted small">（此裝備此階段尚無實測數值，說明框不計入）</span>
      </template>
      <template v-else-if="Object.keys(stats).length === 0">—</template>
      <template v-else>{{ formatStats(stats) }}</template>
    </div>

    <div class="expect mt-3" data-test="ex-expect">
      <div class="expect-title">期望值（0 → {{ state.exceptional }}，單鐵鎚模式）</div>
      <div v-if="state.exceptional === 0" class="text-muted">選擇強化程度後顯示</div>
      <div v-else-if="!expectation" class="text-muted">無機率／費用資料</div>
      <dl v-else class="expect-grid">
        <dt>期望卓越鐵鎚</dt>
        <dd>{{ formatNum(expectation.exceptionalHammer, 2) }} 個</dd>
        <dt>期望嘗試次數</dt>
        <dd>{{ formatNum(expectation.attempts, 2) }}</dd>
        <dt>期望楓幣</dt>
        <dd>{{ formatMeso(expectation.meso) }}</dd>
      </dl>
      <div v-if="expectation" class="text-muted small">0 → 1 不需楓幣但仍消耗卓越鐵鎚。</div>
    </div>

    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';
</style>

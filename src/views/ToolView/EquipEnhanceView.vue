<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import EquipSelector from '@/components/equip/EquipSelector.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import { tooltipSummary } from '@/components/equip/summary'
import { useEquipData } from '@/composables/useEquipData'
import { computeBreakdown, emptyState, lockedTabs, type EnhanceState } from '@/utils/mst/enhance/equip'
import type { EquipData } from '@/utils/mst/enhance/types'

const data = useEquipData()
const { meta, error, loading } = data

const equip = shallowRef<EquipData | null>(null)
const state = ref<EnhanceState | null>(null)
const selectError = ref<string | null>(null)
let selectSeq = 0

async function onSelect(id: number) {
  const seq = ++selectSeq
  selectError.value = null
  try {
    const e = await data.loadEquip(id)
    if (seq !== selectSeq) return // a later selection won
    equip.value = e
    state.value = emptyState(e)
  } catch (err) {
    if (seq === selectSeq) selectError.value = err instanceof Error ? err.message : String(err)
  }
}

const view = computed(() => {
  const e = equip.value
  const s = state.value
  if (!e || !s) return null
  const breakdown = computeBreakdown(e, s)
  const locked = lockedTabs(e)
  return {
    equip: e,
    state: s,
    breakdown,
    locked,
    summary: tooltipSummary(e, s, breakdown, locked),
    setInfo: data.setInfo(e.setId),
    specJob: data.jobName(e.specJob),
    tags: [data.slotName(e.slot)]
  }
})

onMounted(() => {
  data.load()
})
</script>

<template>
  <div class="equip-enhance py-3">
    <div class="d-flex flex-wrap align-items-baseline justify-content-between mb-2">
      <h1 class="h4 mb-0">裝備強化計算機</h1>
      <small v-if="meta" class="text-muted" data-test="data-version">資料版本：{{ meta.dataVersion }}</small>
    </div>

    <div v-if="error" class="alert alert-danger py-2" role="alert" data-test="load-error">
      資料載入失敗：{{ error }}
    </div>
    <div v-else-if="loading" class="text-muted mb-2">資料載入中…</div>

    <EquipSelector :data="data" class="mb-3" @select="onSelect" />

    <div v-if="selectError" class="alert alert-warning py-2" role="alert" data-test="select-error">{{ selectError }}</div>

    <div class="row g-3">
      <div class="col-12 col-md-auto">
        <div class="tooltip-col">
          <EquipTooltip v-if="view" :equip="view.equip" :breakdown="view.breakdown" :state="view.state"
            :summary="view.summary" :locked="view.locked" :set-info="view.setInfo" :spec-job="view.specJob"
            :tags="view.tags" />
          <div v-else class="tooltip-empty text-muted">請先選擇一件裝備</div>
        </div>
      </div>
      <div class="col">
        <!-- C: enhancement editor (Task 13) -->
        <div class="card editor-placeholder" data-test="editor-placeholder">
          <div class="card-content text-muted">強化編輯器（星力／卷軸／鐵鎚／追加屬性…）</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tooltip-col {
  width: 300px;
  position: sticky;
  top: 76px;
}

.tooltip-empty {
  width: 300px;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--bs-border-color);
  border-radius: 6px;
}

.editor-placeholder {
  min-height: 300px;
}
</style>

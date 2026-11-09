<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import EnhanceEditor from '@/components/equip/EnhanceEditor.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import { tooltipSummary } from '@/components/equip/summary'
import { useEquipData } from '@/composables/useEquipData'
import { computeBreakdown, emptyState, lockedTabs, type EnhanceState } from '@/utils/mst/enhance/equip'
import type { PotentialOption } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'

const data = useEquipData()
const { meta, error, loading } = data

const equip = shallowRef<EquipData | null>(null)
const state = ref<EnhanceState | null>(null)
const selectError = ref<string | null>(null)
const potentialOptions = shallowRef<PotentialOption[] | null>(null)
let selectSeq = 0

function loadPotential() {
  if (potentialOptions.value) return
  data
    .loadPotentialOptions()
    .then((o) => (potentialOptions.value = o))
    .catch(() => {
      /* the potential tab keeps showing 載入中; the rest of the page works */
    })
}

async function onSelect(id: number) {
  const seq = ++selectSeq
  selectError.value = null
  loadPotential()
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

// --- mobile: compact tooltip pinned on top, expandable (spec §4) ---
const MOBILE_QUERY = '(max-width: 767.98px)'
const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null
const isMobile = ref(mql?.matches ?? false)
const expanded = ref(false)
const onMediaChange = (ev: MediaQueryListEvent) => (isMobile.value = ev.matches)

onMounted(() => {
  mql?.addEventListener?.('change', onMediaChange)
  // No selector until Task 7's picker: start with a random tool-scope equip (spec: 進頁隨機選一件).
  data.load().then(() => {
    const e = data.randomPick()
    if (e && !equip.value) onSelect(e.id)
  })
})
onBeforeUnmount(() => mql?.removeEventListener?.('change', onMediaChange))
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

    <div v-if="selectError" class="alert alert-warning py-2" role="alert" data-test="select-error">{{ selectError }}</div>

    <!-- B (tooltip, sticky) + C (editor); on phones stacked A → B → C with a compact B pinned on top -->
    <div class="enhance-grid">
      <div class="tooltip-pin" :class="{ mobile: isMobile, expanded: isMobile && expanded }" data-test="tooltip-pin">
        <template v-if="view">
          <div class="tooltip-scroll">
            <EquipTooltip :equip="view.equip" :breakdown="view.breakdown" :state="view.state" :summary="view.summary"
              :locked="view.locked" :set-info="view.setInfo" :spec-job="view.specJob" :tags="view.tags"
              :compact="isMobile && !expanded" />
          </div>
          <button v-if="isMobile" type="button" class="btn btn-sm btn-secondary tooltip-toggle w-100"
            :aria-expanded="expanded" data-test="tooltip-toggle" @click="expanded = !expanded">
            {{ expanded ? '▲ 收合說明框' : '▼ 展開說明框' }}
          </button>
        </template>
        <div v-else class="tooltip-empty text-muted">請先選擇一件裝備</div>
      </div>
      <div class="editor-col">
        <EnhanceEditor v-if="view" :key="view.equip.id" :state="view.state" :equip="view.equip" :locked="view.locked"
          :potential-options="potentialOptions" />
        <div v-else class="card editor-empty">
          <div class="card-content text-muted">選擇裝備後即可設定星力、卷軸、鐵鎚、追加屬性…</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.enhance-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.tooltip-pin {
  position: sticky;
  top: 76px;
  width: 300px;
  z-index: 5;
}

.tooltip-empty {
  width: 300px;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--bs-border-color);
  border-radius: 6px;
}

.editor-empty {
  min-height: 300px;
}

.tooltip-toggle {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  padding: 0.1rem;
  font-size: 0.75rem;
}

@media (max-width: 767.98px) {
  .enhance-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  .tooltip-pin {
    width: 100%;
    top: 46px; // collapsed navbar (42px at 390px width) + small gap

    .tooltip-empty {
      width: 100%;
      padding: 1rem;
    }

    &.expanded .tooltip-scroll {
      max-height: 65vh;
      overflow-y: auto;
    }

    :deep(.equip-tooltip:not(.compact)) {
      width: 100%;
    }
  }
}
</style>

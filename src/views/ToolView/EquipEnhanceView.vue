<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import EnhanceEditor from '@/components/equip/EnhanceEditor.vue'
import EnhanceSidebar from '@/components/equip/EnhanceSidebar.vue'
import EquipPicker from '@/components/equip/EquipPicker.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import { lockReasons, PANELS, type EnhancePanelId, type PanelId } from '@/components/equip/panels'
import { tooltipSummary } from '@/components/equip/summary'
import '@/components/equip/ui/equip-ui.scss'
import { useEquipData } from '@/composables/useEquipData'
import { computeBreakdown, emptyState, lockedTabs, type EnhanceState } from '@/utils/mst/enhance/equip'
import type { PotentialOption } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'

/** rng for the on-load random pick (tests inject a deterministic one). */
const props = defineProps<{ rng?: () => number }>()

const data = useEquipData()
const { meta, error, loading } = data

const equip = shallowRef<EquipData | null>(null)
const state = ref<EnhanceState | null>(null)
/** Bumped on every applied selection (same item included): re-keys the editor so panel inputs reset. */
const selectionCount = ref(0)
const selectError = ref<string | null>(null)
const potentialOptions = shallowRef<PotentialOption[] | null>(null)
const potentialError = ref<string | null>(null)
let selectSeq = 0
let disposed = false

// ---- active panel (page level): the picker, or the last chosen enhancement panel (kept while the picker shows) ----
const panel = ref<EnhancePanelId>('starforce')
const showPicker = ref(false)
const active = computed<PanelId>(() => (showPicker.value ? 'picker' : panel.value))
const locked = computed(() => lockReasons(equip.value))

function onSidebarSelect(p: PanelId) {
  if (p === 'picker') {
    showPicker.value = true
    return
  }
  if (locked.value.has(p)) return
  showPicker.value = false
  panel.value = p
}

/** Keeps the panel on an unlocked one after the equip changed (first unlocked in sidebar order). */
function ensureUnlockedPanel() {
  const m = locked.value
  if (!m.has(panel.value)) return
  const first = PANELS.find((p) => !m.has(p.id))
  if (first) panel.value = first.id
}

// ---- potential options ----
let potentialPending = false
function loadPotential() {
  if (potentialOptions.value || potentialPending) return
  potentialPending = true
  data
    .loadPotentialOptions()
    .then((o) => {
      potentialOptions.value = o
      potentialError.value = null
    })
    .catch((err) => (potentialError.value = err instanceof Error ? err.message : String(err)))
    .finally(() => (potentialPending = false))
}
function retryPotential() {
  potentialError.value = null
  loadPotential()
}

// ---- selection ----
async function onSelect(id: number) {
  const seq = ++selectSeq
  selectError.value = null
  loadPotential()
  try {
    const e = await data.loadEquip(id)
    if (seq !== selectSeq || disposed) return // a later selection won
    equip.value = e
    state.value = emptyState(e)
    selectionCount.value++
    ensureUnlockedPanel()
  } catch (err) {
    if (seq === selectSeq) selectError.value = err instanceof Error ? err.message : String(err)
  }
}

const view = computed(() => {
  const e = equip.value
  const s = state.value
  if (!e || !s) return null
  const breakdown = computeBreakdown(e, s)
  const lockedSet = lockedTabs(e)
  return {
    equip: e,
    state: s,
    breakdown,
    locked: lockedSet,
    summary: tooltipSummary(e, s, breakdown, lockedSet),
    setInfo: data.setInfo(e.setId),
    specJob: data.jobName(e.specJob),
    // official category / detail names; slot name only for items outside the official categories
    tags: e.searchCategory === null
      ? [data.slotName(e.slot)]
      : [data.categoryName(e.searchCategory), data.detailName(e.searchCategory, e.searchDetail)]
  }
})

// ---- responsive (spec §3): < 1200 compact C pinned on top; < 992 single column + collapsed navbar ----
const COMPACT_QUERY = '(max-width: 1199.98px)'
const MOBILE_QUERY = '(max-width: 991.98px)'
function media(query: string) {
  const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const matches = ref(mql?.matches ?? false)
  const onChange = (ev: MediaQueryListEvent) => (matches.value = ev.matches)
  return { mql, matches, onChange }
}
const compactMq = media(COMPACT_QUERY)
const mobileMq = media(MOBILE_QUERY)
const isCompact = compactMq.matches
const isMobile = mobileMq.matches
const expanded = ref(false)

/** Sticky top of C: below the fixed navbar (expanded ≥ 992px, collapsed below) + a small gap. */
const stickyTop = computed(() => (isMobile.value ? 46 : 76))
const outerStyle = { alignItems: 'start' } as const
// < 1200 the pinned aside spans the column but only the tooltip / toggle are opaque: the rest lets clicks
// through to the panel scrolled underneath (pointer-events none on the aside, auto on its visible parts).
const pinStyle = computed(() => ({
  top: `${stickyTop.value}px`,
  ...(isCompact.value ? { pointerEvents: 'none' as const } : {})
}))
const scrollStyle = computed(() => ({
  maxHeight: isCompact.value ? '65vh' : `calc(100vh - ${stickyTop.value}px - 16px)`,
  overflowY: 'auto' as const,
  // a vertical scrollbar narrows the column: the tooltip fills it (CSS) instead of adding a horizontal bar
  overflowX: 'hidden' as const,
  ...(isCompact.value ? { pointerEvents: 'auto' as const } : {})
}))
const toggleStyle = { pointerEvents: 'auto' } as const

const picker = ref<InstanceType<typeof EquipPicker> | null>(null)

onMounted(() => {
  for (const m of [compactMq, mobileMq]) m.mql?.addEventListener?.('change', m.onChange)
  // 進頁隨機選一件 (spec §5.1); the picker follows without emitting.
  data.load().then(() => {
    if (disposed || equip.value) return
    const e = data.randomPick(props.rng)
    if (!e) return
    picker.value?.syncTo(e.id)
    onSelect(e.id)
  })
})
onBeforeUnmount(() => {
  disposed = true
  for (const m of [compactMq, mobileMq]) m.mql?.removeEventListener?.('change', m.onChange)
})
</script>

<template>
  <!-- DOM order = < 992px reading order: [equip block] → C → left area ([tab row] → panel).
       ≥ 1200 places C in the right column explicitly (CSS grid-column/grid-row). -->
  <div class="equip-enhance" :style="outerStyle" data-test="enhance-grid">
    <!-- < 992: the 目前裝備 cell as its own full-width block -->
    <EnhanceSidebar v-if="isMobile" part="equip" class="eq-mobile-equip" :equip="equip" :active="active"
      :locked="locked" data-test="mobile-equip" @select="onSidebarSelect" />

    <!-- C: tooltip (sticky; ≥1200 right column, below that a compact version pinned on top) -->
    <aside class="eq-tip" :class="{ compact: isCompact, expanded: isCompact && expanded }" :style="pinStyle"
      data-test="tooltip-pin">
      <div class="eq-tip__scroll" :style="scrollStyle" data-test="tooltip-scroll">
        <EquipTooltip v-if="view" :equip="view.equip" :breakdown="view.breakdown" :state="view.state"
          :summary="view.summary" :locked="view.locked" :set-info="view.setInfo" :spec-job="view.specJob"
          :tags="view.tags" :compact="isCompact && !expanded" />
        <EquipTooltip v-else placeholder :compact="isCompact" />
      </div>
      <button v-if="isCompact && view" type="button" class="eq-tip__toggle" :style="toggleStyle" :aria-expanded="expanded"
        data-test="tooltip-toggle" @click="expanded = !expanded">
        {{ expanded ? '收合說明框' : '展開說明框' }}
      </button>
    </aside>

    <!-- left area: sidebar | 8px | middle (stretched: top and bottom edges aligned); < 992 middle only -->
    <div class="eq-left" data-test="enhance-left">
      <EnhanceSidebar v-if="!isMobile" class="eq-left__side" :equip="equip" :active="active" :locked="locked"
        @select="onSidebarSelect" />
      <div class="eq-main">
        <div v-if="error" class="eq-alert eq-alert--error" role="alert" data-test="load-error">
          資料載入失敗：{{ error }}
        </div>
        <div v-if="selectError" class="eq-alert eq-alert--warn" role="alert" data-test="select-error">
          {{ selectError }}
        </div>

        <!-- < 992: enhancement tabs as a horizontal row directly above the editor -->
        <EnhanceSidebar v-if="isMobile" part="tabs" :equip="equip" :active="active" :locked="locked"
          data-test="enhance-tabs" @select="onSidebarSelect" />

        <EquipPicker v-show="active === 'picker'" ref="picker" class="eq-main__card" :data="data"
          :selected-id="equip?.id ?? null" @select="onSelect" />

        <EnhanceEditor v-if="view" v-show="active !== 'picker'" :key="selectionCount" :state="view.state"
          class="eq-main__card" :equip="view.equip" :active="panel" :potential-options="potentialOptions"
          :potential-error="potentialError" @retry-potential="retryPotential">
          <template #note>
            <span v-if="meta" data-test="data-version">資料版本：{{ meta.dataVersion }}</span>
          </template>
        </EnhanceEditor>
        <div v-else-if="active !== 'picker'" class="eq-card eq-main__card editor-empty" data-test="editor-placeholder">
          <span class="editor-empty__text">{{ loading ? '資料載入中…' : '請先選擇裝備' }}</span>
          <div v-if="meta" class="editor-empty__note" data-test="data-version">資料版本：{{ meta.dataVersion }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Layout (global constraints): outer [left 1fr] 40px [C 320px], align-items:start (inline);
// left area 190px 8px 1fr, stretch; C sticky with its own max-height + scroll (inline).
.equip-enhance {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  column-gap: 40px;
  padding: 20px 0 24px;
}

// C precedes the left area in the DOM (mobile reading order), so ≥ 1200 places both explicitly
.eq-left {
  grid-column: 1;
  grid-row: 1;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  column-gap: 8px;
  align-items: stretch;
  min-width: 0;
}

.eq-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

// the visible main card fills the middle column (sidebar and middle share top and bottom edges)
.eq-main__card {
  flex: 1 0 auto;
}

.eq-alert {
  padding: 8px 12px;
  font-size: 14px;

  &--error {
    background: #fdf3f3;
    border: 1px solid #e6b3b3;
    color: #9b2c2c;
  }

  &--warn {
    background: #fff8e6;
    border: 1px solid #e8d08a;
    color: #7a5b00;
  }
}

.editor-empty {
  display: flex;
  flex-direction: column;
  color: #7a8597;
}

.editor-empty__note {
  margin-top: auto;
  padding-top: 14px;
  font-size: 12px;
}

.eq-tip {
  grid-column: 2;
  grid-row: 1;
  position: sticky;
  z-index: 5;
  width: 320px;
}

.eq-tip__scroll {
  // keep the tooltip's own look; only scrolling here
  scrollbar-width: thin;

  // fill the column (320px, or less once the vertical scrollbar shows) instead of overflowing it
  :deep(.equip-tooltip) {
    width: 100%;
  }
}

.eq-tip__toggle {
  display: block;
  width: 100%;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--color-navbar, rgb(40, 50, 65));
  color: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

// 992–1199: two columns (sidebar + middle); compact C pinned on top
@media (max-width: 1199.98px) {
  .equip-enhance {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 12px;
  }

  // single column in DOM order: C (first in the DOM) → left area
  .eq-left,
  .eq-tip {
    grid-column: auto;
    grid-row: auto;
  }

  .eq-tip {
    width: 100%;

    // collapsed summary row spans the column
    :deep(.equip-tooltip.compact) {
      width: 100%;
    }

    // expanded full tooltip keeps its in-game width, right-aligned in the column (controller ruling, Task 10 I1);
    // the scroll box itself shrinks to it, so its scrollbar sits on the tooltip and the rest of the row is click-through
    &.expanded .eq-tip__scroll {
      max-width: 320px;
      margin-left: auto;
    }
  }
}

// < 992: single column in DOM order — equip block → compact C → tab row → panel (vertical sidebar not rendered)
@media (max-width: 991.98px) {
  .equip-enhance {
    row-gap: 8px;
    padding-top: 12px;
  }

  .eq-left {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

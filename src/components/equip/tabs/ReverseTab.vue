<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { computeBreakdown, type EnhanceState, type EnhanceTab } from '@/utils/mst/enhance/equip'
import { flameStats, reverseFlame, type FlameLine } from '@/utils/mst/enhance/flame'
import { FLAME } from '@/utils/mst/enhance/rules/flame'
import { SCROLLS } from '@/utils/mst/enhance/rules/scroll'
import {
  reverseRandomAverage,
  reverseScrollDetailed,
  REVERSE_MAX_USED_SLOTS,
  scrollSummary,
  type ScrollEntry
} from '@/utils/mst/enhance/scroll'
import type { EquipData, StatKey, Stats } from '@/utils/mst/enhance/types'
import { formatNum, formatStats, STAT_LABEL } from '../format'

const props = defineProps<{ equip: EquipData; locked: ReadonlySet<EnhanceTab> }>()
const state = defineModel<EnhanceState>('state', { required: true })

type Inputs = Partial<Record<StatKey, number | string>>
function toStats(inputs: Inputs): Stats {
  const out: Stats = {}
  for (const [k, v] of Object.entries(inputs) as [StatKey, number | string][]) {
    const n = Number(v)
    if (v !== '' && Number.isFinite(n) && n !== 0) out[k] = n
  }
  return out
}
function fill(inputs: Inputs, keys: StatKey[], s: Stats) {
  for (const k of keys) inputs[k] = s[k] ?? ''
}

// ---------------------------------------------------------------- flame
const flameKeys = computed<StatKey[]>(() => {
  const keys = new Set<StatKey>()
  for (const d of FLAME.poolFor(props.equip.isWeapon, props.equip.level)) for (const k of d.statKeys) keys.add(k)
  return [...keys]
})
const flameIn = reactive<Inputs>({})
const flameResults = ref<FlameLine[][] | null>(null)
const statName = (id: string) => FLAME.stats.find((s) => s.id === id)?.name ?? id

function runFlame() {
  const found = reverseFlame(props.equip, toStats(flameIn), 50)
  // Fewest lines first; on boss items keep each flame family together.
  flameResults.value = found
    .map((lines, i) => ({ lines, i, fam: family(lines) }))
    .sort((a, b) => a.lines.length - b.lines.length || a.fam.localeCompare(b.fam) || a.i - b.i)
    .map((r) => r.lines)
}
/** Boss items: which flame family can roll these tiers (強力／永遠 T1–T3, 覺醒 T3–T7). */
function family(lines: FlameLine[]): string {
  if (!props.equip.flameBoss || lines.length === 0) return ''
  const max = Math.max(...lines.map((l) => l.tier))
  const min = Math.min(...lines.map((l) => l.tier))
  if (max <= 3 && min >= 3) return '強力／永遠／覺醒'
  return max <= 3 ? '強力／永遠' : '覺醒類'
}
function lineText(l: FlameLine): string {
  const v = Object.values(flameStats(props.equip, [l]))[0] ?? 0
  return `${statName(l.stat)} T${l.tier}（+${formatNum(v, 0)}）`
}
function applyFlame(lines: FlameLine[]) {
  state.value.flame = lines.map((l) => ({ ...l }))
}
function flameFromTooltip() {
  fill(flameIn, flameKeys.value, computeBreakdown(props.equip, state.value).flame)
}

// ---------------------------------------------------------------- scroll
const SCROLL_KEYS: StatKey[] = ['str', 'dex', 'int', 'luk', 'maxHp', 'att', 'matt', 'def']
const scrollIn = reactive<Inputs>({})
const usedSlots = ref<number | string>('')
const slotsNum = computed(() => Math.floor(Number(usedSlots.value)))
const overLimit = computed(() => Number.isFinite(slotsNum.value) && slotsNum.value > REVERSE_MAX_USED_SLOTS)
const canRunScroll = computed(
  () => usedSlots.value !== '' && Number.isFinite(slotsNum.value) && slotsNum.value >= 0 && !overLimit.value
)
const scrollResult = ref<{
  results: ScrollEntry[][]
  incomplete: boolean
  average: Stats
} | null>(null)

const CHOICE_LABEL: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: 'HP',
  att: '攻擊',
  matt: '魔攻'
}
function entryText(e: ScrollEntry): string {
  const name = SCROLLS.items.find((d) => d.id === e.scrollId)?.name ?? e.scrollId
  const choice = e.choice ? `（${CHOICE_LABEL[e.choice] ?? e.choice}）` : ''
  return `${name}${choice} ×${e.count}`
}

function runScroll() {
  if (!canRunScroll.value) return
  const observed = toStats(scrollIn)
  const r = reverseScrollDetailed(props.equip, observed, slotsNum.value)
  scrollResult.value = {
    results: r.results,
    incomplete: r.truncated || r.timedOut,
    average: reverseRandomAverage(observed, slotsNum.value)
  }
}
function applyScroll(entries: ScrollEntry[]) {
  state.value.scroll.entries = entries.map((e) => ({ ...e }))
}
function scrollFromTooltip() {
  fill(scrollIn, SCROLL_KEYS, computeBreakdown(props.equip, state.value).scroll)
  usedSlots.value = scrollSummary(props.equip, state.value.scroll, state.value.hammer).used
}
</script>

<template>
  <div class="reverse-tab">
    <div class="text-muted small mb-2">輸入說明框上看到的分項數值（綠＝追加屬性、藍＝卷軸），推回可能的組合。</div>

    <!-- flame -->
    <section class="rev-section">
      <div class="section-title d-flex align-items-center gap-2">
        追加屬性反算
        <button v-if="!locked.has('flame')" type="button" class="btn btn-sm btn-link p-0" @click="flameFromTooltip">
          帶入目前數值
        </button>
      </div>
      <div v-if="locked.has('flame')" class="text-muted">此裝備無法附加追加屬性</div>
      <template v-else>
        <div class="stat-inputs">
          <label v-for="k in flameKeys" :key="k" class="stat-input">
            <span>{{ STAT_LABEL[k] }}</span>
            <input v-model="flameIn[k]" type="number" min="0" class="form-control form-control-sm" :data-test="`rf-${k}`" />
          </label>
        </div>
        <button type="button" class="btn btn-sm btn-primary mt-2" data-test="rf-run" @click="runFlame">反算</button>
        <template v-if="flameResults">
          <div v-if="!flameResults.length" class="text-warning mt-2" data-test="rf-none">找不到符合的星火組合</div>
          <ul v-else class="list-group list-group-flush mt-2 results">
            <li v-for="(lines, i) in flameResults" :key="i" class="list-group-item d-flex align-items-center gap-2"
              data-test="rf-result">
              <span v-if="family(lines)" class="badge text-bg-light">{{ family(lines) }}</span>
              <span class="flex-grow-1">{{ lines.length ? lines.map(lineText).join('、') : '（無追加屬性）' }}</span>
              <button type="button" class="btn btn-sm btn-outline-primary" data-test="rf-apply" @click="applyFlame(lines)">
                套用
              </button>
            </li>
          </ul>
          <div v-if="flameResults.length >= 50" class="text-muted small mt-1">只列出前 50 組</div>
        </template>
      </template>
    </section>

    <!-- scroll -->
    <section class="rev-section mt-4">
      <div class="section-title d-flex align-items-center gap-2">
        卷軸反算
        <button v-if="!locked.has('scroll')" type="button" class="btn btn-sm btn-link p-0" @click="scrollFromTooltip">
          帶入目前數值
        </button>
      </div>
      <div v-if="locked.has('scroll')" class="text-muted">此裝備沒有可上卷次數</div>
      <template v-else>
        <div class="stat-inputs">
          <label v-for="k in SCROLL_KEYS" :key="k" class="stat-input">
            <span>{{ STAT_LABEL[k] }}</span>
            <input v-model="scrollIn[k]" type="number" min="0" class="form-control form-control-sm" :data-test="`rs-${k}`" />
          </label>
          <label class="stat-input">
            <span>成功次數</span>
            <input v-model="usedSlots" type="number" min="0" :max="REVERSE_MAX_USED_SLOTS"
              class="form-control form-control-sm" data-test="rs-slots" />
          </label>
        </div>
        <div v-if="overLimit" class="text-danger small mt-1" data-test="rs-limit">
          成功次數最多 {{ REVERSE_MAX_USED_SLOTS }} 次
        </div>
        <button type="button" class="btn btn-sm btn-primary mt-2" :disabled="!canRunScroll" data-test="rs-run"
          @click="runScroll">
          反算
        </button>
        <template v-if="scrollResult">
          <div v-if="scrollResult.incomplete" class="alert alert-warning py-1 px-2 mt-2 small" data-test="rs-incomplete">
            結果可能不完整（組合太多或計算逾時，只列出部分）
          </div>
          <div v-if="!scrollResult.results.length" class="text-warning mt-2" data-test="rs-none">
            找不到符合的固定值卷軸組合
          </div>
          <ul v-else class="list-group list-group-flush mt-2 results">
            <li v-for="(entries, i) in scrollResult.results" :key="i"
              class="list-group-item d-flex align-items-center gap-2" data-test="rs-result">
              <span class="flex-grow-1">{{ entries.length ? entries.map(entryText).join('、') : '（未上卷）' }}</span>
              <button type="button" class="btn btn-sm btn-outline-primary" @click="applyScroll(entries)">套用</button>
            </li>
          </ul>
          <div v-if="Object.keys(scrollResult.average).length" class="text-muted small mt-2" data-test="rs-avg">
            若全為隨機值卷軸，平均每張：{{ formatStats(scrollResult.average) }}
          </div>
        </template>
      </template>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

.stat-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.4rem 0.6rem;
}

.stat-input {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
}

.results {
  max-height: 320px;
  overflow-y: auto;
  font-size: 0.85rem;
}
</style>

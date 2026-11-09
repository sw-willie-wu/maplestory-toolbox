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
import StepperInput from '../ui/StepperInput.vue'
import { formatNum, formatStats, STAT_LABEL } from '../format'

const props = defineProps<{ equip: EquipData; locked: ReadonlySet<EnhanceTab> }>()
const state = defineModel<EnhanceState>('state', { required: true })

/** Observed values; blank (null) = not entered, so it does not constrain the search. */
type Inputs = Partial<Record<StatKey, number | null>>
function toStats(inputs: Inputs): Stats {
  const out: Stats = {}
  for (const [k, v] of Object.entries(inputs) as [StatKey, number | null][]) {
    if (v !== null && v !== undefined && v !== 0) out[k] = v
  }
  return out
}
function fill(inputs: Inputs, keys: StatKey[], s: Stats) {
  for (const k of keys) inputs[k] = s[k] ?? null
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
/**
 * Success count. Not clamped by the stepper (no max, no lower bound) so an out-of-range value
 * is kept and explained (negative / above REVERSE_MAX_USED_SLOTS) instead of silently changed.
 */
const usedSlots = ref<number | null>(null)
const negative = computed(() => usedSlots.value !== null && usedSlots.value < 0)
const overLimit = computed(() => usedSlots.value !== null && usedSlots.value > REVERSE_MAX_USED_SLOTS)
const canRunScroll = computed(() => usedSlots.value !== null && !negative.value && !overLimit.value)
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
  if (!canRunScroll.value || usedSlots.value === null) return
  const observed = toStats(scrollIn)
  const r = reverseScrollDetailed(props.equip, observed, usedSlots.value)
  scrollResult.value = {
    results: r.results,
    incomplete: r.truncated || r.timedOut,
    average: reverseRandomAverage(observed, usedSlots.value)
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
    <!-- flame -->
    <h3 class="eq-card__title">
      星火反算
      <button v-if="!locked.has('flame')" type="button" class="eq-link rv-fill" @click="flameFromTooltip">
        帶入目前數值
      </button>
    </h3>
    <p v-if="locked.has('flame')" class="eq-msg">此裝備無法附加追加屬性</p>
    <template v-else>
      <p class="rv-hint">輸入說明框上的追加屬性（綠色）分項數值；留空的欄位不列入條件。</p>
      <div class="eq-form rv-form">
        <template v-for="k in flameKeys" :key="k">
          <label :for="`rf-${k}`">{{ STAT_LABEL[k] }}：</label>
          <StepperInput :id="`rf-${k}`" :model-value="flameIn[k] ?? null" nullable :min="0"
            :ariaLabel="`追加屬性 ${STAT_LABEL[k]}`" :data-test="`rf-${k}`"
            @update:model-value="flameIn[k] = $event" />
        </template>
      </div>
      <div class="rv-actions">
        <button type="button" class="eq-btn" data-test="rf-run" @click="runFlame">反算</button>
      </div>
      <template v-if="flameResults">
        <p v-if="!flameResults.length" class="eq-msg eq-msg--warn rv-gap" data-test="rf-none">找不到符合的星火組合</p>
        <ul v-else class="eq-list rv-results">
          <li v-for="(lines, i) in flameResults" :key="i" data-test="rf-result">
            <span v-if="family(lines)" class="rv-tag">{{ family(lines) }}</span>
            <span class="rv-text">{{ lines.length ? lines.map(lineText).join('、') : '（無追加屬性）' }}</span>
            <button type="button" class="eq-btn eq-btn--ghost eq-btn--sm" data-test="rf-apply" @click="applyFlame(lines)">
              套用
            </button>
          </li>
        </ul>
        <p v-if="flameResults.length >= 50" class="rv-hint">只列出前 50 組</p>
      </template>
    </template>

    <!-- scroll -->
    <h3 class="eq-card__title">
      卷軸反算
      <button v-if="!locked.has('scroll')" type="button" class="eq-link rv-fill" @click="scrollFromTooltip">
        帶入目前數值
      </button>
    </h3>
    <p v-if="locked.has('scroll')" class="eq-msg">此裝備沒有可上卷次數</p>
    <template v-else>
      <p class="rv-hint">輸入說明框上的卷軸（藍色）分項數值與成功次數；留空的欄位不列入條件。</p>
      <div class="eq-form rv-form">
        <template v-for="k in SCROLL_KEYS" :key="k">
          <label :for="`rs-${k}`">{{ STAT_LABEL[k] }}：</label>
          <StepperInput :id="`rs-${k}`" :model-value="scrollIn[k] ?? null" nullable :min="-Infinity"
            :ariaLabel="`卷軸 ${STAT_LABEL[k]}`" :data-test="`rs-${k}`"
            @update:model-value="scrollIn[k] = $event" />
        </template>
        <label for="rs-slots">成功次數：</label>
        <StepperInput id="rs-slots" v-model="usedSlots" nullable :min="-Infinity" suffix="次" ariaLabel="成功次數"
          data-test="rs-slots" />
      </div>
      <p v-if="negative" class="eq-msg eq-msg--error rv-gap" role="alert" data-test="rs-negative">
        成功次數不可為負數
      </p>
      <p v-if="overLimit" class="eq-msg eq-msg--error rv-gap" role="alert" data-test="rs-limit">
        成功次數最多 {{ REVERSE_MAX_USED_SLOTS }} 次
      </p>
      <div class="rv-actions">
        <button type="button" class="eq-btn" :disabled="!canRunScroll" data-test="rs-run" @click="runScroll">反算</button>
        <span v-if="usedSlots === null" class="rv-hint">填入成功次數後可反算</span>
      </div>
      <template v-if="scrollResult">
        <p v-if="scrollResult.incomplete" class="rv-warn" data-test="rs-incomplete">
          結果可能不完整（組合太多或計算逾時，只列出部分）
        </p>
        <p v-if="!scrollResult.results.length" class="eq-msg eq-msg--warn rv-gap" data-test="rs-none">
          找不到符合的固定值卷軸組合
        </p>
        <ul v-else class="eq-list rv-results">
          <li v-for="(entries, i) in scrollResult.results" :key="i" data-test="rs-result">
            <span class="rv-text">{{ entries.length ? entries.map(entryText).join('、') : '（未上卷）' }}</span>
            <button type="button" class="eq-btn eq-btn--ghost eq-btn--sm" @click="applyScroll(entries)">套用</button>
          </li>
        </ul>
        <p v-if="Object.keys(scrollResult.average).length" class="rv-hint" data-test="rs-avg">
          若全為隨機值卷軸，平均每張：{{ formatStats(scrollResult.average) }}
        </p>
      </template>
    </template>
  </div>
</template>

<style lang="scss" scoped>
$line: rgb(200, 206, 216);
$muted: #7a8597;

.rv-fill {
  margin-left: auto;
}

// long stat names (要求等級減少) wrap inside the 6.2em label column instead of overflowing into the stepper
.rv-form > label {
  white-space: normal;
  line-height: 1.25;
}

.rv-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: $muted;
}

.rv-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;

  .rv-hint {
    margin: 0;
  }
}

.rv-gap {
  margin-top: 8px;
}

.rv-warn {
  margin: 10px 0 0;
  padding: 6px 10px;
  background: rgb(255, 243, 205);
  font-size: 13px;
  color: #7a5a00;
}

.rv-results {
  max-height: 320px;
  margin-top: 10px;
  overflow-y: auto;
  border-top: 1px solid $line;
  border-bottom: 1px solid $line;
}

.rv-tag {
  flex: none;
  padding: 1px 6px;
  border: 1px solid $line;
  font-size: 12px;
  color: $muted;
}

.rv-text {
  flex: 1;
  min-width: 0;
}

.rv-results + .rv-hint {
  margin-top: 6px;
}
</style>

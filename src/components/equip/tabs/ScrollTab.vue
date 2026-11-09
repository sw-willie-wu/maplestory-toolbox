<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { RECOVERY, SCROLLS, scrollGroupOf, type ScrollDef } from '@/utils/mst/enhance/rules/scroll'
import { scrollExpectation, scrollSummary, totalSlots, type ScrollEntry } from '@/utils/mst/enhance/scroll'
import type { EquipData, StatKey } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { clampInt, formatNum, formatPct, STAT_LABEL, type NoticeItem } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

/** Scrolls usable on this slot (ScrollDef.slots). */
const available = computed(() => {
  const group = scrollGroupOf(props.equip.slot)
  return SCROLLS.items.filter((d) => !d.slots || d.slots.includes(group))
})
const defOf = (id: string): ScrollDef | undefined => SCROLLS.items.find((d) => d.id === id)

const isMagician = computed(
  () =>
    props.equip.isMagicWeapon ||
    (Array.isArray(props.equip.jobs) && props.equip.jobs.length === 1 && props.equip.jobs[0] === 'magician')
)

const TRACE_CHOICES = [
  { value: 'str', label: 'STR' },
  { value: 'dex', label: 'DEX' },
  { value: 'int', label: 'INT（魔攻）' },
  { value: 'luk', label: 'LUK' },
  { value: 'maxHp', label: 'HP' }
]
const ATT_CHOICES = [
  { value: 'att', label: '攻擊力' },
  { value: 'matt', label: '魔法攻擊力' }
]
/** Stats a random-value scroll average can be entered for. */
const AVG_KEYS: StatKey[] = ['str', 'dex', 'int', 'luk', 'maxHp', 'att', 'matt', 'def']

function defaultChoice(def: ScrollDef): string | undefined {
  if (def.kind === 'random') return undefined
  if (def.spellTrace) return isMagician.value ? 'int' : 'str'
  return isMagician.value ? 'matt' : 'att'
}

function choicesFor(id: string) {
  const def = defOf(id)
  if (!def || def.kind === 'random') return []
  return def.spellTrace ? TRACE_CHOICES : ATT_CHOICES
}

function addEntry() {
  const def = available.value[0]
  if (!def) return
  const entry: ScrollEntry = { scrollId: def.id, count: 1 }
  const c = defaultChoice(def)
  if (c) entry.choice = c
  state.value.scroll.entries.push(entry)
}

function setScroll(entry: ScrollEntry, id: string) {
  const def = defOf(id)
  if (!def) return
  entry.scrollId = id
  const c = defaultChoice(def)
  if (c) entry.choice = c
  else delete entry.choice
  if (def.kind === 'random') entry.avgPerScroll = entry.avgPerScroll ?? {}
  else delete entry.avgPerScroll
}

function setCount(entry: ScrollEntry, v: string) {
  entry.count = clampInt(v, 0, 999)
}

function setAvg(entry: ScrollEntry, key: StatKey, v: string) {
  const avg = { ...(entry.avgPerScroll ?? {}) }
  const n = Number(v)
  if (v === '' || !Number.isFinite(n) || n === 0) delete avg[key]
  else avg[key] = n
  entry.avgPerScroll = avg
}

function removeEntry(i: number) {
  state.value.scroll.entries.splice(i, 1)
}

const failCount = computed({
  get: () => state.value.scroll.failCount,
  set: (v: number | string) => (state.value.scroll.failCount = clampInt(v, 0, 999))
})

const slots = computed(() => totalSlots(props.equip, state.value.hammer))
const summary = computed(() => scrollSummary(props.equip, state.value.scroll, state.value.hammer))

const recoveryId = ref('')
const recoveryName = computed(() => RECOVERY.items.find((r) => r.id === recoveryId.value)?.name ?? '')
const expectation = computed(() =>
  scrollExpectation(state.value.scroll.entries, recoveryId.value || undefined)
)
const perEntry = (e: ScrollEntry) => scrollExpectation([e]).scrollsUsed

/** The guessed 4th-success bonus only applies to armor-table items (incl. gloves), so the note is shown only there. */
const hasTrace = computed(
  () =>
    ['armor', 'gloves'].includes(scrollGroupOf(props.equip.slot)) &&
    state.value.scroll.entries.some((e) => defOf(e.scrollId)?.spellTrace)
)

const kms = computed<NoticeItem[]>(() => {
  const out: NoticeItem[] = []
  const seen = new Set<string>()
  for (const e of state.value.scroll.entries) {
    const d = defOf(e.scrollId)
    if (d?.source === 'KMS-estimate' && !seen.has(d.id)) {
      seen.add(d.id)
      out.push({ label: d.name, ref: d.ref ?? '' })
    }
  }
  return out
})
const guess = computed<NoticeItem[]>(() => {
  const r = SCROLLS.ruleSources.traceFourthBonus
  return hasTrace.value && r.guess ? [{ label: r.note ?? '咒文的痕跡第 4 次成功加成', ref: r.ref }] : []
})
</script>

<template>
  <div class="scroll-tab">
    <div class="text-muted small mb-2">
      可上卷次數 {{ slots }}（已用 {{ summary.used }}、剩餘 {{ summary.remaining }}、可恢復 {{ summary.recoverable }}）
    </div>

    <div v-for="(e, i) in state.scroll.entries" :key="i" class="entry-row" data-test="scroll-entry">
      <select class="form-select form-select-sm w-auto" :value="e.scrollId" aria-label="卷軸" data-test="scroll-id"
        @change="setScroll(e, ($event.target as HTMLSelectElement).value)">
        <option v-for="d in available" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <select v-if="choicesFor(e.scrollId).length" v-model="e.choice" class="form-select form-select-sm w-auto"
        aria-label="屬性" data-test="scroll-choice">
        <option v-for="c in choicesFor(e.scrollId)" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <div class="input-group input-group-sm count-input">
        <input type="number" min="0" class="form-control" :value="e.count" aria-label="成功張數"
          data-test="scroll-count" @input="setCount(e, ($event.target as HTMLInputElement).value)" />
        <span class="input-group-text">張成功</span>
      </div>
      <span class="text-muted small">
        成功率 {{ formatPct(defOf(e.scrollId)?.successRate ?? 0) }}・期望使用 {{ formatNum(perEntry(e), 1) }} 張
      </span>
      <button type="button" class="btn btn-sm btn-outline-danger ms-auto" aria-label="移除" @click="removeEntry(i)">✕</button>
      <div v-if="defOf(e.scrollId)?.kind === 'random'" class="avg-row w-100">
        <span class="small text-muted me-1">平均每張：</span>
        <label v-for="k in AVG_KEYS" :key="k" class="avg-field">
          <span>{{ STAT_LABEL[k] }}</span>
          <input type="number" class="form-control form-control-sm" :value="e.avgPerScroll?.[k] ?? ''"
            :data-test="`scroll-avg-${k}`" @input="setAvg(e, k, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
    </div>

    <div class="d-flex flex-wrap gap-2 align-items-end mt-2">
      <button type="button" class="btn btn-sm btn-outline-primary" data-test="scroll-add" @click="addEntry">
        ＋ 新增卷軸
      </button>
      <div class="ms-auto fail-input">
        <label class="form-label" for="scroll-fail">失敗次數（可恢復）</label>
        <input id="scroll-fail" v-model.number="failCount" type="number" min="0" class="form-control form-control-sm"
          data-test="scroll-fail" />
      </div>
    </div>

    <div v-if="summary.overflow > 0" class="alert alert-warning py-1 px-2 mt-2 small" data-test="scroll-overflow">
      超出可上卷次數 {{ summary.overflow }} 張（成功 {{ summary.overflowScrolls }}、失敗 {{ summary.overflowFails }}），超出部分不計入說明框。
    </div>

    <div class="expect mt-3" data-test="scroll-expect">
      <div class="expect-title">期望值（依成功率）</div>
      <dl class="expect-grid">
        <dt>期望卷軸消耗</dt>
        <dd>{{ formatNum(expectation.scrollsUsed, 1) }} 張</dd>
        <template v-if="recoveryId">
          <dt>{{ recoveryName }}期望用量</dt>
          <dd data-test="scroll-recovery-used">{{ recoveryName }} {{ formatNum(expectation.recoveryUsed, 1) }} 張</dd>
        </template>
      </dl>
      <div class="d-flex align-items-center gap-2">
        <label class="form-label mb-0" for="scroll-recovery">恢復類道具</label>
        <select id="scroll-recovery" v-model="recoveryId" class="form-select form-select-sm w-auto"
          data-test="scroll-recovery">
          <option value="">不使用</option>
          <option v-for="r in RECOVERY.items" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
    </div>

    <SourceNotice :kms="kms" :guess="guess" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

.count-input {
  width: 8.5rem;
}

.fail-input {
  width: 9rem;
}

.avg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.avg-field {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.8rem;

  input {
    width: 4.5rem;
  }
}
</style>

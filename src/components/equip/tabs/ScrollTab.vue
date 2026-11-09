<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { RECOVERY, SCROLLS, scrollGroupOf, type ScrollChoice, type ScrollDef } from '@/utils/mst/enhance/rules/scroll'
import { scrollExpectation, scrollSummary, totalSlots, type ScrollEntry } from '@/utils/mst/enhance/scroll'
import type { EquipData, StatKey } from '@/utils/mst/enhance/types'
import ItemIcon from '../ItemIcon.vue'
import SourceNotice from '../SourceNotice.vue'
import StepperInput from '../ui/StepperInput.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import { formatNum, formatPct, STAT_LABEL, type NoticeItem } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const MAX_COUNT = 999

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

/** Effect line of a card: gain of one success with the default choice (the picked stat reads 「主屬性」). */
function effectOf(def: ScrollDef): string {
  if (def.kind === 'random') return '隨機數值（自行輸入平均）'
  const choice: ScrollChoice = isMagician.value ? { stat: 'int', magic: true } : {}
  const mainKey: StatKey = isMagician.value ? 'int' : 'str'
  const parts = (Object.entries(def.stats(props.equip.level, props.equip.slot, choice, 1)) as [StatKey, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${def.spellTrace && k === mainKey ? '主屬性' : STAT_LABEL[k]} +${formatNum(v)}`)
  return parts.length ? parts.join(' / ') : '此部位無效果資料'
}

const cards = computed(() => available.value.map((def) => ({ def, effect: effectOf(def) })))

/** Card click: one more success of that scroll (same entry when it is already listed). */
function addScroll(def: ScrollDef) {
  const existing = state.value.scroll.entries.find((e) => e.scrollId === def.id)
  if (existing) {
    existing.count = Math.min(MAX_COUNT, existing.count + 1)
    return
  }
  const entry: ScrollEntry = { scrollId: def.id, count: 1 }
  const c = defaultChoice(def)
  if (c) entry.choice = c
  if (def.kind === 'random') entry.avgPerScroll = {}
  state.value.scroll.entries.push(entry)
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

const slots = computed(() => totalSlots(props.equip, state.value.hammer))
const summary = computed(() => scrollSummary(props.equip, state.value.scroll, state.value.hammer))

const recoveryId = ref('')
const recoveryName = computed(() => RECOVERY.items.find((r) => r.id === recoveryId.value)?.name ?? '')
function setRecovery(id: string, on: boolean) {
  recoveryId.value = on ? id : recoveryId.value === id ? '' : recoveryId.value
}
const expectation = computed(() =>
  scrollExpectation(state.value.scroll.entries, recoveryId.value || undefined)
)
const perEntry = (e: ScrollEntry) => scrollExpectation([e]).scrollsUsed

/** The guessed 4th-success bonus is an armor-table rule that excludes gloves, so the note is shown only on armor. */
const hasTrace = computed(
  () =>
    scrollGroupOf(props.equip.slot) === 'armor' &&
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
    <h3 class="eq-card__title">
      卷軸強化
      <span class="sc-sub">可上卷 {{ slots }} 次・剩餘 {{ summary.remaining }} 次・可恢復 {{ summary.recoverable }} 次</span>
    </h3>
    <div class="sc-grid">
      <button v-for="{ def, effect } in cards" :key="def.id" type="button" class="sc-card"
        :title="`成功率 ${formatPct(def.successRate)}`" :data-test="`scroll-card-${def.id}`" @click="addScroll(def)">
        <ItemIcon :item-id="def.iconItemId" :size="30" />
        <span class="sc-card__text">
          <span class="sc-card__name">{{ def.name }}</span>
          <small data-test="scroll-effect">{{ effect }}</small>
        </span>
      </button>
    </div>

    <h3 class="eq-card__title">已使用</h3>
    <p v-if="!state.scroll.entries.length" class="sc-empty">點選上方卷軸加入（再點一次 = 多一張成功）。</p>
    <div v-for="(e, i) in state.scroll.entries" :key="i" class="sc-used" data-test="scroll-entry">
      <div class="sc-used__main">
        <ItemIcon :item-id="defOf(e.scrollId)?.iconItemId ?? null" :size="22" />
        <span class="sc-used__name">{{ defOf(e.scrollId)?.name ?? e.scrollId }}</span>
        <select v-if="choicesFor(e.scrollId).length" v-model="e.choice" class="eq-control sc-used__choice"
          aria-label="屬性" data-test="scroll-choice">
          <option v-for="c in choicesFor(e.scrollId)" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <StepperInput v-model="e.count" class="sc-used__count" :min="0" :max="MAX_COUNT" suffix="張成功"
          ariaLabel="成功張數" data-test="scroll-count" />
        <span class="sc-used__meta">
          成功率 {{ formatPct(defOf(e.scrollId)?.successRate ?? 0) }}・期望使用 {{ formatNum(perEntry(e), 1) }} 張
        </span>
        <button type="button" class="sc-used__remove" data-test="scroll-remove" @click="removeEntry(i)">移除</button>
      </div>
      <div v-if="defOf(e.scrollId)?.kind === 'random'" class="sc-avg">
        <span class="sc-avg__lead">平均每張：</span>
        <label v-for="k in AVG_KEYS" :key="k" class="sc-avg__field">
          <span>{{ STAT_LABEL[k] }}</span>
          <input type="text" inputmode="decimal" class="eq-control" :value="e.avgPerScroll?.[k] ?? ''"
            :data-test="`scroll-avg-${k}`" @input="setAvg(e, k, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
    </div>

    <div class="eq-form sc-fail">
      <label for="scroll-fail">失敗次數：</label>
      <StepperInput id="scroll-fail" v-model="state.scroll.failCount" :min="0" :max="MAX_COUNT" suffix="可恢復"
        ariaLabel="失敗次數" data-test="scroll-fail" />
    </div>

    <p v-if="summary.overflow > 0" class="sc-warn" role="alert" data-test="scroll-overflow">
      超出可上卷次數 {{ summary.overflow }} 張（成功 {{ summary.overflowScrolls }}、失敗 {{ summary.overflowFails }}），超出部分不計入說明框。
    </p>

    <h3 class="eq-card__title">期望值（依成功率）</h3>
    <div class="eq-res" data-test="scroll-expect">
      <span>卷軸消耗：</span><b>{{ formatNum(expectation.scrollsUsed, 1) }} 張</b>
      <template v-if="recoveryId">
        <span>{{ recoveryName }}：</span><b data-test="scroll-recovery-used">{{ formatNum(expectation.recoveryUsed, 1) }} 張</b>
      </template>
    </div>
    <div class="sc-recovery">
      <div v-for="r in RECOVERY.items" :key="r.id" class="sc-recovery__item" :data-test="`scroll-recovery-${r.id}`">
        <ItemIcon :item-id="r.iconItemId" :size="22" />
        <ToggleSwitch :model-value="recoveryId === r.id" :label="`用${r.name}恢復失敗次數`"
          @update:model-value="setRecovery(r.id, $event)" />
      </div>
    </div>

    <SourceNotice :kms="kms" :guess="guess" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

$line: rgb(200, 206, 216);
$muted: #7a8597;

.sc-sub {
  font-weight: 400;
  font-size: 13px;
  color: $muted;
}

.sc-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.sc-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid $line;
  border-radius: 0;
  background: #fff;
  font: inherit;
  font-size: 14px;
  color: #333;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: rgb(44, 174, 186);
  }

  &:focus-visible {
    outline: 2px solid rgb(44, 174, 186);
    outline-offset: -2px;
  }

  small {
    display: block;
    font-size: 12px;
    color: $muted;
  }
}

.sc-card__text {
  min-width: 0;
}

.sc-empty {
  margin: 0;
  font-size: 13px;
  color: $muted;
}

.sc-used {
  padding: 6px 0;
  font-size: 14px;

  & + & {
    border-top: 1px solid $line;
  }
}

.sc-used__main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.sc-used__name {
  min-width: 9em;
}

.sc-used__choice {
  width: auto;
}

.sc-used__count {
  width: 9.5em;
}

.sc-used__meta {
  font-size: 13px;
  color: $muted;
}

.sc-used__remove {
  margin-left: auto;
  padding: 0 4px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  color: $muted;
  cursor: pointer;

  &:hover {
    color: #c0392b;
    text-decoration: underline;
  }
}

.sc-avg {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 6px 0 0 30px;
  font-size: 13px;
}

.sc-avg__lead {
  color: $muted;
}

.sc-avg__field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;

  input {
    width: 4.5em;
  }
}

.sc-fail {
  margin-top: 14px;
}

.sc-warn {
  margin: 10px 0 0;
  padding: 6px 10px;
  border-left: 0;
  background: rgb(255, 243, 205);
  font-size: 13px;
  color: #7a5a00;
}

.sc-recovery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 12px;
}

.sc-recovery__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 991.98px) {
  .sc-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

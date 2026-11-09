<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState, PotentialPick } from '@/utils/mst/enhance/equip'
import { POTENTIAL, type PotentialKind, type PotentialOption, type PotentialRuleKey } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { kmsNotices } from '../format'

const props = withDefaults(
  defineProps<{
    equip: EquipData
    options: PotentialOption[] | null
    /** Which of the two sidebar panels this is: 潛在能力 or 附加潛在能力 (only that section is rendered). */
    kind: 'potential' | 'bonusPotential'
    /** Message of the last option-list load failure (shown instead of 「載入中」); null when none. */
    error?: string | null
  }>(),
  { error: null }
)
defineEmits<{ retry: [] }>()
const state = defineModel<EnhanceState>('state', { required: true })

type Key = 'potential' | 'additional'
const SECTIONS: { key: Key; kind: PotentialKind; title: string }[] = [
  { key: 'potential', kind: 'main', title: '潛在能力' },
  { key: 'additional', kind: 'additional', title: '附加潛在能力' }
]

const section = computed(() => SECTIONS[props.kind === 'potential' ? 0 : 1])

const group = computed(() => POTENTIAL.slotGroupOf(props.equip.category, props.equip.slot))

/** Options of this kind that fit the item, by grade number (1..4), as display texts (deduplicated). */
const textsByGrade = computed(() => {
  const out: Record<PotentialKind, Map<number, string[]>> = { main: new Map(), additional: new Map() }
  for (const o of props.options ?? []) {
    if (o.reqLevel > props.equip.level || !POTENTIAL.fits(o, group.value)) continue
    const text = POTENTIAL.resolveText(o, props.equip.level).trim()
    if (!text || text.includes('#')) continue
    const m = out[o.kind]
    const list = m.get(o.grade) ?? []
    if (!list.includes(text)) list.push(text)
    m.set(o.grade, list)
  }
  return out
})

/** Line 1 rolls the chosen grade; lines 2–3 the chosen grade or one below. */
function lineOptions(kind: PotentialKind, grade: string | null, line: number): string[] {
  if (grade === null) return []
  const g = POTENTIAL.grades.indexOf(grade) + 1
  const m = textsByGrade.value[kind]
  const own = m.get(g) ?? []
  if (line === 0) return own
  return [...new Set([...own, ...(m.get(g - 1) ?? [])])]
}

function setGrade(key: Key, kind: PotentialKind, v: string) {
  const pick: PotentialPick = state.value[key]
  pick.grade = v === '' ? null : v
  pick.lines = pick.lines.map((l, i) => (l !== null && lineOptions(kind, pick.grade, i).includes(l) ? l : null)) as PotentialPick['lines']
}

function setLine(key: Key, i: number, v: string) {
  state.value[key].lines[i] = v === '' ? null : v
}

const kms = computed(() =>
  kmsNotices<PotentialRuleKey>(POTENTIAL.ruleSources, {
    slotMapping: '可出現的部位',
    additionalId: '潛能／附加潛能的區分',
    optionLevel: '選項數值等級'
  })
)
</script>

<template>
  <div class="potential-tab">
    <h3 class="eq-card__title">{{ section.title }}</h3>
    <div v-if="!options && error" class="pot-error" role="alert" data-test="potential-error">
      <span>潛能選項載入失敗（{{ error }}）</span>
      <button type="button" class="eq-btn eq-btn--ghost eq-btn--sm" data-test="potential-retry" @click="$emit('retry')">
        重試
      </button>
    </div>
    <p v-else-if="!options" class="eq-msg">潛能選項載入中…</p>
    <template v-else>
      <div class="eq-form pot-form">
        <label :for="`pot-grade-${section.key}`">階級：</label>
        <select :id="`pot-grade-${section.key}`" :value="state[section.key].grade ?? ''"
          :aria-label="`${section.title}階級`" :data-test="`pot-grade-${section.key}`"
          @change="setGrade(section.key, section.kind, ($event.target as HTMLSelectElement).value)">
          <option value="">無</option>
          <option v-for="g in POTENTIAL.grades" :key="g" :value="g">{{ g }}</option>
        </select>
        <template v-for="i in [0, 1, 2]" :key="i">
          <label :for="`pot-line-${section.key}-${i}`">第 {{ i + 1 }} 條：</label>
          <div class="full">
            <select :id="`pot-line-${section.key}-${i}`" :value="state[section.key].lines[i] ?? ''"
              :disabled="state[section.key].grade === null" :aria-label="`${section.title}第${i + 1}條`"
              :data-test="`pot-line-${section.key}-${i}`"
              @change="setLine(section.key, i, ($event.target as HTMLSelectElement).value)">
              <option value="">{{ state[section.key].grade === null ? '先選擇階級' : '（未指定）' }}</option>
              <option v-for="t in lineOptions(section.kind, state[section.key].grade, i)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </template>
      </div>
      <p class="eq-msg pot-hint">潛能只顯示於說明框，不計入屬性與期望值。第 1 條為所選階級，第 2、3 條可為同階或低一階。</p>
    </template>
    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
.pot-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 1px solid #e6b3b3;
  background: #fdf3f3;
  color: #9b2c2c;
  font-size: 14px;
}

.pot-form select:disabled {
  background-color: #f1f3f6;
  color: #8a93a0;
}

.pot-hint {
  margin-top: 12px;
  font-size: 12px;
}
</style>

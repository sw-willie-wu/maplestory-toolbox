<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState, PotentialPick } from '@/utils/mst/enhance/equip'
import { POTENTIAL, type PotentialKind, type PotentialOption, type PotentialRuleKey } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { kmsNotices } from '../format'

const props = defineProps<{
  equip: EquipData
  options: PotentialOption[] | null
  /** Which of the two sidebar panels this is: 潛在能力 or 附加潛在能力 (only that section is rendered). */
  kind: 'potential' | 'bonusPotential'
}>()
const state = defineModel<EnhanceState>('state', { required: true })

type Key = 'potential' | 'additional'
const SECTIONS: { key: Key; kind: PotentialKind; title: string }[] = [
  { key: 'potential', kind: 'main', title: '潛在能力' },
  { key: 'additional', kind: 'additional', title: '附加潛在能力' }
]

const sections = computed(() => SECTIONS.filter((s) => s.key === (props.kind === 'potential' ? 'potential' : 'additional')))

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
    <div v-if="!options" class="text-muted">潛能選項載入中…</div>
    <template v-else>
      <div v-for="s in sections" :key="s.key" class="pot-section">
        <div class="section-title">{{ s.title }}</div>
        <div class="row g-2">
          <div class="col-12 col-sm-3">
            <select class="form-select form-select-sm" :value="state[s.key].grade ?? ''" :aria-label="`${s.title}階級`"
              :data-test="`pot-grade-${s.key}`" @change="setGrade(s.key, s.kind, ($event.target as HTMLSelectElement).value)">
              <option value="">無</option>
              <option v-for="g in POTENTIAL.grades" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
          <div v-for="i in [0, 1, 2]" :key="i" class="col-12 col-sm-3">
            <select class="form-select form-select-sm" :value="state[s.key].lines[i] ?? ''"
              :disabled="state[s.key].grade === null" :aria-label="`${s.title}第${i + 1}條`"
              :data-test="`pot-line-${s.key}-${i}`" @change="setLine(s.key, i, ($event.target as HTMLSelectElement).value)">
              <option value="">（第 {{ i + 1 }} 條）</option>
              <option v-for="t in lineOptions(s.kind, state[s.key].grade, i)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="text-muted small mt-2">潛能只顯示於說明框，不計入屬性與期望值。</div>
    </template>
    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';
</style>

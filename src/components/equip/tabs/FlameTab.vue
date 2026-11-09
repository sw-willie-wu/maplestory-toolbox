<script setup lang="ts">
import { computed } from 'vue'
import type { EnhanceState } from '@/utils/mst/enhance/equip'
import { flameNotes, flameProbability, flameStats, type FlameLine } from '@/utils/mst/enhance/flame'
import { FLAME, type FlameRuleKey } from '@/utils/mst/enhance/rules/flame'
import type { EquipData, StatKey } from '@/utils/mst/enhance/types'
import SourceNotice from '../SourceNotice.vue'
import { formatNum, formatPct, kmsNotices } from '../format'

const props = defineProps<{ equip: EquipData }>()
const state = defineModel<EnhanceState>('state', { required: true })

const pool = computed(() => FLAME.poolFor(props.equip.isWeapon, props.equip.level))
const range = computed(() => FLAME.tierRange(props.equip.flameBoss))
const lineCount = computed(() => FLAME.lineCount(props.equip.flameBoss))
const tiers = computed(() => {
  const out: number[] = []
  for (let t = range.value.min; t <= range.value.max; t++) out.push(t)
  return out
})

/** Stats not used by another line (the same stat never appears twice). */
function statsFor(line: FlameLine) {
  const used = new Set(state.value.flame.filter((l) => l !== line).map((l) => l.stat))
  return pool.value.filter((d) => !used.has(d.id))
}
const unused = computed(() => {
  const used = new Set(state.value.flame.map((l) => l.stat))
  return pool.value.filter((d) => !used.has(d.id))
})
const canAdd = computed(() => state.value.flame.length < lineCount.value.max && unused.value.length > 0)

function addLine() {
  const def = unused.value[0]
  if (def && canAdd.value) state.value.flame.push({ stat: def.id, tier: range.value.min })
}
function removeLine(i: number) {
  state.value.flame.splice(i, 1)
}

/** "+24" for one line (the value each of its stats gets). */
function lineValue(line: FlameLine): string {
  const s = flameStats(props.equip, [line])
  const v = Object.values(s)[0] ?? 0
  const pct = (Object.keys(s) as StatKey[]).some((k) => ['bossDamage', 'damagePct', 'allStatPct'].includes(k))
  return `+${formatNum(v, 0)}${pct ? '%' : ''}`
}

const notes = computed(() => flameNotes(props.equip, state.value.flame))

const probabilities = computed(() =>
  state.value.flame.length === 0
    ? []
    : FLAME.flameTypes.map((t) => ({ type: t, ...flameProbability(props.equip, state.value.flame, t.id) }))
)

const kms = computed(() => {
  const labels: Partial<Record<FlameRuleKey, string>> = { tierValues: '各階級數值' }
  if (notes.value.length) labels.bossWeaponAttLowTier = 'BOSS 武器攻擊 T1–T2 數值'
  return kmsNotices(FLAME.ruleSources, labels)
})
</script>

<template>
  <div class="flame-tab">
    <div class="text-muted small mb-2">
      {{ equip.flameBoss ? 'BOSS 裝備：固定 4 條；強力／永遠 T1–T3、覺醒類 T3–T7' : '一般裝備：1～4 條、T1–T5' }}
    </div>

    <div v-for="(l, i) in state.flame" :key="i" class="entry-row" data-test="flame-line">
      <select v-model="l.stat" class="form-select form-select-sm w-auto" aria-label="屬性" data-test="flame-stat">
        <option v-for="d in statsFor(l)" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <select v-model.number="l.tier" class="form-select form-select-sm w-auto" aria-label="階級" data-test="flame-tier">
        <option v-for="t in tiers" :key="t" :value="t">T{{ t }}</option>
      </select>
      <span class="line-value">{{ lineValue(l) }}</span>
      <button type="button" class="btn btn-sm btn-outline-danger ms-auto" aria-label="移除" @click="removeLine(i)">✕</button>
    </div>
    <button type="button" class="btn btn-sm btn-outline-primary mt-2" :disabled="!canAdd" data-test="flame-add"
      @click="addLine">
      ＋ 新增條目
    </button>
    <div v-if="notes.length" class="text-warning small mt-2" data-test="flame-notes">
      <div v-for="n in notes" :key="n">※ {{ n }}</div>
    </div>

    <div class="expect mt-3">
      <div class="expect-title">一次洗出「目前每一條，且階級 ≥ 設定」的機率</div>
      <div v-if="!probabilities.length" class="text-muted">新增條目後顯示各種星火的機率與期望用量（未指定的剩餘條目不限制）。</div>
      <table v-else class="table table-sm mb-0 prob-table">
        <thead>
          <tr>
            <th>星火</th>
            <th class="text-end">機率</th>
            <th class="text-end">期望用量</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in probabilities" :key="p.type.id" data-test="flame-prob">
            <td>{{ p.type.name }}</td>
            <td class="text-end">{{ formatPct(p.p) }}</td>
            <td class="text-end">{{ p.p > 0 ? `${formatNum(p.expected, 1)} 個` : '不可能' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
@use './tab-common';

.line-value {
  min-width: 4rem;
  font-variant-numeric: tabular-nums;
}

.prob-table {
  --bs-table-bg: transparent;
  font-variant-numeric: tabular-nums;
}
</style>

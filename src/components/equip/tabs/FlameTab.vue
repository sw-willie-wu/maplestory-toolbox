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
    <h3 class="eq-card__title">星火（追加屬性）</h3>
    <p class="fl-head" data-test="flame-header">
      <template v-if="equip.flameBoss">
        BOSS 裝備固定 4 條（強力／永遠 T1–T3、覺醒類 T3–T7）；只需填入在意的條目，其餘條目不限制。
      </template>
      <template v-else>一般裝備 1～4 條、T1–T5；只需填入在意的條目，其餘條目不限制。</template>
    </p>

    <ul v-if="state.flame.length" class="eq-list fl-lines">
      <li v-for="(l, i) in state.flame" :key="i" data-test="flame-line">
        <span class="fl-no">第 {{ i + 1 }} 條</span>
        <select v-model="l.stat" class="eq-control fl-stat" aria-label="屬性" data-test="flame-stat">
          <option v-for="d in statsFor(l)" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
        <select v-model.number="l.tier" class="eq-control fl-tier" aria-label="階級" data-test="flame-tier">
          <option v-for="t in tiers" :key="t" :value="t">T{{ t }}</option>
        </select>
        <b class="fl-value">{{ lineValue(l) }}</b>
        <button type="button" class="eq-link eq-link--danger fl-remove" :aria-label="`移除第 ${i + 1} 條`"
          @click="removeLine(i)">
          移除
        </button>
      </li>
    </ul>
    <button type="button" class="eq-btn eq-btn--ghost fl-add" :disabled="!canAdd" data-test="flame-add" @click="addLine">
      ＋ 新增條目
    </button>
    <div v-if="notes.length" class="eq-msg eq-msg--warn fl-notes" data-test="flame-notes">
      <div v-for="n in notes" :key="n">※ {{ n }}</div>
    </div>

    <h3 class="eq-card__title">一次洗出「上列每一條，且階級 ≥ 設定」的機率</h3>
    <p v-if="!probabilities.length" class="eq-msg">新增條目後顯示各種星火的機率與期望用量。</p>
    <table v-else class="fl-prob">
      <thead>
        <tr>
          <th>星火</th>
          <th>機率</th>
          <th>期望用量</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in probabilities" :key="p.type.id" data-test="flame-prob">
          <td>{{ p.type.name }}</td>
          <td><b>{{ formatPct(p.p) }}</b></td>
          <td>
            <b v-if="p.p > 0">{{ formatNum(p.expected, 1) }} 個</b>
            <span v-else class="fl-impossible">不可能</span>
          </td>
        </tr>
      </tbody>
    </table>

    <SourceNotice :kms="kms" />
  </div>
</template>

<style lang="scss" scoped>
$line: rgb(200, 206, 216);
$muted: #7a8597;

.fl-head {
  margin: 0 0 10px;
  font-size: 13px;
  color: $muted;
}

.fl-lines {
  margin-bottom: 10px;

  > li {
    flex-wrap: wrap;
  }
}

.fl-no {
  min-width: 3.5em;
  color: $muted;
  font-size: 13px;
}

.fl-stat {
  width: auto;
  min-width: 9em;
}

.fl-tier {
  width: 5em;
}

.fl-value {
  min-width: 4em;
  font-variant-numeric: tabular-nums;
  color: var(--color-navbar, rgb(40, 50, 65));
}

.fl-remove {
  margin-left: auto;
}

.fl-notes {
  margin-top: 8px;
}

.fl-prob {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;

  th {
    padding: 0 8px 6px 0;
    border-bottom: 1px solid $line;
    font-weight: 400;
    font-size: 13px;
    color: $muted;
    text-align: left;
  }

  td {
    padding: 6px 8px 6px 0;
    color: #333;
  }

  tr + tr td {
    border-top: 1px solid $line;
  }

  b {
    color: var(--color-navbar, rgb(40, 50, 65));
  }
}

.fl-impossible {
  color: $muted;
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { iconUrl } from '@/utils/mst/icon'
import type { EnhanceState, EnhanceTab, EquipBreakdown } from '@/utils/mst/enhance/equip'
import type { EquipData, JobGroup, SetInfo, StatKey, Stats } from '@/utils/mst/enhance/types'
import type { TooltipSummary } from './summary'

const props = withDefaults(
  defineProps<{
    equip: EquipData
    breakdown: EquipBreakdown
    state: EnhanceState
    summary: TooltipSummary
    locked: ReadonlySet<EnhanceTab>
    setInfo: SetInfo | null
    /** useEquipData().jobName(equip.specJob) */
    specJob?: { name: string; guess: boolean } | null
    /** Category labels shown next to the icon (e.g. 飾品 / 戒指). */
    tags?: string[]
    compact?: boolean
  }>(),
  { specJob: null, tags: () => [], compact: false }
)

/** Display order and labels (levelReduce is shown on the 要求等級 line instead). */
const STAT_LINES: { key: StatKey; label: string; pct?: boolean }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'int', label: 'INT' },
  { key: 'luk', label: 'LUK' },
  { key: 'maxHp', label: '最大HP' },
  { key: 'maxMp', label: '最大MP' },
  { key: 'att', label: '攻擊力' },
  { key: 'matt', label: '魔法攻擊力' },
  { key: 'def', label: '防禦力' },
  { key: 'speed', label: '移動速度' },
  { key: 'jump', label: '跳躍力' },
  { key: 'bossDamage', label: 'BOSS攻擊時傷害', pct: true },
  { key: 'ignoreDef', label: '無視怪物防禦率', pct: true },
  { key: 'damagePct', label: '總傷害', pct: true },
  { key: 'allStatPct', label: '全屬性', pct: true },
  { key: 'maxHpPct', label: '最大HP', pct: true },
  { key: 'maxMpPct', label: '最大MP', pct: true }
]

const JOB_NAMES: Record<JobGroup, string> = {
  warrior: '劍士',
  magician: '法師',
  bowman: '弓箭手',
  thief: '盜賊',
  pirate: '海盜'
}

/** Parts after the base, in tooltip order; class = colour (sf 星力 / sc 卷軸 / fl 星火 / ex 卓越). */
const PARTS = [
  { part: 'starforce', cls: 'sf' },
  { part: 'scroll', cls: 'sc' },
  { part: 'flame', cls: 'fl' },
  { part: 'exceptional', cls: 'ex' }
] as const

const signed = (n: number, pct = false) => `${n < 0 ? '-' : '+'}${Math.abs(n)}${pct ? '%' : ''}`
const val = (s: Stats, k: StatKey) => s[k] ?? 0

interface Line {
  key: StatKey
  label: string
  total: string
  base: string
  parts: { cls: string; text: string }[]
}

const lines = computed<Line[]>(() => {
  const b = props.breakdown
  const out: Line[] = []
  for (const { key, label, pct } of STAT_LINES) {
    const parts = PARTS.filter(({ part }) => part !== 'exceptional' || !b.exceptionalNoData)
      .map(({ part, cls }) => ({ cls, n: val(b[part], key) }))
      .filter((p) => p.n !== 0)
      .map(({ cls, n }) => ({ cls, text: signed(n, pct) }))
    const total = val(b.total, key)
    if (total === 0 && parts.length === 0 && val(b.base, key) === 0) continue
    out.push({ key, label, total: signed(total, pct), base: `${val(b.base, key)}${pct ? '%' : ''}`, parts })
  }
  return out
})

const levelReduce = computed(() => val(props.breakdown.total, 'levelReduce'))
const jobLabel = computed(() =>
  props.equip.jobs === 'all' ? '共用' : props.equip.jobs.map((j) => JOB_NAMES[j]).join('、')
)

/** Stars in rows of 15, groups of 5 (as in game). */
const starRows = computed(() => {
  const rows: boolean[][][] = []
  for (let r = 0; r < props.summary.maxStar; r += 15) {
    const groups: boolean[][] = []
    for (let g = r; g < Math.min(r + 15, props.summary.maxStar); g += 5) {
      const group: boolean[] = []
      for (let i = g; i < Math.min(g + 5, props.summary.maxStar); i++) group.push(i < props.summary.star)
      groups.push(group)
    }
    rows.push(groups)
  }
  return rows
})

// Icon: placeholder on error, or when the CDN answered with its empty image (unknown code → 308 → empty_img.png,
// which is 256×256; real item icons are ~30–40px).
const EMPTY_IMG_SIZE = 256
const iconFailed = ref(false)
watch(
  () => props.equip.id,
  () => (iconFailed.value = false)
)
function onIconLoad(e: Event) {
  const img = e.target as HTMLImageElement
  const w = img.naturalWidth
  const h = img.naturalHeight
  if ((w <= 1 && h <= 1) || (w === EMPTY_IMG_SIZE && h === EMPTY_IMG_SIZE)) iconFailed.value = true
}

const flameCount = computed(() => props.state.flame.length)
const potentials = computed(() =>
  [
    { title: '潛在能力', pick: props.state.potential },
    { title: '附加潛在能力', pick: props.state.additional }
  ].filter((p) => p.pick.grade !== null)
)
</script>

<template>
  <div class="equip-tooltip" :class="{ compact }">
    <template v-if="!compact">
      <div v-if="summary.maxStar > 0" class="stars" data-test="stars">
        <div v-for="(row, r) in starRows" :key="r" class="star-row">
          <span v-for="(group, g) in row" :key="g" class="star-group">
            <span v-for="(lit, i) in group" :key="i" class="star" :class="{ lit }">★</span>
          </span>
        </div>
      </div>
      <div class="equip-name">{{ equip.name }}</div>
      <div v-if="equip.tradeBlock" class="trade">無法交換</div>

      <div class="head">
        <div class="icon-box">
          <img v-if="!iconFailed" class="equip-icon" :src="iconUrl(equip.id)" :alt="equip.name" @error="iconFailed = true"
            @load="onIconLoad" />
          <span v-else class="icon-placeholder" data-test="icon-placeholder">?</span>
        </div>
        <div class="tags">
          <span v-for="t in tags" :key="t" class="tag">{{ t }}</span>
        </div>
      </div>

      <div class="req">
        <div><span class="req-label">裝備職業</span>{{ jobLabel }}</div>
        <div v-if="specJob" data-test="spec-job">
          <span class="req-label">限定職業</span>{{ specJob.name }}{{ specJob.guess ? '(推測)' : '' }}
        </div>
        <div>
          <span class="req-label">要求等級</span><span class="lv">Lv.{{ equip.level - levelReduce }}</span>
          <span v-if="levelReduce > 0" class="fl"> (-{{ levelReduce }})</span>
        </div>
      </div>

      <div class="divider"></div>
      <div class="stats">
        <div v-for="l in lines" :key="l.key" class="stat-line" data-test="stat-line">
          <span class="stat-label">{{ l.label }}</span><span class="stat-total">{{ l.total }}</span>
          <span v-if="l.parts.length" class="stat-parts">
            ({{ l.base }}<template v-for="(p, i) in l.parts" :key="i">{{ ' ' }}<span :class="p.cls">{{ p.text }}</span></template>)
          </span>
        </div>
      </div>
      <div v-if="breakdown.starforceUnsourced" class="note">※ 此星數的攻擊力星力加成無資料，數值可能偏低</div>
      <div v-if="setInfo" class="set" data-test="set">套裝：{{ setInfo.name }}（{{ setInfo.completeCount }}件）</div>

      <div class="divider"></div>
      <div class="summary">
        <div data-test="summary-star">
          <span class="sum-icon sf">★</span>星力：
          <template v-if="locked.has('starforce')">無法強化</template>
          <template v-else>{{ summary.star }}星（最多{{ summary.maxStar }}星）</template>
        </div>
        <div data-test="summary-scroll">
          <span class="sum-icon sc">✎</span>卷軸：
          <template v-if="locked.has('scroll')">無法強化</template>
          <template v-else>
            {{ summary.scroll.used }}次（剩餘{{ summary.scroll.remaining }}次，可恢復{{ summary.scroll.recoverable }}次）
          </template>
        </div>
        <div data-test="summary-hammer">
          <template v-if="locked.has('hammer')"><span class="sum-icon">⚒</span>鐵鎚：無法強化</template>
          <div v-for="h in summary.hammer" v-else :key="h.id">
            <span class="sum-icon">⚒</span>{{ h.name }}：{{ h.used }}/{{ h.max }}
          </div>
        </div>
        <div data-test="summary-flame" :class="{ dim: summary.flameLocked }">
          <span class="sum-icon fl">✦</span>追加屬性：
          <template v-if="summary.flameLocked">無法強化</template>
          <template v-else>{{ flameCount > 0 ? `${flameCount}條` : '無' }}</template>
        </div>
        <div v-if="!locked.has('exceptional')" data-test="summary-exceptional">
          <span class="sum-icon ex">◆</span>卓越強化：{{ state.exceptional }}/{{ equip.exceptionalMax }}
          <span v-if="breakdown.exceptionalNoData" class="note">（無資料）</span>
        </div>
      </div>

      <template v-for="p in potentials" :key="p.title">
        <div class="divider"></div>
        <div class="potential">
          <div class="potential-title">{{ p.title }}：{{ p.pick.grade }}</div>
          <div v-for="(line, i) in p.pick.lines.filter((x) => x !== null)" :key="i">・{{ line }}</div>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="compact-head">
        <div class="icon-box small">
          <img v-if="!iconFailed" class="equip-icon" :src="iconUrl(equip.id)" :alt="equip.name" @error="iconFailed = true"
            @load="onIconLoad" />
          <span v-else class="icon-placeholder" data-test="icon-placeholder">?</span>
        </div>
        <div>
          <div class="equip-name">{{ equip.name }}</div>
          <div v-if="summary.maxStar > 0" class="sf">★ {{ summary.star }}/{{ summary.maxStar }}</div>
        </div>
      </div>
      <div class="compact-stats">
        <span v-for="l in lines" :key="l.key" class="compact-stat" data-test="stat-line">
          <span class="stat-label">{{ l.label }}</span>{{ l.total }}
        </span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.equip-tooltip {
  --tt-bg: rgba(22, 24, 32, 0.96);
  --tt-border: #6b6f7d;
  --tt-text: #ffffff;
  --tt-dim: #9aa0aa;
  --tt-sf: #ffcc33;
  --tt-sc: #a8a8ff;
  --tt-fl: #ccff00;
  --tt-ex: #ff8866;

  width: 300px;
  padding: 10px 12px;
  background: var(--tt-bg);
  border: 1px solid var(--tt-border);
  border-radius: 6px;
  color: var(--tt-text);
  font-size: 12px;
  line-height: 1.55;

  &.compact {
    width: 100%;
    padding: 6px 10px;
  }
}

.sf {
  color: var(--tt-sf);
}

.sc {
  color: var(--tt-sc);
}

.fl {
  color: var(--tt-fl);
}

.ex {
  color: var(--tt-ex);
}

.stars {
  text-align: center;
  margin-bottom: 4px;

  .star-row {
    line-height: 1.1;
  }

  .star-group {
    margin: 0 3px;
  }

  .star {
    color: #4a4d57;
    font-size: 11px;

    &.lit {
      color: var(--tt-sf);
    }
  }
}

.equip-name {
  text-align: center;
  font-size: 15px;
  font-weight: bold;
}

.trade {
  text-align: center;
  color: #ff9933;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 8px 0 6px;

  .tags {
    display: flex;
    gap: 4px;
  }

  .tag {
    padding: 0 6px;
    border-radius: 3px;
    background: #3c3f4a;
    color: #d8dbe2;
  }
}

.icon-box {
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(#e9eaee, #b7bac3);
  border-radius: 6px;

  &.small {
    width: 40px;
    height: 40px;
    flex: none;

    .equip-icon {
      width: 32px;
      height: 32px;
    }
  }

  .equip-icon {
    width: 64px;
    height: 64px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .icon-placeholder {
    color: #6b6f7d;
    font-size: 28px;
    font-weight: bold;
  }
}

.req {
  .req-label {
    display: inline-block;
    width: 64px;
    color: var(--tt-dim);
  }

  .lv {
    color: var(--tt-sf);
  }
}

.divider {
  border-top: 1px dashed #4a4d57;
  margin: 6px 0;
}

.stat-line {
  .stat-label {
    display: inline-block;
    min-width: 72px;
  }

  .stat-parts {
    margin-left: 4px;
  }
}

.note {
  color: var(--tt-dim);
  font-size: 11px;
}

.set {
  margin-top: 4px;
  color: var(--tt-fl);
}

.summary {
  .sum-icon {
    display: inline-block;
    width: 16px;
  }

  .dim {
    color: var(--tt-dim);
  }
}

.potential-title {
  color: var(--tt-fl);
}

.compact-head {
  display: flex;
  align-items: center;
  gap: 8px;

  .equip-name {
    text-align: left;
    font-size: 13px;
  }
}

.compact-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 4px;

  .stat-label {
    color: var(--tt-dim);
    margin-right: 2px;
  }
}
</style>

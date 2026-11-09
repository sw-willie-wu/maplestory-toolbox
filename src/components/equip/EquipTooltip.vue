<script setup lang="ts">
import { computed } from 'vue'
import ItemIcon from './ItemIcon.vue'
import type { EnhanceState, EnhanceTab, EquipBreakdown } from '@/utils/mst/enhance/equip'
import type { EquipData, JobGroup, StatKey, Stats } from '@/utils/mst/enhance/types'
import type { TooltipSummary } from './summary'

const props = withDefaults(
  defineProps<{
    /** Optional only for `placeholder` (no equip selected yet). */
    equip?: EquipData | null
    breakdown?: EquipBreakdown | null
    state?: EnhanceState | null
    summary?: TooltipSummary | null
    locked?: ReadonlySet<EnhanceTab>
    /** useEquipData().jobName(equip.specJob) */
    specJob?: { name: string; guess: boolean } | null
    /** Category labels shown next to the icon: [大分類, 細分類] (e.g. 飾品 / 戒指). */
    tags?: string[]
    compact?: boolean
    /** Empty tooltip shown before an equip is selected. */
    placeholder?: boolean
  }>(),
  {
    equip: null,
    breakdown: null,
    state: null,
    summary: null,
    locked: () => new Set<EnhanceTab>(),
    specJob: null,
    tags: () => [],
    compact: false,
    placeholder: false
  }
)

/** Everything needed to render a real equip; null → placeholder (no equip selected yet). Keep the template's root
 * a single v-if/v-else element (no root comment) so attrs/classes fall through. */
const d = computed(() => {
  const { equip, breakdown, state, summary } = props
  if (props.placeholder || !equip || !breakdown || !state || !summary) return null
  return { equip, breakdown, state, summary }
})

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

/** Grade badge letter as in game (特殊 R / 稀有 E / 罕見 U / 傳說 L). */
const GRADE_BADGE: Record<string, string> = { 特殊: 'R', 稀有: 'E', 罕見: 'U', 傳說: 'L' }

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
  const b = d.value?.breakdown
  if (!b) return []
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

const levelReduce = computed(() => (d.value ? val(d.value.breakdown.total, 'levelReduce') : 0))
const jobLabel = computed(() => {
  const jobs = d.value?.equip.jobs
  if (!jobs) return ''
  return jobs === 'all' ? '共用' : jobs.map((j) => JOB_NAMES[j]).join('、')
})

/** Stars in rows of 15, groups of 5 (as in game). */
const starRows = computed(() => {
  const rows: boolean[][][] = []
  if (!d.value) return rows
  const { star, maxStar } = d.value.summary
  for (let r = 0; r < maxStar; r += 15) {
    const groups: boolean[][] = []
    for (let g = r; g < Math.min(r + 15, maxStar); g += 5) {
      const group: boolean[] = []
      for (let i = g; i < Math.min(g + 5, maxStar); i++) group.push(i < star)
      groups.push(group)
    }
    rows.push(groups)
  }
  return rows
})

const flameCount = computed(() => d.value?.state.flame.length ?? 0)
const potentials = computed(() => {
  const s = d.value?.state
  if (!s) return []
  return [
    { title: '潛在能力', pick: s.potential },
    { title: '附加潛在能力', pick: s.additional }
  ]
    .filter((p) => p.pick.grade !== null)
    .map((p) => ({
      title: p.title,
      grade: p.pick.grade as string,
      badge: GRADE_BADGE[p.pick.grade as string] ?? '',
      lines: p.pick.lines.filter((x): x is string => x !== null)
    }))
})
</script>

<template>
  <div v-if="!d" class="equip-tooltip placeholder" :class="{ compact }" data-test="tooltip-placeholder">
    <div class="top">
      <div class="icon-frame" data-test="tt-icon"><ItemIcon :item-id="null" :size="compact ? 30 : 52" /></div>
      <div class="ph-text">請選擇裝備</div>
    </div>
  </div>

  <div v-else class="equip-tooltip" :class="{ compact }">
    <template v-if="!compact">
      <div v-if="d.summary.maxStar > 0" class="stars" data-test="stars">
        <div v-for="(row, r) in starRows" :key="r" class="star-row">
          <span v-for="(group, g) in row" :key="g" class="star-group"><span v-for="(lit, i) in group" :key="i"
              class="star" :class="{ lit }">★</span></span>
        </div>
      </div>
      <div class="equip-name">{{ d.equip.name }}</div>
      <div v-if="d.equip.tradeBlock" class="trade">無法交換</div>

      <div class="top">
        <div class="icon-frame" data-test="tt-icon"><ItemIcon :item-id="d.equip.id" :size="52" /></div>
        <div class="cp" data-test="combat-power">
          <div class="cp-title">戰鬥力提升量</div>
          <div class="cp-value">+ 0</div>
          <div class="tags">
            <span v-for="(t, i) in tags" :key="i" class="tag">{{ t }}</span>
          </div>
        </div>
      </div>

      <div class="meta" data-test="meta">
        <span class="meta-label">裝備職業</span><span>{{ jobLabel }}</span>
        <template v-if="specJob">
          <span class="meta-label">限定職業</span><span data-test="spec-job">{{ specJob.name }}{{ specJob.guess ? '(推測)' : ''
          }}</span>
        </template>
        <span class="meta-label">要求等級</span>
        <span><span class="sf">Lv.{{ d.equip.level - levelReduce }}</span><span v-if="levelReduce > 0" class="fl">
            (-{{ levelReduce }})</span></span>
      </div>

      <div class="stats">
        <div v-for="l in lines" :key="l.key" class="stat-line" data-test="stat-line"><span class="stat-label">{{ l.label
          }}</span><span class="stat-val"><span class="stat-total">{{ l.total }}</span><template v-if="l.parts.length">
              ({{ l.base }}<template v-for="(p, i) in l.parts" :key="i">{{ ' ' }}<span :class="p.cls">{{ p.text
                }}</span></template>)</template></span></div>
      </div>
      <div v-if="d.breakdown.starforceUnsourced" class="note">※ 此星數的攻擊力星力加成無資料，數值可能偏低</div>

      <div class="dash"></div>
      <div class="status">
        <div data-test="summary-flame">追加屬性 <span v-if="d.summary.flameLocked" class="dim">無法強化</span><template
            v-else>{{ flameCount > 0 ? `${flameCount}條` : '無' }}</template></div>
        <div data-test="summary-scroll">卷軸 <span v-if="locked.has('scroll')" class="dim">無法強化</span><template
            v-else>強化 {{ d.summary.scroll.used }}次（剩餘{{ d.summary.scroll.remaining }}次，可恢復{{
              d.summary.scroll.recoverable }}次）</template></div>
        <div v-if="locked.has('hammer') || d.summary.hammer.length" data-test="summary-hammer">
          <template v-if="locked.has('hammer')">鐵鎚 <span class="dim">無法強化</span></template>
          <div v-for="h in d.summary.hammer" v-else :key="h.id">{{ h.label }} {{ h.used }}/{{ h.max }}</div>
        </div>
        <div v-if="!locked.has('exceptional')" data-test="summary-exceptional">
          卓越強化 {{ d.state.exceptional }}/{{ d.equip.exceptionalMax }}<span v-if="d.breakdown.exceptionalNoData"
            class="dim">（無資料）</span>
        </div>
      </div>

      <template v-for="p in potentials" :key="p.title">
        <div class="dash"></div>
        <div class="potential" :class="p.badge" data-test="potential">
          <span class="badge" :class="p.badge">{{ p.badge }}</span><span class="potential-title">{{ p.title }}：{{
            p.grade }}</span>
          <ul>
            <li v-for="(line, i) in p.lines" :key="i">{{ line }}</li>
          </ul>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="compact-head">
        <div class="icon-frame small" data-test="tt-icon"><ItemIcon :item-id="d.equip.id" :size="30" /></div>
        <div>
          <div class="equip-name">{{ d.equip.name }}</div>
          <div v-if="d.summary.maxStar > 0" class="star-count" data-test="compact-stars">
            <span class="sf">★</span> {{ d.summary.star }}/{{ d.summary.maxStar }}
          </div>
        </div>
      </div>
      <div class="compact-stats">
        <span v-for="l in lines" :key="l.key" class="compact-stat" data-test="stat-line"><span class="stat-label">{{
          l.label }}</span>{{ l.total }}</span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
// New in-game tooltip look (spec §6, mockup layout-v22 `.tt`).
.equip-tooltip {
  --tt-bg: rgba(36, 44, 58, 0.92);
  --tt-text: #ffffff;
  --tt-dim: #9aa3b0;
  --tt-label: #c8cdd5;
  --tt-sf: #ffcc00;
  --tt-sc: #66ccff;
  --tt-fl: #ccff00;
  --tt-ex: #ff8866;

  box-sizing: border-box;
  width: 320px;
  padding: 8px 10px 10px;
  background: var(--tt-bg);
  border: 1px solid rgba(190, 205, 225, 0.55);
  outline: 1px solid rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  color: var(--tt-text);
  font-size: 13px;
  line-height: 1.45;

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

.dim {
  color: var(--tt-dim);
}

.stars {
  text-align: center;
  font-size: 11px;
  line-height: 13px;

  .star-group {
    margin: 0 6px;
  }

  .star {
    color: #6b7280;

    &.lit {
      color: #ffcc11;
    }
  }
}

.equip-name {
  margin-top: 5px;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.trade {
  text-align: center;
  font-size: 12px;
  color: #ff9c27;
}

.top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 6px;
}

.icon-frame {
  box-sizing: border-box;
  width: 78px;
  height: 78px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #c9cfd8;
  border-radius: 6px;
  background: linear-gradient(160deg, #d9dde3, #8f96a1);

  // scale the ~32px game icon up to the ItemIcon box (52px), pixel-crisp as in the mockup
  :deep(img) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  &.small {
    width: 40px;
    height: 40px;
  }
}

.cp {
  flex: 1;
  text-align: right;

  .cp-title {
    font-size: 12px;
    color: var(--tt-dim);
  }

  .cp-value {
    margin-top: 2px;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
  }

  .tags {
    margin-top: 6px;
  }

  .tag {
    display: inline-block;
    margin-left: 4px;
    padding: 1px 8px;
    border-radius: 9px;
    background: rgba(150, 160, 175, 0.35);
    color: #e6e9ee;
    font-size: 12px;
  }
}

.meta {
  display: grid;
  grid-template-columns: 4.5em 1fr;
  row-gap: 1px;
  margin: 6px 0 2px;
  font-size: 12px;

  .meta-label {
    color: var(--tt-label);
  }
}

.stats {
  font-family: Consolas, 'MingLiU', monospace;
  font-size: 12.5px;
}

.stat-line {
  display: grid;
  grid-template-columns: minmax(5.6em, max-content) 1fr;
  column-gap: 4px;
  line-height: 17px;
}

.dash {
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  margin: 6px 0;
}

.note {
  color: var(--tt-dim);
  font-size: 11px;
}


.status {
  font-size: 12px;
  line-height: 17px;
}

.potential {
  font-size: 12.5px;
  line-height: 18px;

  .badge {
    display: inline-flex;
    width: 14px;
    height: 14px;
    margin-right: 4px;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    vertical-align: -1px;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
  }

  &.R {
    .badge {
      background: #3d8fd1;
    }

    .potential-title {
      color: #66ccff;
    }
  }

  &.E {
    .badge {
      background: #9b59d0;
    }

    .potential-title {
      color: #d39bff;
    }
  }

  &.U {
    .badge {
      background: #d4a017;
    }

    .potential-title {
      color: #ffcc33;
    }
  }

  &.L {
    .badge {
      background: #3cbf3c;
    }

    .potential-title {
      color: #7dff5a;
    }
  }

  ul {
    margin: 0;
    padding: 0;
  }

  li {
    list-style: none;
    padding-left: 4px;

    &::before {
      content: '■';
      margin-right: 6px;
      font-size: 8px;
      vertical-align: 2px;
      color: #fff;
    }
  }
}

.placeholder {
  .top {
    align-items: center;
    margin-top: 0;
  }

  .ph-text {
    flex: 1;
    text-align: center;
    color: var(--tt-dim);
    font-size: 14px;
  }

  &.compact .icon-frame {
    width: 40px;
    height: 40px;
  }
}

.compact-head {
  display: flex;
  align-items: center;
  gap: 8px;

  .equip-name {
    margin-top: 0;
    text-align: left;
    font-size: 13px;
  }

  .star-count {
    font-size: 12px;
  }
}

.compact-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 4px;
  font-family: Consolas, 'MingLiU', monospace;
  font-size: 12px;

  .stat-label {
    margin-right: 2px;
    color: var(--tt-dim);
  }
}
</style>

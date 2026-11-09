<script setup lang="ts">
import { computed, ref } from 'vue'
import { lockedTabs, type EnhanceState, type EnhanceTab } from '@/utils/mst/enhance/equip'
import type { PotentialOption } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'
import StarforceTab from './tabs/StarforceTab.vue'
import ScrollTab from './tabs/ScrollTab.vue'
import HammerTab from './tabs/HammerTab.vue'
import FlameTab from './tabs/FlameTab.vue'
import ExceptionalTab from './tabs/ExceptionalTab.vue'
import PotentialTab from './tabs/PotentialTab.vue'
import ReverseTab from './tabs/ReverseTab.vue'

const props = withDefaults(
  defineProps<{
    equip: EquipData
    /** lockedTabs(equip) when omitted. */
    locked?: ReadonlySet<EnhanceTab>
    /** POTENTIAL.buildOptions(potential-options.json); null while loading. */
    potentialOptions?: PotentialOption[] | null
  }>(),
  { locked: undefined, potentialOptions: null }
)
/** The page's EnhanceState; tabs edit its fields in place (the page recomputes the tooltip from it). */
const state = defineModel<EnhanceState>('state', { required: true })

type TabId = EnhanceTab | 'potential' | 'reverse'

const locks = computed<ReadonlySet<EnhanceTab>>(() => props.locked ?? lockedTabs(props.equip))

function lockReason(id: EnhanceTab): string {
  const e = props.equip
  switch (id) {
    case 'starforce':
      return e.canStarforce && e.superior ? '精銳（superior）裝備不支援星力計算' : '此裝備無法強化星力'
    case 'scroll':
      return '此裝備沒有可上卷次數'
    case 'hammer':
      return e.tuc <= 0 ? '此裝備沒有可上卷次數，無法使用鐵鎚' : '此裝備無法使用鐵鎚'
    case 'flame':
      return '此裝備無法附加追加屬性'
    case 'exceptional':
      return '此裝備無法卓越強化'
  }
}

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: 'starforce', label: '星力' },
  { id: 'scroll', label: '卷軸' },
  { id: 'hammer', label: '鐵鎚' },
  { id: 'flame', label: '追加屬性' },
  { id: 'exceptional', label: '卓越強化' },
  { id: 'potential', label: '潛能' },
  { id: 'reverse', label: '反算' }
]

const isLockable = (id: TabId): id is EnhanceTab => id !== 'potential' && id !== 'reverse'

const tabs = computed(() =>
  ALL_TABS
    // The exceptional tab only exists for items that can be enhanced (and when rules exist).
    .filter((t) => t.id !== 'exceptional' || !locks.value.has('exceptional'))
    .map((t) => {
      const locked = isLockable(t.id) && locks.value.has(t.id)
      return { ...t, locked, reason: locked && isLockable(t.id) ? lockReason(t.id) : '' }
    })
)

const lockedList = computed(() => tabs.value.filter((t) => t.locked))
const active = ref<TabId>(tabs.value.find((t) => !t.locked)?.id ?? 'potential')
</script>

<template>
  <div class="enhance-editor card">
    <ul class="nav nav-tabs editor-tabs" role="tablist">
      <li v-for="t in tabs" :key="t.id" class="nav-item" role="presentation">
        <button type="button" class="nav-link" :class="{ active: active === t.id }" role="tab"
          :aria-selected="active === t.id" :disabled="t.locked" :title="t.reason || undefined"
          :data-test="`tab-${t.id}`" @click="active = t.id">
          {{ t.label }}
        </button>
      </li>
    </ul>
    <div class="card-content editor-body">
      <div v-if="lockedList.length" class="locked-note text-muted" data-test="locked-note">
        <span v-for="t in lockedList" :key="t.id" class="me-3">{{ t.label }}：{{ t.reason }}</span>
      </div>
      <StarforceTab v-if="active === 'starforce'" v-model:state="state" :equip="equip" data-test="panel-starforce" />
      <ScrollTab v-else-if="active === 'scroll'" v-model:state="state" :equip="equip" data-test="panel-scroll" />
      <HammerTab v-else-if="active === 'hammer'" v-model:state="state" :equip="equip" data-test="panel-hammer" />
      <FlameTab v-else-if="active === 'flame'" v-model:state="state" :equip="equip" data-test="panel-flame" />
      <ExceptionalTab v-else-if="active === 'exceptional'" v-model:state="state" :equip="equip"
        data-test="panel-exceptional" />
      <PotentialTab v-else-if="active === 'potential'" v-model:state="state" :equip="equip" :options="potentialOptions"
        data-test="panel-potential" />
      <ReverseTab v-else-if="active === 'reverse'" v-model:state="state" :equip="equip" :locked="locks"
        data-test="panel-reverse" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-tabs {
  padding: 0.5rem 0.5rem 0;

  .nav-link {
    white-space: nowrap;
    padding: 0.4rem 0.8rem;

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}

.editor-body {
  font-size: 0.9rem;
}

.locked-note {
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
}
</style>

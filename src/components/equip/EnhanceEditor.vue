<script setup lang="ts">
import { computed } from 'vue'
import { lockedTabs, type EnhanceState } from '@/utils/mst/enhance/equip'
import type { PotentialOption } from '@/utils/mst/enhance/rules/potential'
import type { EquipData } from '@/utils/mst/enhance/types'
import type { EnhancePanelId } from './panels'
import StarforceTab from './tabs/StarforceTab.vue'
import ScrollTab from './tabs/ScrollTab.vue'
import HammerTab from './tabs/HammerTab.vue'
import FlameTab from './tabs/FlameTab.vue'
import ExceptionalTab from './tabs/ExceptionalTab.vue'
import PotentialTab from './tabs/PotentialTab.vue'
import ReverseTab from './tabs/ReverseTab.vue'
import './ui/equip-ui.scss'

const props = defineProps<{
  equip: EquipData
  /** Panel chosen in the page's sidebar (the page never passes a locked one). */
  active: EnhancePanelId
  /** POTENTIAL.buildOptions(potential-options.json); null while loading or after a failure. */
  potentialOptions: PotentialOption[] | null
  /** Message of the last potential-options load failure; null when none. */
  potentialError: string | null
}>()
defineEmits<{ retryPotential: [] }>()
defineSlots<{ note?: () => unknown }>()

/** The page's EnhanceState; panels edit its fields in place (the page recomputes the tooltip from it). */
const state = defineModel<EnhanceState>('state', { required: true })

const locks = computed(() => lockedTabs(props.equip))
</script>

<template>
  <div class="enhance-editor eq-card">
    <div class="editor-body">
      <!-- KeepAlive: panel-local inputs survive switching panels; the page re-keys the editor on every selection. -->
      <KeepAlive>
        <StarforceTab v-if="active === 'starforce'" key="starforce" v-model:state="state" :equip="equip"
          data-test="panel-starforce" />
        <ScrollTab v-else-if="active === 'scroll'" key="scroll" v-model:state="state" :equip="equip"
          data-test="panel-scroll" />
        <HammerTab v-else-if="active === 'hammer'" key="hammer" v-model:state="state" :equip="equip"
          data-test="panel-hammer" />
        <FlameTab v-else-if="active === 'flame'" key="flame" v-model:state="state" :equip="equip"
          data-test="panel-flame" />
        <ExceptionalTab v-else-if="active === 'exceptional'" key="exceptional" v-model:state="state" :equip="equip"
          data-test="panel-exceptional" />
        <PotentialTab v-else-if="active === 'potential'" key="potential" v-model:state="state" :equip="equip"
          kind="potential" :options="potentialOptions" :error="potentialError" data-test="panel-potential"
          @retry="$emit('retryPotential')" />
        <PotentialTab v-else-if="active === 'bonusPotential'" key="bonusPotential" v-model:state="state"
          :equip="equip" kind="bonusPotential" :options="potentialOptions" :error="potentialError"
          data-test="panel-bonusPotential" @retry="$emit('retryPotential')" />
        <ReverseTab v-else-if="active === 'reverse'" key="reverse" v-model:state="state" :equip="equip"
          :locked="locks" data-test="panel-reverse" />
      </KeepAlive>
    </div>
    <div v-if="$slots.note" class="editor-note">
      <slot name="note" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.enhance-editor {
  display: flex;
  flex-direction: column;
}

.editor-body {
  font-size: 0.9rem;
}

// data version / notes pinned to the bottom of the (stretched) main card
.editor-note {
  margin-top: auto;
  padding-top: 14px;
  font-size: 12px;
  color: #7a8597;
}
</style>

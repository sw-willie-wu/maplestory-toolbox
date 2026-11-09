<script setup lang="ts">
import type { EquipData } from '@/utils/mst/enhance/types'
import ItemIcon from './ItemIcon.vue'
import LineIcon from './ui/LineIcon.vue'
import { PANELS, type PanelId } from './panels'

/**
 * `part` (default 'all') = the vertical sidebar (≥ 992px). Below 992px the page renders the two halves apart:
 * 'equip' = only the 目前裝備 cell (own full-width block), 'tabs' = only the 8 panels as a horizontal tab row.
 */
const props = withDefaults(
  defineProps<{
    equip: EquipData | null
    active: PanelId
    locked: ReadonlyMap<PanelId, string>
    part?: 'all' | 'equip' | 'tabs'
  }>(),
  { part: 'all' }
)
const emit = defineEmits<{ select: [p: PanelId] }>()

// Locked items use aria-disabled (not `disabled`) so the hover title with the reason still shows.
function onClick(id: PanelId) {
  if (!props.locked.has(id)) emit('select', id)
}
</script>

<template>
  <component
    :is="part === 'equip' ? 'div' : 'nav'"
    class="eq-side"
    :class="`eq-side--${part}`"
    :aria-label="part === 'equip' ? undefined : '強化選單'"
  >
    <button
      v-if="part !== 'tabs'"
      type="button"
      class="eq-side__btn eq-side__equip"
      :class="{ on: active === 'picker' }"
      :aria-current="active === 'picker' ? 'true' : undefined"
      data-test="side-picker"
      @click="onClick('picker')"
    >
      <ItemIcon class="eq-side__equip-icon" :item-id="equip?.id ?? null" :size="34" />
      <span class="eq-side__equip-text">
        <span class="eq-side__equip-name">{{ equip?.name ?? '請選擇裝備' }}</span>
        <small>選擇裝備</small>
      </span>
    </button>
    <div v-if="part === 'all'" class="eq-side__sep" role="separator"></div>
    <template v-if="part !== 'equip'">
      <button
        v-for="p in PANELS"
        :key="p.id"
        type="button"
        class="eq-side__btn"
        :class="{ on: active === p.id, off: locked.has(p.id) }"
        :aria-current="active === p.id ? 'true' : undefined"
        :aria-disabled="locked.has(p.id) ? 'true' : undefined"
        :title="locked.get(p.id)"
        :data-test="`side-${p.id}`"
        @click="onClick(p.id)"
      >
        <LineIcon :name="p.icon" />{{ p.label }}
      </button>
    </template>
  </component>
</template>

<style lang="scss" scoped>
// Values from mockup layout-v22 (.side / .btn / .eq / .sp / .li).
.eq-side {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.eq-side__btn {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 0;
  background: var(--color-card, rgb(249, 251, 255));
  color: var(--color-navbar, rgb(40, 50, 65));
  font: inherit;
  font-size: 15px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;

  :deep(.eq-line-icon) {
    flex: none;
    width: 22px;
    height: 22px;
    color: #4a5566;
  }

  &:hover:not(.on):not(.off) {
    background: #eef2f8;
  }

  &:focus-visible {
    outline: 2px solid rgb(44, 174, 186);
    outline-offset: -2px;
  }

  &.on {
    background: var(--color-navbar, rgb(40, 50, 65));
    color: #fff;

    :deep(.eq-line-icon) {
      color: #fff;
    }
  }

  &.off {
    color: #a3abb8;
    cursor: not-allowed;

    :deep(.eq-line-icon) {
      color: #c0c6d0;
    }
  }
}

.eq-side__equip {
  height: 58px;
  gap: 10px;

  .eq-side__equip-icon {
    background: #fff;
    border: 1px solid rgb(200, 206, 216);
    padding: 2px;
  }
}

.eq-side__equip-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.eq-side__equip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.eq-side__equip small {
  font-size: 12px;
  color: #7a8597;
}

.eq-side__equip.on small {
  color: #c3ccd8;
}

.eq-side__sep {
  flex: none;
  height: 1px;
  margin: 2px 0;
  background: rgba(40, 50, 65, 0.3);
}

// part="equip" (< 992px): the 目前裝備 cell as its own full-width block
.eq-side--equip .eq-side__equip {
  width: 100%;
}

// part="tabs" (< 992px): horizontal tab row above the editor; never wraps, scrolls inside itself
.eq-side--tabs {
  flex-direction: row;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: thin;

  .eq-side__btn {
    gap: 6px;
    height: 40px;
    padding: 0 12px;
    font-size: 14px;

    :deep(.eq-line-icon) {
      width: 18px;
      height: 18px;
    }
  }
}
</style>

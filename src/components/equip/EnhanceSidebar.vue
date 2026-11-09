<script setup lang="ts">
import type { EquipData } from '@/utils/mst/enhance/types'
import ItemIcon from './ItemIcon.vue'
import LineIcon from './ui/LineIcon.vue'
import { PANELS, type PanelId } from './panels'

const props = defineProps<{ equip: EquipData | null; active: PanelId; locked: ReadonlyMap<PanelId, string> }>()
const emit = defineEmits<{ select: [p: PanelId] }>()

// Locked items use aria-disabled (not `disabled`) so the hover title with the reason still shows.
function onClick(id: PanelId) {
  if (!props.locked.has(id)) emit('select', id)
}
</script>

<template>
  <nav class="eq-side" aria-label="強化選單">
    <button
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
    <div class="eq-side__sep" role="separator"></div>
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
  </nav>
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

// < 992px: horizontal scrolling menu row
@media (max-width: 991.98px) {
  .eq-side {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }

  .eq-side__btn {
    gap: 8px;
  }

  .eq-side__equip {
    height: 44px;
    max-width: 220px;
  }

  .eq-side__sep {
    width: 1px;
    height: auto;
    margin: 0 2px;
  }
}
</style>

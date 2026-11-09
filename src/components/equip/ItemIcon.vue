<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { iconUrl } from '@/utils/mst/icon'

const props = withDefaults(defineProps<{ itemId: number | null; size?: number }>(), { size: 26 })

// Placeholder when there is no id, the load fails, or the CDN answers without a real icon: unknown codes redirect to
// its 256×256 empty_img.png, and some ids get HTTP 204 (zero-size image). Real item icons are ~30–40px.
const EMPTY_IMG_SIZE = 256
const failed = ref(false)
watch(
  () => props.itemId,
  () => (failed.value = false)
)

const src = computed(() => {
  if (props.itemId === null) return null
  try {
    return iconUrl(props.itemId)
  } catch {
    return null
  }
})

function onLoad(e: Event) {
  const img = e.target as HTMLImageElement
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w <= 1 || h <= 1 || (w === EMPTY_IMG_SIZE && h === EMPTY_IMG_SIZE)) failed.value = true
}

const box = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
</script>

<template>
  <span class="eq-item-icon" :style="box">
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" @load="onLoad" @error="failed = true" />
    <span v-else class="eq-item-icon__ph" data-test="icon-placeholder" aria-hidden="true"></span>
  </span>
</template>

<style lang="scss" scoped>
.eq-item-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.eq-item-icon__ph {
  width: 70%;
  height: 70%;
  border: 1px dashed #b5bcc8;
  background: #eef1f5;
}
</style>

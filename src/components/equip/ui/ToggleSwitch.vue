<script setup lang="ts">
import './equip-ui.scss'

const props = withDefaults(defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>(), {
  disabled: false
})
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function toggle(): void {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    class="eq-toggle"
    :class="{ 'is-on': modelValue }"
    :aria-checked="modelValue ? 'true' : 'false'"
    :disabled="disabled"
    @click="toggle"
  >
    <span class="eq-toggle__track" aria-hidden="true"></span>
    <span class="eq-toggle__label">{{ label }}</span>
  </button>
</template>

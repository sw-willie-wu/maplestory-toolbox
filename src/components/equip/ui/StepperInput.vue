<script setup lang="ts" generic="T extends number | null">
import { computed, ref, watch } from 'vue'
import './equip-ui.scss'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: T
    min: number
    max?: number
    step?: number
    suffix?: string
    ariaLabel: string
    nullable?: boolean
  }>(),
  { max: Infinity, step: 1, suffix: undefined, nullable: false }
)

// Emits T so that a non-nullable usage (`ref<number>`) type-checks with v-model.
// When `nullable` is false the component only ever emits numbers.
const emit = defineEmits<{ (e: 'update:modelValue', n: T): void }>()

function fmt(v: number | null): string {
  return v === null || v === undefined ? '' : String(v)
}

const text = ref(fmt(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    text.value = fmt(v)
  }
)

function clamp(n: number): number {
  return Math.min(props.max, Math.max(props.min, Math.round(n)))
}

function normalize(raw: string): number | null {
  const trimmed = raw.trim()
  const n = trimmed === '' ? NaN : Number(trimmed)
  if (!Number.isFinite(n)) return props.nullable ? null : props.min
  return clamp(n)
}

function set(v: number | null): void {
  text.value = fmt(v)
  emit('update:modelValue', v as T)
}

function commit(): void {
  set(normalize(text.value))
}

function stepBy(dir: 1 | -1): void {
  const cur = props.modelValue
  set(cur === null ? props.min : clamp(cur + dir * props.step))
}

const inputWidth = computed(() => `${Math.max(text.value.length, 1) + 1}ch`)
</script>

<template>
  <div class="eq-stepper">
    <button type="button" class="eq-stepper__btn" :aria-label="`${ariaLabel} 減少`" @click="stepBy(-1)">−</button>
    <label class="eq-stepper__field">
      <input
        v-bind="$attrs"
        v-model="text"
        class="eq-stepper__input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :aria-label="ariaLabel"
        :style="{ width: inputWidth }"
        @blur="commit"
        @keydown.enter.prevent="commit"
      />
      <small v-if="suffix" class="eq-stepper__suffix">{{ suffix }}</small>
    </label>
    <button type="button" class="eq-stepper__btn" :aria-label="`${ariaLabel} 增加`" @click="stepBy(1)">+</button>
  </div>
</template>

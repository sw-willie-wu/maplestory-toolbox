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
    /** Decimal places kept when normalizing typed input (0 = integers). */
    precision?: number
  }>(),
  { max: Infinity, step: 1, suffix: undefined, nullable: false, precision: 0 }
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

/** Rounds to `precision` decimals (Number(toFixed) avoids float noise such as 2.3000000000000003). */
function round(n: number): number {
  return props.precision > 0 ? Number(n.toFixed(props.precision)) : Math.round(n)
}

function clamp(n: number): number {
  return Math.min(props.max, Math.max(props.min, round(n)))
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

/** From blank, either button starts at the in-range value nearest 0 (= min when min >= 0). */
function stepBy(dir: 1 | -1): void {
  const cur = props.modelValue
  set(cur === null ? clamp(0) : clamp(cur + dir * props.step))
}

const inputWidth = computed(() => `${Math.max(text.value.length, 1) + 1}ch`)
// Phone keyboards: "numeric"/"decimal" have no minus key on some platforms, so a range below 0 gets the text keyboard.
const inputMode = computed(() => (props.min < 0 ? 'text' : props.precision > 0 ? 'decimal' : 'numeric'))
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
        :inputmode="inputMode"
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

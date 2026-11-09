<script lang="ts">
export type LineIconName =
  | 'starforce'
  | 'scroll'
  | 'hammer'
  | 'flame'
  | 'potential'
  | 'bonusPotential'
  | 'exceptional'
  | 'reverse'

type Shape = { kind: 'path'; d: string } | { kind: 'circle'; cx: number; cy: number; r: number }

const p = (d: string): Shape => ({ kind: 'path', d })
const c = (cx: number, cy: number, r: number): Shape => ({ kind: 'circle', cx, cy, r })

// Paths copied verbatim from the approved mockup (layout-v22.html, sidebar `<svg class="li">`).
const ICONS: Record<LineIconName, Shape[]> = {
  starforce: [p('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z')],
  scroll: [
    p('M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8'),
    p('M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2z'),
    p('M9 8v10a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-1h4'),
    p('M12 9h4M12 13h4')
  ],
  hammer: [p('M13 6l5 5'), p('M10.5 3.5l6 6-2.5 2.5-6-6z'), p('M11 9.5L4.5 16a1.4 1.4 0 0 0 2 2L13 11.5')],
  // hexagonal crystal + facet lines + flame wisp + sparkle
  flame: [
    p('M5 11.5 11 8.5l7.5 2.5-.5 6.5-6 3.5-6.5-3z'),
    p('M8.5 10l-1 7.5M8.5 10l4.5 2.5-1.5 8'),
    p('M11.5 8.3c-.3-2 1.3-3.2 1.8-5.3 1.6 1.6 2.6 3.4 2.4 6'),
    p('M4.5 5.5v2.5M3.2 6.8h2.6')
  ],
  potential: [c(11, 13, 6), p('M8.5 13a2.5 2.5 0 0 1 2.5-2.5'), p('M18 3v4M16 5h4')],
  bonusPotential: [c(10, 14, 5.5), p('M7.7 14a2.3 2.3 0 0 1 2.3-2.3'), p('M18.5 4v5M16 6.5h5')],
  exceptional: [p('M12 3l6 6-6 12-6-12z'), p('M6 9h12M12 3v18')],
  reverse: [p('M4 8h13l-3-3M20 16H7l3 3')]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: LineIconName }>()
const shapes = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="eq-line-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-for="(s, i) in shapes" :key="i">
      <path v-if="s.kind === 'path'" :d="s.d" />
      <circle v-else :cx="s.cx" :cy="s.cy" :r="s.r" />
    </template>
  </svg>
</template>

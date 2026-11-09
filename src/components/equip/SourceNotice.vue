<script setup lang="ts">
import type { NoticeItem } from './format'

withDefaults(
  defineProps<{
    /** Rules that are KMS-estimate (spec §6.2: 「依 KMS 資料推估」). */
    kms?: NoticeItem[]
    /** Rules that are a reading of player data (`guess: true` → 「推測」); `label` is the full note. */
    guess?: NoticeItem[]
  }>(),
  { kms: () => [], guess: () => [] }
)
</script>

<template>
  <div v-if="kms.length || guess.length" class="source-notice">
    <div v-if="kms.length" data-test="kms-notice">
      <span class="badge text-bg-warning me-1">依 KMS 資料推估</span>
      <template v-for="(k, i) in kms" :key="k.label">
        <span v-if="i > 0">、</span><span class="notice-item" :title="k.ref">{{ k.label }}</span>
      </template>
    </div>
    <div v-for="g in guess" :key="g.label" data-test="guess-notice">
      <span class="badge text-bg-secondary me-1">推測</span><span :title="g.ref">{{ g.label.replace(/^推測：/, '') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.source-notice {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);

  > div + div {
    margin-top: 0.25rem;
  }

  .notice-item {
    text-decoration: underline dotted;
    cursor: help;
  }
}
</style>

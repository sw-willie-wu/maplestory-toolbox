<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { bucketOf, DEFAULT_FILTER, NO_CATEGORY_ID, type useEquipData } from '@/composables/useEquipData'
import type { IndexEntry, JobGroup } from '@/utils/mst/enhance/types'

const props = defineProps<{ data: ReturnType<typeof useEquipData> }>()
const emit = defineEmits<{ select: [id: number] }>()

/** Detail select value for items whose searchDetail is null (names(level, category, null, f)). */
const UNDETAILED = '__undetailed'

const JOBS: { id: JobGroup; name: string }[] = [
  { id: 'warrior', name: '劍士' },
  { id: 'magician', name: '法師' },
  { id: 'bowman', name: '弓箭手' },
  { id: 'thief', name: '盜賊' },
  { id: 'pirate', name: '海盜' }
]

const filter = reactive({ ...DEFAULT_FILTER })

// --- search ---
const query = ref('')
/** Results list visibility: closed by Escape / blur, reopened by typing or focus. */
const open = ref(true)
const results = computed(() => (query.value.trim() ? props.data.search(query.value, filter) : []))
const showResults = computed(() => open.value && query.value.trim() !== '')
let blurTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  open.value = true
}
function onSearchFocus() {
  if (blurTimer) clearTimeout(blurTimer)
  blurTimer = null
  open.value = true
}
function onSearchBlur() {
  // Delay so a click on a result (which fires after the input's blur) still lands.
  blurTimer = setTimeout(() => {
    open.value = false
    blurTimer = null
  }, 200)
}
function pickResult(e: IndexEntry) {
  query.value = ''
  // Sync the cascade to the picked item (no second select: onName only runs on user change).
  level.value = String(bucketOf(e.level))
  category.value = e.searchCategory ?? NO_CATEGORY_ID
  detail.value = e.searchCategory !== null && e.searchDetail !== null ? e.searchDetail : UNDETAILED
  nameId.value = String(e.id) // reset by the nameOptions watcher when a filter hides it
  emit('select', e.id)
}

// --- cascade: level bucket → category → detail → name ---
const level = ref('')
const category = ref('')
const detail = ref('')
const nameId = ref('')

const bucketLabel = (b: number) => `Lv.${b}–${b + 9}`
const buckets = computed(() => props.data.levelBuckets(filter))
const categoryNodes = computed(() => (level.value === '' ? [] : props.data.categories(Number(level.value), filter)))
const categoryNode = computed(() => categoryNodes.value.find((n) => n.category.id === category.value) ?? null)
const detailOptions = computed(() => {
  const node = categoryNode.value
  if (!node) return []
  const opts = node.details.map((d) => ({ value: d.id, label: d.name }))
  if (node.hasUndetailed) opts.push({ value: UNDETAILED, label: '(未分類)' })
  return opts
})
const nameOptions = computed(() => {
  if (level.value === '' || !categoryNode.value || detail.value === '') return []
  const d = detail.value === UNDETAILED ? null : detail.value
  return props.data
    .names(Number(level.value), category.value, d, filter)
    .map((e) => ({ value: String(e.id), label: props.data.displayName(e) }))
})

// Keep each choice valid when a filter (or the parent choice) changes; auto-pick the only option.
watch(buckets, (bs) => {
  if (level.value !== '' && !bs.includes(Number(level.value))) level.value = ''
})
watch(categoryNodes, (nodes) => {
  if (category.value !== '' && !nodes.some((n) => n.category.id === category.value)) category.value = ''
})
watch(detailOptions, (opts) => {
  if (opts.length === 1) detail.value = opts[0].value
  else if (detail.value !== '' && !opts.some((o) => o.value === detail.value)) detail.value = ''
})
watch(nameOptions, (opts) => {
  if (nameId.value !== '' && !opts.some((o) => o.value === nameId.value)) nameId.value = ''
})

function onName() {
  if (nameId.value !== '') emit('select', Number(nameId.value))
}

const jobValue = computed({
  get: () => filter.job ?? '',
  set: (v: string) => (filter.job = v === '' ? null : (v as JobGroup))
})
</script>

<template>
  <div class="equip-selector card">
    <div class="card-content">
      <div class="row g-2 align-items-start">
        <div class="col-12 col-lg-4 search-col">
          <input v-model="query" class="form-control form-control-sm" type="search" placeholder="搜尋裝備名稱"
            data-test="search" aria-label="搜尋裝備名稱" autocomplete="off" @input="onSearchInput"
            @focus="onSearchFocus" @blur="onSearchBlur" @keydown.esc="open = false" />
          <ul v-if="showResults && results.length" class="list-group search-results">
            <li v-for="e in results" :key="e.id" class="list-group-item list-group-item-action" role="button"
              data-test="search-result" @click="pickResult(e)">{{ data.displayName(e) }}</li>
          </ul>
          <div v-else-if="showResults" class="search-results list-group">
            <span class="list-group-item text-muted">找不到符合的裝備</span>
          </div>
        </div>
        <div class="col-6 col-lg-2">
          <select v-model="level" class="form-select form-select-sm" data-test="level" aria-label="等級區間">
            <option value="" disabled>等級</option>
            <option v-for="b in buckets" :key="b" :value="String(b)">{{ bucketLabel(b) }}</option>
          </select>
        </div>
        <div class="col-6 col-lg-2">
          <select v-model="category" class="form-select form-select-sm" data-test="category" aria-label="分類"
            :disabled="!categoryNodes.length">
            <option value="" disabled>分類</option>
            <option v-for="n in categoryNodes" :key="n.category.id" :value="n.category.id">{{ n.category.name }}</option>
          </select>
        </div>
        <div class="col-6 col-lg-2">
          <select v-model="detail" class="form-select form-select-sm" data-test="detail" aria-label="細項"
            :disabled="!detailOptions.length">
            <option value="" disabled>細項</option>
            <option v-for="d in detailOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>
        <div class="col-6 col-lg-2">
          <select v-model="nameId" class="form-select form-select-sm" data-test="name" aria-label="裝備"
            :disabled="!nameOptions.length" @change="onName">
            <option value="" disabled>裝備</option>
            <option v-for="n in nameOptions" :key="n.value" :value="n.value">{{ n.label }}</option>
          </select>
        </div>
      </div>

      <div class="chips mt-2">
        <input id="chip-scrollable" v-model="filter.scrollable" type="checkbox" class="btn-check" autocomplete="off"
          data-test="chip-scrollable" />
        <label class="btn btn-sm btn-outline-secondary" for="chip-scrollable">可上卷</label>
        <input id="chip-set" v-model="filter.setOnly" type="checkbox" class="btn-check" autocomplete="off"
          data-test="chip-set" />
        <label class="btn btn-sm btn-outline-secondary" for="chip-set">套裝</label>
        <input id="chip-variants" v-model="filter.includeVariants" type="checkbox" class="btn-check" autocomplete="off"
          data-test="chip-variants" />
        <label class="btn btn-sm btn-outline-secondary" for="chip-variants">包含活動期限版本</label>
        <select v-model="jobValue" class="form-select form-select-sm job-select" data-test="job" aria-label="職業">
          <option value="">職業不限</option>
          <option v-for="j in JOBS" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-col {
  position: relative;
}

.search-results {
  position: absolute;
  z-index: 10;
  left: calc(var(--bs-gutter-x) * 0.5);
  right: calc(var(--bs-gutter-x) * 0.5);
  max-height: 320px;
  overflow-y: auto;
  font-size: 0.875rem;

  .list-group-item {
    padding: 0.3rem 0.75rem;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;

  .job-select {
    width: auto;
  }
}
</style>

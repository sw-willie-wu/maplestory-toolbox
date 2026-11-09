<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { JobChoice, useEquipData } from '@/composables/useEquipData'
import type { IndexEntry } from '@/utils/mst/enhance/types'
import './ui/equip-ui.scss'

const props = defineProps<{ data: ReturnType<typeof useEquipData>; selectedId: number | null }>()
const emit = defineEmits<{ select: [id: number] }>()

/** <select> value for detail null (未分類). */
const UNDETAILED = '__undetailed'

const JOB_LABELS: Record<JobChoice, string> = {
  common: '共用',
  warrior: '劍士',
  magician: '法師',
  bowman: '弓箭手',
  thief: '盜賊',
  pirate: '海盜'
}

// ---- cascade state ----
const level = ref<number | null>(null)
const category = ref<string | null>(null)
const detail = ref<string | null>(null)
const job = ref<JobChoice>('common')
const equipId = ref<number | null>(null)

const levelOptions = computed(() => props.data.levelBuckets())
const categoryOptions = computed(() => (level.value === null ? [] : props.data.categories(level.value)))
const detailOptions = computed(() =>
  level.value === null || category.value === null ? [] : props.data.details(level.value, category.value)
)
const jobOptions = computed(() =>
  level.value === null || category.value === null ? [] : props.data.jobs(level.value, category.value, detail.value)
)
const equipOptions = computed(() =>
  level.value === null || category.value === null
    ? []
    : props.data.names(level.value, category.value, detail.value, job.value)
)

const levelLabel = (b: number) => `Lv.${b}–${b + 9}`
const detailValue = (d: string | null) => d ?? UNDETAILED

// Each fill* picks the first option of its level and fills every level below it (job: kept when still offered).
function fillEquip(): void {
  equipId.value = equipOptions.value[0]?.id ?? null
}
function fillJob(): void {
  if (!jobOptions.value.includes(job.value)) job.value = 'common'
  fillEquip()
}
function fillDetail(): void {
  const ds = detailOptions.value
  detail.value = ds.length ? ds[0] : null
  fillJob()
}
function fillCategory(): void {
  category.value = categoryOptions.value[0]?.category.id ?? null
  fillDetail()
}
function fillLevel(): void {
  level.value = levelOptions.value[0] ?? null
  fillCategory()
}

function emitEquip(): void {
  if (equipId.value !== null) emit('select', equipId.value)
}

const selectValue = (ev: Event) => (ev.target as HTMLSelectElement).value

function onLevel(ev: Event): void {
  level.value = Number(selectValue(ev))
  fillCategory()
  emitEquip()
}
function onCategory(ev: Event): void {
  category.value = selectValue(ev)
  fillDetail()
  emitEquip()
}
function onDetail(ev: Event): void {
  const v = selectValue(ev)
  detail.value = v === UNDETAILED ? null : v
  fillJob()
  emitEquip()
}
function onJob(ev: Event): void {
  job.value = selectValue(ev) as JobChoice
  fillEquip()
  emitEquip()
}
function onEquip(ev: Event): void {
  equipId.value = Number(selectValue(ev))
  emitEquip()
}

/** Puts the cascade on entry e's path; job kept when e is wearable by it, else 'common'. Does not emit. */
function applyEntry(e: IndexEntry): void {
  const p = props.data.pathOf(e)
  level.value = p.level
  category.value = p.category
  detail.value = p.detail
  if (!props.data.jobs(p.level, p.category, p.detail).includes(job.value)) job.value = 'common'
  if (!props.data.names(p.level, p.category, p.detail, job.value).some((x) => x.id === e.id)) job.value = 'common'
  equipId.value = e.id
}

function entryById(id: number): IndexEntry | undefined {
  return props.data.index.value.find((e) => e.id === id)
}

/** Syncs the cascade to equip id (e.g. after the page's random pick). Does not emit. */
function syncTo(id: number): void {
  const e = entryById(id)
  if (e) applyEntry(e)
}

defineExpose({ syncTo })

// Initialise once data is available (and re-sync when the page changes selectedId to another equip).
watch(
  [levelOptions, () => props.selectedId],
  ([buckets, id]) => {
    if (buckets.length === 0) return
    if (id !== null && id !== equipId.value) {
      const e = entryById(id)
      if (e) {
        applyEntry(e)
        return
      }
    }
    if (level.value === null || !buckets.includes(level.value)) fillLevel()
  },
  { immediate: true }
)

// ---- search ----
const query = ref('')
const open = ref(false)
const active = ref(-1)
const results = computed(() => (query.value.trim() ? props.data.search(query.value) : []))
const showResults = computed(() => open.value && query.value.trim() !== '')
/** Detail (部位) name of a result, so same-name same-level items (e.g. 單手劍 vs 雙手劍) are distinguishable. */
function searchDetail(e: IndexEntry): string {
  const p = props.data.pathOf(e)
  return props.data.detailName(p.category, p.detail)
}

let blurTimer: ReturnType<typeof setTimeout> | null = null
function clearBlurTimer(): void {
  if (blurTimer) clearTimeout(blurTimer)
  blurTimer = null
}
onBeforeUnmount(clearBlurTimer)

function onSearchInput(): void {
  open.value = true
  active.value = -1
}
function onSearchFocus(): void {
  clearBlurTimer()
  open.value = true
}
function onSearchBlur(): void {
  // Delayed so a click on a result still lands.
  clearBlurTimer()
  blurTimer = setTimeout(() => {
    open.value = false
    blurTimer = null
  }, 150)
}
function closeResults(): void {
  open.value = false
  active.value = -1
}
function pick(e: IndexEntry): void {
  query.value = ''
  closeResults()
  applyEntry(e)
  emit('select', e.id)
}
function onSearchKeydown(ev: KeyboardEvent): void {
  const n = results.value.length
  switch (ev.key) {
    case 'ArrowDown':
      if (!n) return
      ev.preventDefault()
      open.value = true
      active.value = (active.value + 1) % n
      break
    case 'ArrowUp':
      if (!n) return
      ev.preventDefault()
      open.value = true
      active.value = active.value <= 0 ? n - 1 : active.value - 1
      break
    case 'Enter':
      if (!showResults.value || !n) return
      ev.preventDefault()
      pick(results.value[active.value >= 0 ? active.value : 0])
      break
    case 'Escape':
      closeResults()
      break
  }
}
</script>

<template>
  <div class="eq-card eq-picker">
    <h2 class="eq-card__title">選擇裝備</h2>

    <div class="eq-picker__search">
      <input
        v-model="query"
        class="eq-control"
        type="text"
        placeholder="搜尋裝備名稱"
        aria-label="搜尋裝備名稱"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showResults && results.length > 0 ? 'true' : 'false'"
        data-test="search"
        @input="onSearchInput"
        @focus="onSearchFocus"
        @blur="onSearchBlur"
        @keydown="onSearchKeydown"
      />
      <ul v-if="showResults && results.length" class="eq-picker__results" role="listbox">
        <li
          v-for="(e, i) in results"
          :key="e.id"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
          :class="{ 'is-active': i === active }"
          data-test="search-result"
          @mousedown.prevent
          @mouseenter="active = i"
          @click="pick(e)"
        >
          <span data-test="search-name">{{ e.name }}</span>
          <small><span data-test="search-detail">{{ searchDetail(e) }}</span> · Lv.{{ e.level }}</small>
        </li>
      </ul>
      <div v-else-if="showResults" class="eq-picker__results eq-picker__empty">找不到符合的裝備</div>
    </div>

    <div class="eq-form">
      <label for="eq-picker-level">等級：</label>
      <select id="eq-picker-level" data-test="level" :value="level ?? ''" @change="onLevel">
        <option v-for="b in levelOptions" :key="b" :value="String(b)">{{ levelLabel(b) }}</option>
      </select>
      <label for="eq-picker-category">分類：</label>
      <select id="eq-picker-category" data-test="category" :value="category ?? ''" @change="onCategory">
        <option v-for="n in categoryOptions" :key="n.category.id" :value="n.category.id">
          {{ data.categoryName(n.category.id) }}
        </option>
      </select>

      <label for="eq-picker-detail">部位：</label>
      <select id="eq-picker-detail" data-test="detail" :value="detailValue(detail)" @change="onDetail">
        <option v-for="d in detailOptions" :key="detailValue(d)" :value="detailValue(d)">
          {{ category === null ? '' : data.detailName(category, d) }}
        </option>
      </select>
      <label for="eq-picker-job">職業：</label>
      <select id="eq-picker-job" data-test="job" :value="job" @change="onJob">
        <option v-for="j in jobOptions" :key="j" :value="j">{{ JOB_LABELS[j] }}</option>
      </select>

      <label for="eq-picker-equip">裝備：</label>
      <div class="full">
        <select id="eq-picker-equip" data-test="equip" :value="equipId ?? ''" @change="onEquip">
          <option v-for="e in equipOptions" :key="e.id" :value="String(e.id)">{{ e.name }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.eq-picker__search {
  position: relative;
  margin-bottom: 12px;
}

.eq-picker__results {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  background: #fff;
  border: 1px solid #c5cbd5;
  border-top: 0;
  font-size: 14px;

  li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 8px;
    cursor: pointer;

    small {
      color: #8a93a0;
    }

    &.is-active {
      background: rgba(44, 174, 186, 0.14);
    }
  }
}

.eq-picker__empty {
  padding: 5px 8px;
  color: #8a93a0;
}
</style>

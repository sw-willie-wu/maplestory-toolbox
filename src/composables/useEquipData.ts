import { ref, shallowRef } from 'vue'
import { POTENTIAL, type PotentialOption, type RawPotentialOption } from '@/utils/mst/enhance/rules/potential'
import type {
  EquipData,
  IndexEntry,
  JobGroup,
  JobsData,
  SearchCategory,
  SearchDetail,
  SetInfo
} from '@/utils/mst/enhance/types'

export interface EquipFilter {
  /** tuc > 0 */
  scrollable: boolean
  /** UI chip「包含活動期限版本」; false → canonical entries only. */
  includeVariants: boolean
  /** entry.jobs === 'all' or includes job */
  job: JobGroup | null
  /** setId !== null */
  setOnly: boolean
}

/**
 * All filters off (canonical entries only). Frozen: never mutate it — copy first, e.g.
 * `reactive({ ...DEFAULT_FILTER })` or `{ ...DEFAULT_FILTER, job: 'thief' }`.
 */
export const DEFAULT_FILTER: EquipFilter = Object.freeze({
  scrollable: false,
  includeVariants: false,
  job: null,
  setOnly: false
})

export interface CategoryNode {
  category: SearchCategory
  details: SearchDetail[]
  /** Some items of this category (in the bucket) have searchDetail null → names(level, category, null, f). */
  hasUndetailed: boolean
}

export interface DataMeta {
  dataVersion: string
  exportedAt?: string
  client?: string
  version?: number
}

/** Synthetic category for items whose searchCategory is null. */
export const NO_CATEGORY_ID = '__none'
const NO_CATEGORY: SearchCategory = Object.freeze({ id: NO_CATEGORY_ID, name: '其他', details: [] })

/** Level bucket (dropdown value) of an item level: Lv.100–109 → 100. */
export const bucketOf = (level: number) => Math.floor(level / 10) * 10

interface DerivedState {
  byId: Map<number, IndexEntry>
  /** includeVariants=false */
  canonical: IndexEntry[]
  /** includeVariants=true: canonical + labelled variants ('' label on a non-canonical = duplicate → dropped). */
  withVariants: IndexEntry[]
  /** id → label shown by displayName (variantLabel, plus ` #id` when it repeats within its (slot, name, cash) group). */
  labels: Map<number, string>
  slotNames: Record<string, string>
  sets: Record<string, SetInfo>
  categories: SearchCategory[]
  specJobs: Map<number, JobsData['specJobs'][number]>
}

function emptyState(): DerivedState {
  return {
    byId: new Map(),
    canonical: [],
    withVariants: [],
    labels: new Map(),
    slotNames: {},
    sets: {},
    categories: [],
    specJobs: new Map()
  }
}

function buildState(
  entries: IndexEntry[],
  slotNames: Record<string, string>,
  sets: Record<string, SetInfo>,
  categories: SearchCategory[],
  jobs: JobsData
): DerivedState {
  const withVariants = entries.filter((e) => e.canonical || e.variantLabel !== '')
  const groups = new Map<string, IndexEntry[]>()
  for (const e of withVariants) {
    if (e.variantLabel === '') continue
    const key = `${e.slot}\u0000${e.name}\u0000${e.cash}\u0000${e.variantLabel}`
    const g = groups.get(key)
    if (g) g.push(e)
    else groups.set(key, [e])
  }
  const labels = new Map<number, string>()
  for (const g of groups.values()) {
    for (const e of g) labels.set(e.id, g.length > 1 ? `${e.variantLabel} #${e.id}` : e.variantLabel)
  }
  return {
    byId: new Map(entries.map((e) => [e.id, e])),
    canonical: entries.filter((e) => e.canonical),
    withVariants,
    labels,
    slotNames,
    sets,
    categories,
    specJobs: new Map(jobs.specJobs.map((j) => [j.id, j]))
  }
}

export function useEquipData(baseUrl = '/data/tms-v283', fetchImpl: typeof fetch = fetch) {
  const meta = ref<DataMeta | null>(null)
  const index = shallowRef<IndexEntry[]>([])
  const error = ref<string | null>(null)
  const loading = ref(false)

  /**
   * All lookup / derived data, replaced as a whole after load so every reader (including computed()s created before
   * load) tracks it. Every function below reads `state.value` (never a captured plain variable).
   */
  const state = shallowRef<DerivedState>(emptyState())

  let loadPromise: Promise<void> | null = null
  const equipFiles = new Map<string, Promise<Record<string, EquipData>>>()

  async function getJson<T>(file: string): Promise<T> {
    let res: Response
    try {
      res = await fetchImpl(`${baseUrl}/${file}`)
    } catch (e) {
      throw new Error(`無法載入 ${file}：${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) throw new Error(`無法載入 ${file}（HTTP ${res.status}）`)
    try {
      return (await res.json()) as T
    } catch (e) {
      throw new Error(`無法解析 ${file}：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function doLoad() {
    loading.value = true
    error.value = null
    try {
      const [m, idx, slots, setData, cats, jobs] = await Promise.all([
        getJson<DataMeta>('meta.json'),
        getJson<IndexEntry[]>('index.json'),
        getJson<Record<string, string>>('slot-names.json'),
        getJson<Record<string, SetInfo>>('sets.json'),
        getJson<SearchCategory[]>('categories.json'),
        getJson<JobsData>('jobs.json')
      ])
      state.value = buildState(idx, slots, setData, cats, jobs)
      meta.value = m
      index.value = idx
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      state.value = emptyState()
      index.value = []
      loadPromise = null // allow a retry
    } finally {
      loading.value = false
    }
  }

  /** Loads meta, index and lookup files in parallel. Idempotent; after a failure a later call retries. */
  function load(): Promise<void> {
    loadPromise ??= doLoad()
    return loadPromise
  }

  /** Loads any equip id (canonical or not); each equip/<category>.json is fetched once. */
  async function loadEquip(id: number): Promise<EquipData> {
    await load()
    if (error.value) throw new Error(error.value)
    const e = state.value.byId.get(id)
    if (!e) throw new Error(`未知的裝備 id：${id}`)
    const file = `equip/${e.category}.json`
    let p = equipFiles.get(file)
    if (!p) {
      p = getJson<Record<string, EquipData>>(file)
      equipFiles.set(file, p)
      p.catch(() => equipFiles.delete(file))
    }
    const data = (await p)[String(id)]
    if (!data) throw new Error(`裝備 ${id} 不在 ${file}`)
    return data
  }

  let potentialPromise: Promise<PotentialOption[]> | null = null
  /** potential-options.json through POTENTIAL.buildOptions; fetched once (retried after a failure). */
  function loadPotentialOptions(): Promise<PotentialOption[]> {
    potentialPromise ??= getJson<RawPotentialOption[]>('potential-options.json').then((raw) => POTENTIAL.buildOptions(raw))
    potentialPromise.catch(() => (potentialPromise = null))
    return potentialPromise
  }

  function displayName(e: IndexEntry): string {
    const label = state.value.labels.get(e.id) ?? e.variantLabel
    return label ? `${e.name}（${label}）` : e.name
  }

  function passes(e: IndexEntry, f: EquipFilter): boolean {
    if (f.scrollable && e.tuc <= 0) return false
    if (f.setOnly && e.setId === null) return false
    if (f.job && e.jobs !== 'all' && !e.jobs.includes(f.job)) return false
    return true
  }

  function filtered(f: EquipFilter): IndexEntry[] {
    const s = state.value
    return (f.includeVariants ? s.withVariants : s.canonical).filter((e) => passes(e, f))
  }

  /**
   * A numeric query equal to an id returns that entry even when it is hidden by includeVariants=false (or is a
   * collapsed ''-label duplicate); the other filters still apply.
   */
  function search(q: string, f: EquipFilter, limit = 50): IndexEntry[] {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const hits = filtered(f).filter((e) => e.name.toLowerCase().includes(needle))
    if (/^\d+$/.test(needle)) {
      const byIdHit = state.value.byId.get(Number(needle))
      if (byIdHit && passes(byIdHit, f) && !hits.includes(byIdHit)) hits.push(byIdHit)
    }
    const exact = (e: IndexEntry) => (e.name.toLowerCase() === needle ? 0 : 1)
    hits.sort(
      (a, b) =>
        exact(a) - exact(b) ||
        Number(b.canonical) - Number(a.canonical) ||
        b.level - a.level ||
        a.id - b.id
    )
    return hits.slice(0, limit)
  }

  function levelBuckets(f: EquipFilter): number[] {
    return [...new Set(filtered(f).map((e) => bucketOf(e.level)))].sort((a, b) => a - b)
  }

  function inBucket(level: number, f: EquipFilter): IndexEntry[] {
    const b = bucketOf(level)
    return filtered(f).filter((e) => bucketOf(e.level) === b)
  }

  function categories(level: number, f: EquipFilter): CategoryNode[] {
    // category id → detail ids present (null = undetailed)
    const present = new Map<string, Set<string | null>>()
    for (const e of inBucket(level, f)) {
      const c = e.searchCategory ?? NO_CATEGORY_ID
      let s = present.get(c)
      if (!s) present.set(c, (s = new Set()))
      s.add(e.searchCategory === null ? null : e.searchDetail)
    }
    const nodes: CategoryNode[] = []
    for (const cat of state.value.categories) {
      const s = present.get(cat.id)
      if (!s) continue
      nodes.push({ category: cat, details: cat.details.filter((d) => s.has(d.id)), hasUndetailed: s.has(null) })
    }
    if (present.has(NO_CATEGORY_ID)) nodes.push({ category: NO_CATEGORY, details: [], hasUndetailed: true })
    return nodes
  }

  /** detail null = items of that category with searchDetail null; category '__none' = items with searchCategory null. */
  function names(level: number, category: string, detail: string | null, f: EquipFilter): IndexEntry[] {
    const match =
      category === NO_CATEGORY_ID
        ? (e: IndexEntry) => e.searchCategory === null
        : (e: IndexEntry) => e.searchCategory === category && e.searchDetail === detail
    return inBucket(level, f)
      .filter(match)
      .sort(
        (a, b) =>
          a.level - b.level ||
          a.name.localeCompare(b.name, 'zh-Hant') ||
          Number(b.canonical) - Number(a.canonical) ||
          a.id - b.id
      )
  }

  function slotName(code: string): string {
    return state.value.slotNames[code] ?? code
  }

  function setInfo(setId: number | null): SetInfo | null {
    const { sets } = state.value
    if (setId === null) return null
    return sets[String(setId)] ?? null
  }

  /** name null in jobs.json → legacyName (or the raw id) with guess: true (UI shows「(推測)」). */
  function jobName(specJob: number | null): { name: string; guess: boolean } | null {
    const { specJobs } = state.value
    if (specJob === null) return null
    const j = specJobs.get(specJob)
    if (!j) return null
    if (j.name !== null) return { name: j.name, guess: false }
    return { name: j.legacyName ?? String(specJob), guess: true }
  }

  return {
    meta,
    index,
    error,
    loading,
    load,
    loadEquip,
    loadPotentialOptions,
    displayName,
    search,
    levelBuckets,
    categories,
    names,
    slotName,
    setInfo,
    jobName
  }
}

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

/** Job dropdown value. 'common' (共用) = no job filter; a JobGroup = items that job can wear (incl. jobs 'all'). */
export type JobChoice = 'common' | JobGroup

export const JOB_CHOICES: readonly JobChoice[] = Object.freeze(['common', 'warrior', 'magician', 'bowman', 'thief', 'pirate'])

/** Cascade position of an entry: level bucket, category id ('__none' when searchCategory is null), detail (null = 未分類). */
export interface EquipPath {
  level: number
  category: string
  detail: string | null
}

export interface CategoryNode {
  category: SearchCategory
  details: SearchDetail[]
  /** Some items of this category (in the bucket) have searchDetail null → names(level, category, null, job). */
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

/**
 * Variant characters that users type interchangeably but WZ names spell one way (e.g. 神祕 in data, 神秘 typed).
 * Both query and name are folded to the right-hand form before matching.
 */
const SEARCH_FOLD: Readonly<Record<string, string>> = { 秘: '祕', 臺: '台', 艷: '豔', 盃: '杯', 周: '週' }
const SEARCH_FOLD_RE = new RegExp(`[${Object.keys(SEARCH_FOLD).join('')}]`, 'g')

/** Lower-cases Latin and folds variant CJK characters for name search. */
export function foldSearchText(s: string): string {
  return s.toLowerCase().replace(SEARCH_FOLD_RE, (c) => SEARCH_FOLD[c])
}

/** Level bucket (dropdown value) of an item level: Lv.100–109 → 100. */
export const bucketOf = (level: number) => Math.floor(level / 10) * 10

interface DerivedState {
  byId: Map<number, IndexEntry>
  /** Tool scope (the only entries the calculator lists): canonical && !cash && enhanceable, in index.json order. */
  tool: IndexEntry[]
  /** Tool-scope entries per level bucket. */
  byBucket: Map<number, IndexEntry[]>
  /** Non-empty level buckets, ascending. */
  buckets: number[]
  slotNames: Record<string, string>
  sets: Record<string, SetInfo>
  categories: SearchCategory[]
  categoryById: Map<string, SearchCategory>
  specJobs: Map<number, JobsData['specJobs'][number]>
}

function emptyState(): DerivedState {
  return {
    byId: new Map(),
    tool: [],
    byBucket: new Map(),
    buckets: [],
    slotNames: {},
    sets: {},
    categories: [],
    categoryById: new Map(),
    specJobs: new Map()
  }
}

const inToolScope = (e: IndexEntry) => e.canonical && !e.cash && e.enhanceable

function buildState(
  entries: IndexEntry[],
  slotNames: Record<string, string>,
  sets: Record<string, SetInfo>,
  categories: SearchCategory[],
  jobs: JobsData
): DerivedState {
  const tool = entries.filter(inToolScope)
  const byBucket = new Map<number, IndexEntry[]>()
  for (const e of tool) {
    const b = bucketOf(e.level)
    const list = byBucket.get(b)
    if (list) list.push(e)
    else byBucket.set(b, [e])
  }
  return {
    byId: new Map(entries.map((e) => [e.id, e])),
    tool,
    byBucket,
    buckets: [...byBucket.keys()].sort((a, b) => a - b),
    slotNames,
    sets,
    categories,
    categoryById: new Map(categories.map((c) => [c.id, c])),
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
      const [m, idx, slots, setData, cats, jobData] = await Promise.all([
        getJson<DataMeta>('meta.json'),
        getJson<IndexEntry[]>('index.json'),
        getJson<Record<string, string>>('slot-names.json'),
        getJson<Record<string, SetInfo>>('sets.json'),
        getJson<SearchCategory[]>('categories.json'),
        getJson<JobsData>('jobs.json')
      ])
      state.value = buildState(idx, slots, setData, cats, jobData)
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

  function wearable(e: IndexEntry, job: JobChoice): boolean {
    return job === 'common' || e.jobs === 'all' || e.jobs.includes(job)
  }

  /** Category id of an entry in the cascade ('__none' for searchCategory null). */
  const categoryOf = (e: IndexEntry) => e.searchCategory ?? NO_CATEGORY_ID
  /** Detail of an entry in the cascade (null = 未分類; always null under '__none'). */
  const detailOf = (e: IndexEntry) => (e.searchCategory === null ? null : e.searchDetail)

  /**
   * Tool-scope name search (canonical && !cash && enhanceable). Matches names only — never ids — case-insensitively;
   * exact name first, then level desc, then id.
   */
  function search(q: string, limit = 50): IndexEntry[] {
    const needle = foldSearchText(q.trim())
    if (!needle) return []
    const exact = (e: IndexEntry) => (foldSearchText(e.name) === needle ? 0 : 1)
    return state.value.tool
      .filter((e) => foldSearchText(e.name).includes(needle))
      .sort((a, b) => exact(a) - exact(b) || b.level - a.level || a.id - b.id)
      .slice(0, limit)
  }

  /** Non-empty level buckets of the tool scope, ascending. */
  function levelBuckets(): number[] {
    return [...state.value.buckets]
  }

  function inBucket(level: number): IndexEntry[] {
    return state.value.byBucket.get(bucketOf(level)) ?? []
  }

  function inDetail(level: number, category: string, detail: string | null): IndexEntry[] {
    return inBucket(level).filter((e) => categoryOf(e) === category && detailOf(e) === detail)
  }

  /**
   * Non-empty categories of a bucket in categories.json order, '__none' (其他) last. Ids missing from categories.json
   * (not expected) are appended before '__none' so no entry becomes unreachable.
   */
  function categories(level: number): CategoryNode[] {
    const present = new Map<string, Set<string | null>>()
    for (const e of inBucket(level)) {
      const c = categoryOf(e)
      let s = present.get(c)
      if (!s) present.set(c, (s = new Set()))
      s.add(detailOf(e))
    }
    const nodes: CategoryNode[] = []
    const node = (cat: SearchCategory, s: Set<string | null>): CategoryNode => ({
      category: cat,
      details: cat.details.filter((d) => s.has(d.id)),
      hasUndetailed: s.has(null)
    })
    for (const cat of state.value.categories) {
      const s = present.get(cat.id)
      if (s) nodes.push(node(cat, s))
    }
    for (const [id, s] of present) {
      if (id !== NO_CATEGORY_ID && !state.value.categoryById.has(id)) nodes.push(node({ id, name: id, details: [] }, s))
    }
    if (present.has(NO_CATEGORY_ID)) nodes.push({ category: NO_CATEGORY, details: [], hasUndetailed: true })
    return nodes
  }

  /**
   * Non-empty details of (bucket, category) in official order, null (未分類) last. Detail ids missing from
   * categories.json (not expected) are appended before null.
   */
  function details(level: number, category: string): (string | null)[] {
    const present = new Set<string | null>()
    for (const e of inBucket(level)) if (categoryOf(e) === category) present.add(detailOf(e))
    const official = state.value.categoryById.get(category)?.details.map((d) => d.id) ?? []
    const out: (string | null)[] = official.filter((id) => present.has(id))
    for (const id of present) if (id !== null && !out.includes(id)) out.push(id)
    if (present.has(null)) out.push(null)
    return out
  }

  /** Job choices with at least one wearable entry under (bucket, category, detail): 'common' first, JOB_CHOICES order. */
  function jobs(level: number, category: string, detail: string | null): JobChoice[] {
    const list = inDetail(level, category, detail)
    return JOB_CHOICES.filter((j) => list.some((e) => wearable(e, j)))
  }

  /**
   * Tool-scope entries of (bucket, category, detail) wearable by job ('common' = all), sorted level, name, id.
   * detail null = items of that category with searchDetail null; category '__none' = items with searchCategory null.
   */
  function names(level: number, category: string, detail: string | null, job: JobChoice): IndexEntry[] {
    return inDetail(level, category, detail)
      .filter((e) => wearable(e, job))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'zh-Hant') || a.id - b.id)
  }

  function pathOf(e: IndexEntry): EquipPath {
    return { level: bucketOf(e.level), category: categoryOf(e), detail: detailOf(e) }
  }

  /** A uniformly random tool-scope entry (index.json order: rng 0 → first, rng → 1 → last); null before load. */
  function randomPick(rng: () => number = Math.random): IndexEntry | null {
    const { tool } = state.value
    if (tool.length === 0) return null
    const i = Math.min(tool.length - 1, Math.max(0, Math.floor(rng() * tool.length)))
    return tool[i]
  }

  function categoryName(id: string): string {
    if (id === NO_CATEGORY_ID) return NO_CATEGORY.name
    return state.value.categoryById.get(id)?.name ?? id
  }

  function detailName(category: string, detail: string | null): string {
    if (detail === null) return '(未分類)'
    return state.value.categoryById.get(category)?.details.find((d) => d.id === detail)?.name ?? detail
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
    search,
    levelBuckets,
    categories,
    details,
    jobs,
    names,
    pathOf,
    randomPick,
    categoryName,
    detailName,
    slotName,
    setInfo,
    jobName
  }
}

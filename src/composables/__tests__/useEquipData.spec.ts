import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { computed } from 'vue'
import { DATA_DIR } from '@/utils/mst/enhance/__tests__/helpers'
import type { IndexEntry, JobsData, SearchCategory, SetInfo } from '@/utils/mst/enhance/types'
import { JOB_CHOICES, useEquipData } from '../useEquipData'

const BASE = '/data/test'

function entry(p: Partial<IndexEntry> & Pick<IndexEntry, 'id' | 'name'>): IndexEntry {
  return {
    category: 'Cap',
    slot: 'Cp',
    level: 100,
    cash: false,
    enhanceable: true,
    tuc: 7,
    setId: null,
    jobs: 'all',
    canonical: true,
    variantLabel: '',
    searchCategory: 'Armor',
    searchDetail: 'Cap',
    specJob: null,
    ...p
  }
}

const INDEX: IndexEntry[] = [
  entry({ id: 1002000, name: '綠色普通帽', level: 10 }),
  entry({ id: 1002001, name: '綠色普通帽', level: 10, canonical: false, variantLabel: '數值不同' }),
  entry({ id: 1002002, name: '綠色普通帽', level: 10, canonical: false, variantLabel: '數值不同' }),
  entry({ id: 1002003, name: '綠色普通帽', level: 10, canonical: false, variantLabel: '' }),
  entry({ id: 1002004, name: '綠色普通帽', level: 10, canonical: false, variantLabel: '活動版' }),
  entry({ id: 1005983, name: '永恆盜賊頭巾', level: 250, tuc: 12, setId: 889, jobs: ['thief'] }),
  entry({ id: 1005984, name: '永恆戰士頭盔', level: 250, tuc: 12, setId: 889, jobs: ['warrior'] }),
  entry({ id: 1002999, name: '無卷帽', level: 105, tuc: 0 }),
  entry({ id: 1003000, name: 'Maple Hat', level: 35 }),
  entry({ id: 1003001, name: '帽', level: 30 }),
  // Out of tool scope: a cash cap (own bucket 60) and a non-enhanceable cap (own bucket 70).
  entry({ id: 1004500, name: '點裝帽', level: 60, cash: true, enhanceable: false, tuc: 0 }),
  entry({ id: 1004600, name: '不可強化帽', level: 70, enhanceable: false, tuc: 0 }),
  // A non-canonical-only bucket (80): must never show up.
  entry({ id: 1004700, name: '活動帽', level: 80, canonical: false, variantLabel: '活動版' }),
  // Same detail id "Sword" under two categories.
  entry({ id: 1302000, name: '單手劍甲', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: 'Sword', jobs: ['warrior'] }),
  entry({ id: 1402000, name: '雙手劍乙', category: 'Weapon', slot: 'WpSi', level: 100, searchCategory: 'TwoHandSword', searchDetail: 'Sword', jobs: ['warrior'] }),
  entry({ id: 1302999, name: '單手劍無細類', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: null, jobs: ['thief'] }),
  entry({ id: 1112000, name: '神秘戒指', category: 'Ring', slot: 'Ri', level: 100, searchCategory: null, searchDetail: null, specJob: 22 }),
  // Cash / non-enhanceable rows inside populated buckets (must not appear in lists either).
  entry({ id: 1702000, name: '點裝劍', category: 'Weapon', slot: 'Wp', level: 100, cash: true, enhanceable: false, searchCategory: 'OneHandSword', searchDetail: 'Sword', jobs: ['magician'] }),
  entry({ id: 1112999, name: '不可強化戒指', category: 'Ring', slot: 'Ri', level: 250, enhanceable: false, searchCategory: null, searchDetail: null })
]

const CATEGORIES: SearchCategory[] = [
  {
    id: 'Armor',
    name: '防具',
    details: [
      { id: 'Hat', name: '頭飾', begin: 1010000, end: 1019999, ranges: [[1010000, 1019999]] },
      { id: 'Cap', name: '帽子', begin: 1000000, end: 1009999, ranges: [[1000000, 1009999]] }
    ]
  },
  { id: 'OneHandSword', name: '單手武器', details: [{ id: 'Sword', name: '劍', begin: 1302000, end: 1302999, ranges: [[1302000, 1302999]] }] },
  { id: 'TwoHandSword', name: '雙手武器', details: [{ id: 'Sword', name: '大劍', begin: 1402000, end: 1402999, ranges: [[1402000, 1402999]] }] }
]

const SETS: Record<string, SetInfo> = {
  '889': { name: '永恆套裝', completeCount: 7, effects: { '2': { stats: { incAllStat: 10 } } }, jokerPossible: true, zeroWeaponJokerPossible: false }
}

const JOBS: JobsData = {
  groups: [{ id: 'warrior', bit: 1, name: '劍士', confirmed: true }],
  specJobs: [
    { id: 21, name: '狂狼勇士', nameEn: 'Aran', confirmed: true, legacyName: '狂狼勇士', count: 2 },
    { id: 22, name: null, nameEn: null, confirmed: false, legacyName: '龍魔導士', count: 2 }
  ]
}

function equipFile(entries: IndexEntry[]) {
  return Object.fromEntries(entries.map((e) => [String(e.id), { ...e, base: {}, isWeapon: e.category === 'Weapon' }]))
}

function mockFiles(): Record<string, unknown> {
  return {
    'meta.json': { dataVersion: 'TMS v283' },
    'index.json': INDEX,
    'slot-names.json': { Cp: '帽子', Wp: '單手武器' },
    'sets.json': SETS,
    'categories.json': CATEGORIES,
    'jobs.json': JOBS,
    'equip/Cap.json': equipFile(INDEX.filter((e) => e.category === 'Cap')),
    'equip/Weapon.json': equipFile(INDEX.filter((e) => e.category === 'Weapon')),
    'equip/Ring.json': equipFile(INDEX.filter((e) => e.category === 'Ring'))
  }
}

function mockFetch(files: Record<string, unknown> = mockFiles(), failing: string[] = []) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const rel = String(input).slice(BASE.length + 1)
    if (failing.includes(rel)) return { ok: false, status: 500, json: async () => ({}) } as Response
    if (!(rel in files)) return { ok: false, status: 404, json: async () => ({}) } as Response
    return { ok: true, status: 200, json: async () => structuredClone(files[rel]) } as Response
  })
}

async function loaded(fetchImpl = mockFetch()) {
  const d = useEquipData(BASE, fetchImpl as unknown as typeof fetch)
  await d.load()
  return d
}

const ids = (es: IndexEntry[]) => es.map((e) => e.id)
type Data = Awaited<ReturnType<typeof loaded>>

/** Every entry reachable through the cascade (all levels × categories × details, job 'common'). */
function cascadeAll(d: Data): IndexEntry[] {
  const out: IndexEntry[] = []
  for (const lv of d.levelBuckets())
    for (const c of d.categories(lv))
      for (const det of d.details(lv, c.category.id)) out.push(...d.names(lv, c.category.id, det, 'common'))
  return out
}

/** In fixture order: canonical && !cash && enhanceable. */
const TOOL_IDS = [1002000, 1005983, 1005984, 1002999, 1003000, 1003001, 1302000, 1402000, 1302999, 1112000]
const OUT_OF_SCOPE = [1004500, 1004600, 1702000, 1112999]
const NON_CANONICAL = [1002001, 1002002, 1002003, 1002004, 1004700]

describe('useEquipData', () => {
  it('JOB_CHOICES is common then the five job groups', () => {
    expect(JOB_CHOICES).toEqual(['common', 'warrior', 'magician', 'bowman', 'thief', 'pirate'])
  })

  it('loads meta, index and lookups', async () => {
    const d = await loaded()
    expect(d.meta.value?.dataVersion).toBe('TMS v283')
    expect(d.index.value).toHaveLength(INDEX.length)
    expect(d.error.value).toBeNull()
    expect(d.loading.value).toBe(false)
    expect(d.slotName('Cp')).toBe('帽子')
    expect(d.slotName('Zz')).toBe('Zz')
  })

  it('load is idempotent', async () => {
    const f = mockFetch()
    const d = useEquipData(BASE, f as unknown as typeof fetch)
    await Promise.all([d.load(), d.load()])
    await d.load()
    expect(f).toHaveBeenCalledTimes(6)
  })

  it('reports load error with the file name and leaves index empty', async () => {
    const d = await loaded(mockFetch(mockFiles(), ['sets.json']))
    expect(d.error.value).toContain('sets.json')
    expect(d.index.value).toEqual([])
    expect(d.levelBuckets()).toEqual([])
    expect(d.randomPick()).toBeNull()
    expect(d.loading.value).toBe(false)
  })

  it('load() retries after a failure', async () => {
    const failing = ['sets.json']
    const f = mockFetch(mockFiles(), failing)
    const d = useEquipData(BASE, f as unknown as typeof fetch)
    await d.load()
    expect(d.error.value).toContain('sets.json')
    expect(d.index.value).toEqual([])
    expect(f).toHaveBeenCalledTimes(6)
    failing.length = 0
    await d.load()
    expect(d.error.value).toBeNull()
    expect(d.index.value).toHaveLength(INDEX.length)
    expect(f).toHaveBeenCalledTimes(12)
    await d.load() // now settled: no further fetches
    expect(f).toHaveBeenCalledTimes(12)
  })

  it('derived lookups are reactive: computed()s created before load() update after it', async () => {
    const d = useEquipData(BASE, mockFetch() as unknown as typeof fetch)
    const buckets = computed(() => d.levelBuckets())
    const jobs = computed(() => d.jobs(100, 'OneHandSword', 'Sword'))
    const cat = computed(() => d.categoryName('Armor'))
    const set = computed(() => d.setInfo(889)?.name ?? null)
    const slot = computed(() => d.slotName('Cp'))
    const job = computed(() => d.jobName(22))
    expect(buckets.value).toEqual([])
    expect(jobs.value).toEqual([])
    expect(cat.value).toBe('Armor')
    expect(set.value).toBeNull()
    expect(slot.value).toBe('Cp')
    expect(job.value).toBeNull()
    await d.load()
    expect(buckets.value).toEqual([10, 30, 100, 250])
    expect(jobs.value).toEqual(['common', 'warrior'])
    expect(cat.value).toBe('防具')
    expect(set.value).toBe('永恆套裝')
    expect(slot.value).toBe('帽子')
    expect(job.value).toEqual({ name: '龍魔導士', guess: true })
  })

  it('reports thrown fetch errors', async () => {
    const f = vi.fn(async () => {
      throw new Error('network down')
    })
    const d = await loaded(f as unknown as ReturnType<typeof mockFetch>)
    expect(d.error.value).toMatch(/\.json/)
    expect(d.index.value).toEqual([])
  })

  describe('tool scope', () => {
    it('tool scope hides cash and non-enhanceable', async () => {
      const d = await loaded()
      expect(d.levelBuckets()).not.toContain(60) // only the cash cap
      expect(d.levelBuckets()).not.toContain(70) // only the non-enhanceable cap
      expect(d.categories(250).map((n) => n.category.id)).toEqual(['Armor']) // non-enhanceable ring is the only __none
      expect(ids(d.names(100, 'OneHandSword', 'Sword', 'common'))).toEqual([1302000])
      expect(d.jobs(100, 'OneHandSword', 'Sword')).not.toContain('magician') // only the cash sword is magician
      expect(d.search('點裝')).toEqual([])
      expect(d.search('不可強化')).toEqual([])
      const reachable = ids(cascadeAll(d))
      for (const id of OUT_OF_SCOPE) expect(reachable).not.toContain(id)
      const picks = new Set<number>()
      for (let i = 0; i < 100; i++) picks.add(d.randomPick(() => i / 100)!.id)
      for (const id of OUT_OF_SCOPE) expect(picks.has(id)).toBe(false)
    })

    it('tool lists contain only canonical entries', async () => {
      const d = await loaded()
      expect(d.levelBuckets()).not.toContain(80) // only a non-canonical cap
      const reachable = ids(cascadeAll(d))
      expect([...reachable].sort()).toEqual([...TOOL_IDS].sort())
      for (const id of NON_CANONICAL) expect(reachable).not.toContain(id)
      expect(ids(d.search('綠色普通帽'))).toEqual([1002000])
      expect(d.search('活動帽')).toEqual([])
      const picks = new Set<number>()
      for (let i = 0; i < 100; i++) picks.add(d.randomPick(() => i / 100)!.id)
      expect([...picks].sort()).toEqual([...TOOL_IDS].sort())
    })

    it('loadEquip still loads ids outside the tool scope', async () => {
      const d = await loaded()
      expect((await d.loadEquip(1004500)).id).toBe(1004500) // cash
      expect((await d.loadEquip(1002001)).id).toBe(1002001) // non-canonical
    })
  })

  describe('search', () => {
    it('search matches names only, canonical only, never ids', async () => {
      const d = await loaded()
      expect(d.search('1002001')).toEqual([])
      expect(d.search('1005983')).toEqual([])
      const r = ids(d.search('帽'))
      for (const id of NON_CANONICAL) expect(r).not.toContain(id)
      expect(r).toContain(1002000)
    })

    it('handles a single CJK char, no match, empty query and Latin case-insensitively', async () => {
      const d = await loaded()
      expect(d.search('不存在的東西')).toEqual([])
      expect(d.search('   ')).toEqual([])
      expect(ids(d.search(' maple '))).toEqual([1003000])
    })

    it('sorts exact name first, then level desc, then id; applies limit', async () => {
      const d = await loaded()
      expect(ids(d.search('帽'))).toEqual([1003001, 1002999, 1002000])
      expect(d.search('帽', 2)).toHaveLength(2)
    })
  })

  describe('cascade', () => {
    it('option lists contain only non-empty values in fixed order', async () => {
      const d = await loaded()
      expect(d.levelBuckets()).toEqual([10, 30, 100, 250])
      // categories.json order, __none last
      expect(d.categories(100).map((n) => n.category.id)).toEqual(['Armor', 'OneHandSword', 'TwoHandSword', '__none'])
      // official order, only non-empty (Hat has nothing), null last
      expect(d.details(100, 'Armor')).toEqual(['Cap'])
      expect(d.details(100, 'OneHandSword')).toEqual(['Sword', null])
      expect(d.details(100, 'TwoHandSword')).toEqual(['Sword'])
      expect(d.details(100, '__none')).toEqual([null])
      expect(d.details(30, 'OneHandSword')).toEqual([])
      const files = mockFiles()
      files['index.json'] = [
        entry({ id: 1, name: 'c', searchDetail: 'Cap' }),
        entry({ id: 2, name: 'u', searchDetail: null }),
        entry({ id: 3, name: 'h', searchDetail: 'Hat' })
      ]
      const d2 = await loaded(mockFetch(files))
      expect(d2.details(100, 'Armor')).toEqual(['Hat', 'Cap', null])
    })

    it('categories node keeps the CategoryNode shape', async () => {
      const d = await loaded()
      const one = d.categories(100).find((n) => n.category.id === 'OneHandSword')!
      expect(one.details.map((x) => x.id)).toEqual(['Sword'])
      expect(one.hasUndetailed).toBe(true)
      const none = d.categories(100).find((n) => n.category.id === '__none')!
      expect(none.category.name).toBe('其他')
      expect(none.hasUndetailed).toBe(true)
    })

    it('names key by (category, detail); same detail id in two categories stays separate', async () => {
      const d = await loaded()
      expect(ids(d.names(100, 'OneHandSword', 'Sword', 'common'))).toEqual([1302000])
      expect(ids(d.names(100, 'TwoHandSword', 'Sword', 'common'))).toEqual([1402000])
      expect(ids(d.names(100, 'OneHandSword', null, 'common'))).toEqual([1302999])
      expect(ids(d.names(100, '__none', null, 'common'))).toEqual([1112000])
      expect(ids(d.names(100, 'Armor', 'Cap', 'common'))).toEqual([1002999]) // bucket 100 = Lv.100–109
    })

    it('jobs list depends on level/category/detail', async () => {
      const d = await loaded()
      expect(d.jobs(250, 'Armor', 'Cap')).toEqual(['common', 'warrior', 'thief'])
      expect(d.jobs(100, 'OneHandSword', 'Sword')).toEqual(['common', 'warrior'])
      expect(d.jobs(100, 'OneHandSword', null)).toEqual(['common', 'thief'])
      // jobs === 'all' items are wearable by every job → every job group is non-empty
      expect(d.jobs(100, '__none', null)).toEqual(JOB_CHOICES)
      expect(d.jobs(30, 'Armor', 'Cap')).toEqual(JOB_CHOICES)
      expect(d.jobs(30, 'OneHandSword', 'Sword')).toEqual([])
      // upper three levels do not take a job argument
      expect(d.levelBuckets.length).toBe(0)
      expect(d.categories.length).toBe(1)
      expect(d.details.length).toBe(2)
    })

    it('job common equals no filter; job includes common items', async () => {
      const d = await loaded()
      expect(ids(d.names(250, 'Armor', 'Cap', 'common'))).toEqual([1005983, 1005984])
      expect(ids(d.names(250, 'Armor', 'Cap', 'thief'))).toEqual([1005983])
      expect(ids(d.names(250, 'Armor', 'Cap', 'magician'))).toEqual([])
      // jobs === 'all' entries are included for a specific job
      expect(ids(d.names(10, 'Armor', 'Cap', 'thief'))).toEqual([1002000])
      expect(ids(d.names(100, '__none', null, 'pirate'))).toEqual([1112000])
    })

    it('every listed job yields a non-empty names list', async () => {
      const d = await loaded()
      for (const lv of d.levelBuckets())
        for (const c of d.categories(lv))
          for (const det of d.details(lv, c.category.id)) {
            const js = d.jobs(lv, c.category.id, det)
            expect(js[0]).toBe('common')
            for (const j of js) expect(d.names(lv, c.category.id, det, j).length).toBeGreaterThan(0)
            for (const j of JOB_CHOICES.filter((x) => !js.includes(x)))
              expect(d.names(lv, c.category.id, det, j)).toEqual([])
          }
    })

    it('pathOf matches cascade lists', async () => {
      const d = await loaded()
      expect(d.pathOf(INDEX.find((e) => e.id === 1302999)!)).toEqual({ level: 100, category: 'OneHandSword', detail: null })
      expect(d.pathOf(INDEX.find((e) => e.id === 1112000)!)).toEqual({ level: 100, category: '__none', detail: null })
      expect(d.pathOf(INDEX.find((e) => e.id === 1005983)!)).toEqual({ level: 250, category: 'Armor', detail: 'Cap' })
      for (const id of TOOL_IDS) {
        const e = INDEX.find((x) => x.id === id)!
        const p = d.pathOf(e)
        expect(d.levelBuckets()).toContain(p.level)
        expect(d.categories(p.level).map((n) => n.category.id)).toContain(p.category)
        expect(d.details(p.level, p.category)).toContain(p.detail)
        expect(ids(d.names(p.level, p.category, p.detail, 'common'))).toContain(id)
      }
    })
  })

  it('randomPick is deterministic with injected rng', async () => {
    const d = await loaded()
    expect(d.randomPick(() => 0)?.id).toBe(TOOL_IDS[0])
    expect(d.randomPick(() => 0.999)?.id).toBe(TOOL_IDS[TOOL_IDS.length - 1])
    expect(d.randomPick(() => 0.5)?.id).toBe(TOOL_IDS[5])
    expect(TOOL_IDS).toContain(d.randomPick()!.id)
  })

  it('categoryName and detailName', async () => {
    const d = await loaded()
    expect(d.categoryName('Armor')).toBe('防具')
    expect(d.categoryName('__none')).toBe('其他')
    expect(d.categoryName('Unknown')).toBe('Unknown')
    expect(d.detailName('Armor', 'Cap')).toBe('帽子')
    // same detail id, different category → that category's name
    expect(d.detailName('OneHandSword', 'Sword')).toBe('劍')
    expect(d.detailName('TwoHandSword', 'Sword')).toBe('大劍')
    expect(d.detailName('Armor', null)).toBe('(未分類)')
    expect(d.detailName('__none', null)).toBe('(未分類)')
    expect(d.detailName('Armor', 'Nope')).toBe('Nope')
  })

  describe('loadEquip', () => {
    it('caches per category file', async () => {
      const f = mockFetch()
      const d = await loaded(f)
      const [a, b] = await Promise.all([d.loadEquip(1002000), d.loadEquip(1005983)])
      expect(a.id).toBe(1002000)
      expect(b.level).toBe(250)
      await d.loadEquip(1002001) // non-canonical also loads
      expect(f.mock.calls.filter(([u]) => String(u).endsWith('equip/Cap.json'))).toHaveLength(1)
    })

    it('rejects for an unknown id', async () => {
      const d = await loaded()
      await expect(d.loadEquip(9999999)).rejects.toThrow(/9999999/)
    })

    it('rejects when the category file fails, and retries later', async () => {
      const failing = ['equip/Ring.json']
      const d = await loaded(mockFetch(mockFiles(), failing))
      await expect(d.loadEquip(1112000)).rejects.toThrow(/Ring\.json/)
      failing.length = 0
      expect((await d.loadEquip(1112000)).id).toBe(1112000)
    })
  })

  it('setInfo and jobName', async () => {
    const d = await loaded()
    expect(d.setInfo(889)?.name).toBe('永恆套裝')
    expect(d.setInfo(null)).toBeNull()
    expect(d.setInfo(12345)).toBeNull()
    expect(d.jobName(21)).toEqual({ name: '狂狼勇士', guess: false })
    expect(d.jobName(22)).toEqual({ name: '龍魔導士', guess: true })
    expect(d.jobName(null)).toBeNull()
  })
})

describe('smoke: real public data', () => {
  const PUBLIC = '/data/tms-v283'
  const diskFetch = (async (input: RequestInfo | URL) => {
    const rel = String(input).slice(PUBLIC.length + 1)
    try {
      const text = readFileSync(DATA_DIR + rel, 'utf8')
      return { ok: true, status: 200, json: async () => JSON.parse(text) } as Response
    } catch {
      return { ok: false, status: 404, json: async () => ({}) } as Response
    }
  }) as typeof fetch

  it('searches, loads and walks the cascade on real data within the tool scope', async () => {
    const d = useEquipData(PUBLIC, diskFetch)
    await d.load()
    expect(d.error.value).toBeNull()
    expect(d.meta.value?.dataVersion).toBe('TMS v283')
    expect(ids(d.search('永恆'))).toContain(1005983)
    const eq = await d.loadEquip(1005983)
    expect(eq.level).toBe(250)
    const info = d.setInfo(eq.setId)
    expect(info).not.toBeNull()
    expect(Object.keys(info!.effects).length).toBeGreaterThan(0)

    // Every cascade path is non-empty all the way down, and only tool-scope entries appear.
    let total = 0
    for (const lv of d.levelBuckets()) {
      const cats = d.categories(lv)
      expect(cats.length).toBeGreaterThan(0)
      for (const c of cats) {
        const dets = d.details(lv, c.category.id)
        expect(dets.length).toBeGreaterThan(0)
        for (const det of dets) {
          const js = d.jobs(lv, c.category.id, det)
          expect(js[0]).toBe('common')
          const all = d.names(lv, c.category.id, det, 'common')
          expect(all.length).toBeGreaterThan(0)
          for (const e of all) expect(e.canonical && !e.cash && e.enhanceable).toBe(true)
          total += all.length
        }
      }
    }
    const expected = d.index.value.filter((e) => e.canonical && !e.cash && e.enhanceable).length
    expect(total).toBe(expected)
    const pick = d.randomPick(() => 0.5)!
    expect(pick.canonical && !pick.cash && pick.enhanceable).toBe(true)
    expect(d.detailName(pick.searchCategory ?? '__none', pick.searchCategory === null ? null : pick.searchDetail)).not.toBe('')
  })
})

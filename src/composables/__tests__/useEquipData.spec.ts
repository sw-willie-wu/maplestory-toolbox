import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { computed } from 'vue'
import { DATA_DIR } from '@/utils/mst/enhance/__tests__/helpers'
import type { IndexEntry, JobsData, SearchCategory, SetInfo } from '@/utils/mst/enhance/types'
import { DEFAULT_FILTER, useEquipData, type EquipFilter } from '../useEquipData'

const BASE = '/data/test'

function entry(p: Partial<IndexEntry> & Pick<IndexEntry, 'id' | 'name'>): IndexEntry {
  return {
    category: 'Cap',
    slot: 'Cp',
    level: 100,
    cash: false,
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
  // Same detail id "Sword" under two categories.
  entry({ id: 1302000, name: '單手劍甲', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: 'Sword' }),
  entry({ id: 1402000, name: '雙手劍乙', category: 'Weapon', slot: 'WpSi', level: 100, searchCategory: 'TwoHandSword', searchDetail: 'Sword' }),
  entry({ id: 1302999, name: '單手劍無細類', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: null }),
  entry({ id: 1112000, name: '神秘戒指', category: 'Ring', slot: 'Ri', level: 100, searchCategory: null, searchDetail: null, specJob: 22 })
]

const CATEGORIES: SearchCategory[] = [
  { id: 'Armor', name: '防具', details: [{ id: 'Cap', name: '帽子', begin: 1000000, end: 1009999, ranges: [[1000000, 1009999]] }] },
  { id: 'OneHandSword', name: '單手武器', details: [{ id: 'Sword', name: '劍', begin: 1302000, end: 1302999, ranges: [[1302000, 1302999]] }] },
  { id: 'TwoHandSword', name: '雙手武器', details: [{ id: 'Sword', name: '劍', begin: 1402000, end: 1402999, ranges: [[1402000, 1402999]] }] }
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
const VARIANTS: EquipFilter = { ...DEFAULT_FILTER, includeVariants: true }

describe('useEquipData', () => {
  it('DEFAULT_FILTER is all off', () => {
    expect(DEFAULT_FILTER).toEqual({ scrollable: false, includeVariants: false, job: null, setOnly: false })
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
    const buckets = computed(() => d.levelBuckets(VARIANTS))
    const variant = INDEX.find((e) => e.id === 1002001)!
    const label = computed(() => d.displayName(variant))
    const set = computed(() => d.setInfo(889)?.name ?? null)
    const slot = computed(() => d.slotName('Cp'))
    const job = computed(() => d.jobName(22))
    expect(buckets.value).toEqual([])
    expect(label.value).toBe('綠色普通帽（數值不同）')
    expect(set.value).toBeNull()
    expect(slot.value).toBe('Cp')
    expect(job.value).toBeNull()
    await d.load()
    expect(buckets.value).toEqual([10, 30, 100, 250])
    expect(label.value).toBe('綠色普通帽（數值不同 #1002001）')
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

  describe('search', () => {
    it('handles a single CJK char, no match and empty query', async () => {
      const d = await loaded()
      expect(ids(d.search('帽', DEFAULT_FILTER))).toContain(1002000)
      expect(d.search('不存在的東西', DEFAULT_FILTER)).toEqual([])
      expect(d.search('   ', DEFAULT_FILTER)).toEqual([])
    })

    it('matches a numeric id exactly and Latin case-insensitively', async () => {
      const d = await loaded()
      expect(ids(d.search('1005983', DEFAULT_FILTER))).toEqual([1005983])
      expect(ids(d.search(' maple ', DEFAULT_FILTER))).toEqual([1003000])
    })

    it('sorts exact name first, then canonical, level desc, id', async () => {
      const d = await loaded()
      const r = ids(d.search('帽', VARIANTS))
      expect(r[0]).toBe(1003001) // exact name「帽」
      // canonical before variants; among canonical level desc; then id
      expect(r.slice(1, 3)).toEqual([1002999, 1002000])
      expect(r.slice(3)).toEqual([1002001, 1002002, 1002004])
    })

    it('orders a non-canonical exact name match ahead of a canonical partial match', async () => {
      const files = mockFiles()
      files['index.json'] = [
        entry({ id: 1004000, name: '黃色帽子', level: 200 }),
        entry({ id: 1004001, name: '帽子', level: 10, canonical: false, variantLabel: '活動版' })
      ]
      const d = await loaded(mockFetch(files))
      expect(ids(d.search('帽子', VARIANTS))).toEqual([1004001, 1004000])
    })

    it('a numeric id query returns that entry even when hidden by includeVariants=false; other filters apply', async () => {
      const d = await loaded()
      expect(ids(d.search('1002001', DEFAULT_FILTER))).toEqual([1002001]) // labelled variant
      expect(ids(d.search('1002003', DEFAULT_FILTER))).toEqual([1002003]) // ''-label duplicate
      expect(ids(d.search('1002001', VARIANTS))).toEqual([1002001])
      expect(d.search('1002999', { ...DEFAULT_FILTER, scrollable: true })).toEqual([])
      expect(d.search('1002001', { ...DEFAULT_FILTER, setOnly: true })).toEqual([])
    })

    it('applies filter and limit', async () => {
      const d = await loaded()
      expect(ids(d.search('永恆', { ...DEFAULT_FILTER, job: 'thief' }))).toEqual([1005983])
      expect(ids(d.search('帽', { ...DEFAULT_FILTER, scrollable: true }))).not.toContain(1002999)
      expect(ids(d.search('帽', { ...DEFAULT_FILTER, setOnly: true }))).toEqual([])
      expect(d.search('帽', DEFAULT_FILTER, 2)).toHaveLength(2)
    })
  })

  describe('variants', () => {
    it('default filter returns only canonical entries', async () => {
      const d = await loaded()
      expect(ids(d.search('綠色普通帽', DEFAULT_FILTER))).toEqual([1002000])
      expect(ids(d.names(10, 'Armor', 'Cap', DEFAULT_FILTER))).toEqual([1002000])
    })

    it('includeVariants shows labelled variants, drops empty-label duplicates, appends #id on duplicate labels', async () => {
      const d = await loaded()
      const r = d.search('綠色普通帽', VARIANTS)
      expect(ids(r)).toEqual([1002000, 1002001, 1002002, 1002004])
      expect(r.map(d.displayName)).toEqual([
        '綠色普通帽',
        '綠色普通帽（數值不同 #1002001）',
        '綠色普通帽（數值不同 #1002002）',
        '綠色普通帽（活動版）'
      ])
      expect(ids(d.names(10, 'Armor', 'Cap', VARIANTS))).not.toContain(1002003)
    })

    it('duplicate-label #id grouping keys by (slot, name, cash)', async () => {
      const files = mockFiles()
      files['index.json'] = [
        entry({ id: 1006000, name: '測試帽' }),
        entry({ id: 1006001, name: '測試帽', canonical: false, variantLabel: '期限' }),
        entry({ id: 1006002, name: '測試帽', cash: true }),
        entry({ id: 1006003, name: '測試帽', cash: true, canonical: false, variantLabel: '期限' })
      ]
      const d = await loaded(mockFetch(files))
      expect(d.search('測試帽', VARIANTS).map(d.displayName)).toEqual([
        '測試帽',
        '測試帽',
        '測試帽（期限）',
        '測試帽（期限）'
      ])
    })
  })

  it('levelBuckets are sorted 10-level ranges', async () => {
    const d = await loaded()
    expect(d.levelBuckets(DEFAULT_FILTER)).toEqual([10, 30, 100, 250])
    expect(d.levelBuckets({ ...DEFAULT_FILTER, setOnly: true })).toEqual([250])
  })

  describe('categories / names key by (category, detail)', () => {
    it('groups official categories and a synthetic 其他 for null category', async () => {
      const d = await loaded()
      const nodes = d.categories(100, DEFAULT_FILTER)
      expect(nodes.map((n) => n.category.id)).toEqual(['Armor', 'OneHandSword', 'TwoHandSword', '__none'])
      expect(nodes.find((n) => n.category.id === 'Armor')!.details.map((x) => x.id)).toEqual(['Cap'])
      const one = nodes.find((n) => n.category.id === 'OneHandSword')!
      expect(one.details.map((x) => x.id)).toEqual(['Sword'])
      expect(one.hasUndetailed).toBe(true)
      const two = nodes.find((n) => n.category.id === 'TwoHandSword')!
      expect(two.hasUndetailed).toBe(false)
      const none = nodes.find((n) => n.category.id === '__none')!
      expect(none.category.name).toBe('其他')
      expect(none.details).toEqual([])
      expect(none.hasUndetailed).toBe(true)
    })

    it('names filters by both category and detail', async () => {
      const d = await loaded()
      expect(ids(d.names(100, 'OneHandSword', 'Sword', DEFAULT_FILTER))).toEqual([1302000])
      expect(ids(d.names(100, 'TwoHandSword', 'Sword', DEFAULT_FILTER))).toEqual([1402000])
      expect(ids(d.names(100, 'OneHandSword', null, DEFAULT_FILTER))).toEqual([1302999])
      expect(ids(d.names(100, '__none', null, DEFAULT_FILTER))).toEqual([1112000])
    })

    it('categories respects the filter', async () => {
      const d = await loaded()
      expect(d.categories(250, { ...DEFAULT_FILTER, job: 'warrior' }).map((n) => n.category.id)).toEqual(['Armor'])
      expect(d.categories(250, { ...DEFAULT_FILTER, job: 'magician' })).toEqual([])
    })
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

  it('searches, loads and groups real data', async () => {
    const d = useEquipData(PUBLIC, diskFetch)
    await d.load()
    expect(d.error.value).toBeNull()
    expect(d.meta.value?.dataVersion).toBe('TMS v283')
    expect(ids(d.search('永恆', DEFAULT_FILTER))).toContain(1005983)
    const eq = await d.loadEquip(1005983)
    expect(eq.level).toBe(250)
    expect(d.categories(250, DEFAULT_FILTER).length).toBeGreaterThan(0)
    const info = d.setInfo(eq.setId)
    expect(info).not.toBeNull()
    expect(Object.keys(info!.effects).length).toBeGreaterThan(0)
  })
})

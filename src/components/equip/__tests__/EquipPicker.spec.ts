import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import EquipPicker from '../EquipPicker.vue'
import { useEquipData } from '@/composables/useEquipData'
import type { IndexEntry, JobsData, SearchCategory } from '@/utils/mst/enhance/types'

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
  entry({ id: 1002000, name: '綠色普通帽', level: 5 }),
  entry({ id: 1002001, name: '綠色普通帽', level: 5, canonical: false, variantLabel: '活動版' }),
  // bucket 100: Armor/Cap (all + warrior), Armor/Hat (magician), OneHandSword/Sword (warrior), OneHandSword/null (thief), 其他
  entry({ id: 1003100, name: '百級共用帽', level: 100 }),
  entry({ id: 1003101, name: '百級戰士帽', level: 105, jobs: ['warrior'] }),
  entry({ id: 1012000, name: '百級法師頭飾', level: 100, searchDetail: 'Hat', jobs: ['magician'] }),
  entry({ id: 1302000, name: '單手劍甲', category: 'Weapon', slot: 'Wp', searchCategory: 'OneHandSword', searchDetail: 'Sword', jobs: ['warrior'] }),
  entry({ id: 1302999, name: '單手劍無細類', category: 'Weapon', slot: 'Wp', searchCategory: 'OneHandSword', searchDetail: null, jobs: ['thief'] }),
  entry({ id: 1112000, name: '神秘戒指', category: 'Ring', slot: 'Ri', searchCategory: null, searchDetail: null }),
  // bucket 250
  entry({ id: 1005983, name: '永恆盜賊頭巾', level: 250, jobs: ['thief'] }),
  entry({ id: 1005984, name: '永恆戰士頭盔', level: 250, jobs: ['warrior'] }),
  entry({ id: 1005985, name: '永恆共用帽', level: 250 }),
  // bucket 160: only reachable through 其他
  entry({ id: 1113000, name: '孤單戒指', category: 'Ring', slot: 'Ri', level: 160, searchCategory: null, searchDetail: null }),
  // bucket 110: same name + same level, different detail (one-handed vs two-handed sword)
  entry({ id: 1302108, name: '星之劍', category: 'Weapon', slot: 'Wp', level: 115, searchCategory: 'OneHandSword', searchDetail: 'Sword', jobs: ['warrior'] }),
  entry({ id: 1402054, name: '星之劍', category: 'Weapon', slot: 'WpSi', level: 115, searchCategory: 'TwoHandSword', searchDetail: 'Sword', jobs: ['warrior'] })
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

const JOBS: JobsData = { groups: [], specJobs: [] }

function mockFetch() {
  const files: Record<string, unknown> = {
    'meta.json': { dataVersion: 'TMS v283' },
    'index.json': INDEX,
    'slot-names.json': {},
    'sets.json': {},
    'categories.json': CATEGORIES,
    'jobs.json': JOBS
  }
  return vi.fn(async (input: RequestInfo | URL) => {
    const rel = String(input).slice(BASE.length + 1)
    if (!(rel in files)) return { ok: false, status: 404, json: async () => ({}) } as Response
    return { ok: true, status: 200, json: async () => structuredClone(files[rel]) } as Response
  })
}

type Picker = VueWrapper<InstanceType<typeof EquipPicker>>
let wrapper: Picker | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

async function setup(selectedId: number | null = null) {
  const data = useEquipData(BASE, mockFetch() as unknown as typeof fetch)
  await data.load()
  wrapper = mount(EquipPicker, { props: { data, selectedId }, attachTo: document.body }) as Picker
  await flushPromises()
  return { w: wrapper, data }
}

const sel = (w: Picker, name: string) => w.get<HTMLSelectElement>(`[data-test="${name}"]`)
const val = (w: Picker, name: string) => sel(w, name).element.value
const opts = (w: Picker, name: string) => sel(w, name).findAll('option').map((o) => o.element.value)
const labels = (w: Picker, name: string) => sel(w, name).findAll('option').map((o) => o.text())
const emitted = (w: Picker) => (w.emitted('select') ?? []).map((a) => a[0] as number)

describe('EquipPicker', () => {
  it('renders labels and level/job option labels', async () => {
    const { w } = await setup()
    const text = w.text()
    for (const l of ['等級', '分類', '部位', '職業', '裝備']) expect(text).toContain(l)
    expect(labels(w, 'level')).toEqual(['Lv.0–9', 'Lv.100–109', 'Lv.110–119', 'Lv.160–169', 'Lv.250–259'])
    await sel(w, 'level').setValue('250')
    expect(labels(w, 'job')).toEqual(['共用', '劍士', '法師', '弓箭手', '盜賊', '海盜'])
    await sel(w, 'level').setValue('100')
    await sel(w, 'category').setValue('OneHandSword')
    expect(labels(w, 'job')).toEqual(['共用', '劍士'])
  })

  it('changing level selects first category/detail/equip and emits', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('100')
    expect(val(w, 'category')).toBe('Armor')
    expect(val(w, 'detail')).toBe('Hat') // official order: Hat before Cap
    expect(val(w, 'job')).toBe('common')
    expect(val(w, 'equip')).toBe('1012000')
    expect(emitted(w)).toEqual([1012000])

    await sel(w, 'category').setValue('OneHandSword')
    expect(val(w, 'detail')).toBe('Sword')
    expect(val(w, 'equip')).toBe('1302000')
    expect(emitted(w)).toEqual([1012000, 1302000])

    await sel(w, 'equip').setValue(val(w, 'equip'))
    expect(emitted(w).at(-1)).toBe(1302000)
  })

  it('no placeholder options and no empty parents', async () => {
    const { w } = await setup()
    const names = ['level', 'category', 'detail', 'job', 'equip']
    const check = () => {
      for (const n of names) {
        const values = opts(w, n)
        expect(values.length, n).toBeGreaterThan(0)
        expect(values.every((v) => v !== ''), n).toBe(true)
        expect(val(w, n), n).not.toBe('')
      }
    }
    check()
    for (const lv of opts(w, 'level')) {
      await sel(w, 'level').setValue(lv)
      check()
      for (const c of opts(w, 'category')) {
        await sel(w, 'category').setValue(c)
        check()
        for (const d of opts(w, 'detail')) {
          await sel(w, 'detail').setValue(d)
          check()
          for (const j of opts(w, 'job')) {
            await sel(w, 'job').setValue(j)
            check()
          }
        }
      }
    }
  })

  it('cascade reaches an equip through 其他/(未分類)', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('160') // only 其他 in this bucket
    expect(labels(w, 'category')).toEqual(['其他'])
    expect(labels(w, 'detail')).toEqual(['(未分類)'])
    expect(val(w, 'equip')).toBe('1113000')
    expect(emitted(w)).toEqual([1113000])

    await sel(w, 'level').setValue('100')
    await sel(w, 'category').setValue('__none')
    expect(labels(w, 'detail')).toEqual(['(未分類)'])
    expect(val(w, 'equip')).toBe('1112000')

    await sel(w, 'category').setValue('OneHandSword')
    expect(labels(w, 'detail')).toEqual(['劍', '(未分類)'])
    await sel(w, 'detail').setValue(opts(w, 'detail')[1])
    expect(val(w, 'equip')).toBe('1302999')
    expect(emitted(w).at(-1)).toBe(1302999)
  })

  it('job keeps selection on parent change; falls back to common when empty', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('100')
    await sel(w, 'detail').setValue('Cap')
    await sel(w, 'job').setValue('warrior')
    expect(labels(w, 'equip')).toEqual(['百級共用帽', '百級戰士帽'])
    expect(emitted(w).at(-1)).toBe(1003100)

    await sel(w, 'category').setValue('OneHandSword') // Sword: warrior wearable → keep
    expect(val(w, 'job')).toBe('warrior')
    expect(val(w, 'equip')).toBe('1302000')

    await sel(w, 'detail').setValue(opts(w, 'detail')[1]) // (未分類): thief only → common
    expect(val(w, 'job')).toBe('common')
    expect(val(w, 'equip')).toBe('1302999')
    expect(emitted(w).at(-1)).toBe(1302999)
  })

  async function search(w: Picker, q: string) {
    const input = w.get<HTMLInputElement>('[data-test="search"]')
    await input.trigger('focus')
    await input.setValue(q)
    return input
  }

  it('search pick syncs path and keeps compatible job', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('100')
    await sel(w, 'detail').setValue('Cap')
    await sel(w, 'job').setValue('warrior')
    const before = emitted(w).length

    await search(w, '永恆')
    const items = w.findAll('[data-test="search-result"]')
    expect(items.map((i) => i.get('[data-test="search-name"]').text())).toEqual(expect.arrayContaining(['永恆戰士頭盔', '永恆盜賊頭巾', '永恆共用帽']))
    await items.find((i) => i.get('[data-test="search-name"]').text() === '永恆共用帽')!.trigger('click')

    expect(val(w, 'level')).toBe('250')
    expect(val(w, 'category')).toBe('Armor')
    expect(val(w, 'detail')).toBe('Cap')
    expect(val(w, 'job')).toBe('warrior') // 'all' is wearable by warrior
    expect(val(w, 'equip')).toBe('1005985')
    expect(emitted(w).slice(before)).toEqual([1005985])
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(0)
  })

  it('search pick resets incompatible job to common', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('100')
    await sel(w, 'detail').setValue('Cap')
    await sel(w, 'job').setValue('warrior')

    await search(w, '永恆盜賊')
    await w.get('[data-test="search-result"]').trigger('click')
    expect(val(w, 'job')).toBe('common')
    expect(val(w, 'level')).toBe('250')
    expect(val(w, 'equip')).toBe('1005983')
    expect(emitted(w).at(-1)).toBe(1005983)
  })

  it('search keyboard: ArrowDown+Enter selects; Escape closes', async () => {
    const { w } = await setup()
    const input = await search(w, '永恆')
    const results = w.findAll('[data-test="search-result"]').map((r) => r.get('[data-test="search-name"]').text())
    expect(results.length).toBe(3)
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(w.findAll('[data-test="search-result"]')[1].classes()).toContain('is-active')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    const picked = INDEX.find((e) => e.name === results[1])!.id
    expect(emitted(w).at(-1)).toBe(picked)
    expect(val(w, 'equip')).toBe(String(picked))
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(0)

    await search(w, '永恆')
    expect(w.findAll('[data-test="search-result"]').length).toBe(3)
    await input.trigger('keydown', { key: 'Escape' })
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(0)
  })

  it('search list closes 150ms after blur', async () => {
    const { w } = await setup()
    vi.useFakeTimers()
    const input = await search(w, '永恆')
    await input.trigger('blur')
    vi.advanceTimersByTime(100)
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="search-result"]').length).toBe(3)
    vi.advanceTimersByTime(60)
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(0)
  })

  it('search rows show the detail name so same-name same-level items are distinguishable', async () => {
    const { w } = await setup()
    await search(w, '星之劍')
    const items = w.findAll('[data-test="search-result"]')
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.get('[data-test="search-name"]').text())).toEqual(['星之劍', '星之劍'])
    expect(items.map((i) => i.get('[data-test="search-detail"]').text())).toEqual(['劍', '大劍'])
  })

  it('search lists canonical entries only', async () => {
    const { w } = await setup()
    await search(w, '綠色普通帽')
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(1)
  })

  it('syncTo sets the path without emitting', async () => {
    const { w } = await setup()
    await sel(w, 'level').setValue('250')
    await sel(w, 'job').setValue('thief')
    const before = emitted(w).length
    w.vm.syncTo(1302000) // warrior-only → job resets
    await w.vm.$nextTick()
    expect(val(w, 'level')).toBe('100')
    expect(val(w, 'category')).toBe('OneHandSword')
    expect(val(w, 'detail')).toBe('Sword')
    expect(val(w, 'job')).toBe('common')
    expect(val(w, 'equip')).toBe('1302000')
    expect(emitted(w).length).toBe(before)
  })

  it('initial selectedId sets the cascade', async () => {
    const { w } = await setup(1112000)
    expect(val(w, 'level')).toBe('100')
    expect(val(w, 'category')).toBe('__none')
    expect(val(w, 'equip')).toBe('1112000')
    expect(emitted(w)).toEqual([])
  })

  it('no variant toggle rendered', async () => {
    const { w } = await setup()
    expect(w.text()).not.toContain('包含活動')
    expect(w.find('[role="switch"]').exists()).toBe(false)
  })
})

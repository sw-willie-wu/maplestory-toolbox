import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import EquipSelector from '../EquipSelector.vue'
import { useEquipData } from '@/composables/useEquipData'
import type { IndexEntry, JobsData, SearchCategory } from '@/utils/mst/enhance/types'

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
  entry({ id: 1002000, name: '綠色普通帽', level: 5 }),
  entry({ id: 1002004, name: '綠色普通帽', level: 5, canonical: false, variantLabel: '活動版' }),
  entry({ id: 1005983, name: '永恆盜賊頭巾', level: 250, tuc: 12, setId: 889, jobs: ['thief'] }),
  entry({ id: 1005984, name: '永恆戰士頭盔', level: 250, tuc: 12, setId: 889, jobs: ['warrior'] }),
  entry({ id: 1002999, name: '無卷帽', level: 105, tuc: 0 }),
  entry({ id: 1302000, name: '單手劍甲', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: 'Sword' }),
  entry({ id: 1302999, name: '單手劍無細類', category: 'Weapon', slot: 'Wp', level: 100, searchCategory: 'OneHandSword', searchDetail: null })
]

const CATEGORIES: SearchCategory[] = [
  { id: 'Armor', name: '防具', details: [{ id: 'Cap', name: '帽子', begin: 1000000, end: 1009999, ranges: [[1000000, 1009999]] }] },
  { id: 'OneHandSword', name: '單手武器', details: [{ id: 'Sword', name: '劍', begin: 1302000, end: 1302999, ranges: [[1302000, 1302999]] }] }
]

const JOBS: JobsData = { groups: [], specJobs: [] }

const FILES: Record<string, unknown> = {
  'meta.json': { dataVersion: 'TMS test' },
  'index.json': INDEX,
  'slot-names.json': {},
  'sets.json': {},
  'categories.json': CATEGORIES,
  'jobs.json': JOBS
}

const mockFetch = (async (input: RequestInfo | URL) => {
  const rel = String(input).replace('/data/test/', '')
  if (!(rel in FILES)) return { ok: false, status: 404, json: async () => ({}) } as Response
  return { ok: true, status: 200, json: async () => structuredClone(FILES[rel]) } as Response
}) as typeof fetch

async function setup() {
  const data = useEquipData('/data/test', mockFetch)
  await data.load()
  const w = mount(EquipSelector, { props: { data } })
  await flushPromises()
  return w
}

const optionTexts = (w: Awaited<ReturnType<typeof setup>>, sel: string) =>
  w.find(sel).findAll('option').map((o) => o.text())

describe('EquipSelector', () => {
  it('labels level buckets (bucket 0 as Lv.0–9)', async () => {
    const w = await setup()
    const labels = optionTexts(w, '[data-test="level"]')
    expect(labels).toContain('Lv.0–9')
    expect(labels).toContain('Lv.100–109')
    expect(labels).toContain('Lv.250–259')
  })

  it('cascade emits select with the chosen id', async () => {
    const w = await setup()
    await w.find('[data-test="level"]').setValue('100')
    expect(optionTexts(w, '[data-test="category"]')).toEqual(expect.arrayContaining(['防具', '單手武器']))
    await w.find('[data-test="category"]').setValue('OneHandSword')
    const details = optionTexts(w, '[data-test="detail"]')
    expect(details).toContain('劍')
    expect(details).toContain('(未分類)')
    await w.find('[data-test="detail"]').setValue('Sword')
    expect(optionTexts(w, '[data-test="name"]')).toContain('單手劍甲')
    await w.find('[data-test="name"]').setValue('1302000')
    expect(w.emitted('select')).toEqual([[1302000]])
  })

  it('lists undetailed items under (未分類)', async () => {
    const w = await setup()
    await w.find('[data-test="level"]').setValue('100')
    await w.find('[data-test="category"]').setValue('OneHandSword')
    const undetailed = w.find('[data-test="detail"]').findAll('option').find((o) => o.text() === '(未分類)')!
    await w.find('[data-test="detail"]').setValue(undetailed.element.value)
    expect(optionTexts(w, '[data-test="name"]')).toEqual(expect.arrayContaining(['單手劍無細類']))
    expect(optionTexts(w, '[data-test="name"]')).not.toContain('單手劍甲')
  })

  it('includeVariants chip toggles variant entries', async () => {
    const w = await setup()
    await w.find('[data-test="level"]').setValue('0')
    await w.find('[data-test="category"]').setValue('Armor')
    await w.find('[data-test="detail"]').setValue('Cap')
    expect(optionTexts(w, '[data-test="name"]')).not.toContain('綠色普通帽（活動版）')
    const chip = w.find('[data-test="chip-variants"]')
    expect((chip.element as HTMLInputElement).checked).toBe(false)
    await chip.setValue(true)
    expect(optionTexts(w, '[data-test="name"]')).toContain('綠色普通帽（活動版）')
    await chip.setValue(false)
    expect(optionTexts(w, '[data-test="name"]')).not.toContain('綠色普通帽（活動版）')
  })

  it('filters by scrollable, set and job', async () => {
    const w = await setup()
    await w.find('[data-test="search"]').setValue('帽')
    expect(w.findAll('[data-test="search-result"]').map((r) => r.text())).toContain('無卷帽')
    await w.find('[data-test="chip-scrollable"]').setValue(true)
    expect(w.findAll('[data-test="search-result"]').map((r) => r.text())).not.toContain('無卷帽')

    await w.find('[data-test="search"]').setValue('永恆')
    await w.find('[data-test="job"]').setValue('thief')
    let results = w.findAll('[data-test="search-result"]').map((r) => r.text())
    expect(results).toContain('永恆盜賊頭巾')
    expect(results).not.toContain('永恆戰士頭盔')

    await w.find('[data-test="job"]').setValue('')
    await w.find('[data-test="search"]').setValue('帽')
    await w.find('[data-test="chip-set"]').setValue(true)
    results = w.findAll('[data-test="search-result"]').map((r) => r.text())
    expect(results).toEqual([])
  })

  it('search result click emits select and clears the query', async () => {
    const w = await setup()
    await w.find('[data-test="search"]').setValue('盜賊')
    const hit = w.findAll('[data-test="search-result"]').find((r) => r.text() === '永恆盜賊頭巾')!
    await hit.trigger('click')
    expect(w.emitted('select')).toEqual([[1005983]])
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('')
    expect(w.findAll('[data-test="search-result"]')).toHaveLength(0)
  })

  it('clears the name dropdown when an item is picked by search', async () => {
    const w = await setup()
    await w.find('[data-test="level"]').setValue('100')
    await w.find('[data-test="category"]').setValue('OneHandSword')
    await w.find('[data-test="detail"]').setValue('Sword')
    await w.find('[data-test="name"]').setValue('1302000')
    await w.find('[data-test="search"]').setValue('盜賊')
    await w.findAll('[data-test="search-result"]')[0].trigger('click')
    expect((w.find('[data-test="name"]').element as HTMLSelectElement).value).toBe('')
  })

  it('resets dropdown choices that a filter removes', async () => {
    const w = await setup()
    await w.find('[data-test="level"]').setValue('100')
    await w.find('[data-test="category"]').setValue('OneHandSword')
    await w.find('[data-test="chip-set"]').setValue(true)
    expect((w.find('[data-test="level"]').element as HTMLSelectElement).value).toBe('')
    expect(w.find('[data-test="category"]').attributes('disabled')).toBeDefined()
  })
})

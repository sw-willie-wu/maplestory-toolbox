import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import EquipEnhanceView from '../EquipEnhanceView.vue'
import EquipSelector from '@/components/equip/EquipSelector.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import EnhanceEditor from '@/components/equip/EnhanceEditor.vue'
import { DATA_DIR } from '@/utils/mst/enhance/__tests__/helpers'

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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EquipEnhanceView', () => {
  it('shows data version from meta', async () => {
    vi.stubGlobal('fetch', diskFetch)
    const w = mount(EquipEnhanceView)
    await flushPromises()
    expect(w.find('[data-test="data-version"]').text()).toContain('資料版本：TMS v283')
  })

  it('shows the load error message', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response) as typeof fetch)
    const w = mount(EquipEnhanceView)
    await flushPromises()
    expect(w.find('[data-test="load-error"]').text()).toContain('HTTP 500')
  })

  it('renders the tooltip for the selected equipment', async () => {
    vi.stubGlobal('fetch', diskFetch)
    const w = mount(EquipEnhanceView)
    await flushPromises()
    expect(w.findComponent(EquipTooltip).exists()).toBe(false)
    w.findComponent(EquipSelector).vm.$emit('select', 1113211)
    await flushPromises()
    const tip = w.findComponent(EquipTooltip)
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toContain('天上的氣息')
    expect(tip.text()).toContain('Lv.150')
    // Unenhanced: base value only, every star dark.
    expect(tip.findAll('.star.lit')).toHaveLength(0)
    expect(tip.findAll('.star')).toHaveLength(30)
  })
})

describe('EquipEnhanceView with the editor', () => {
  async function selected(id: number, fetchImpl: typeof fetch = diskFetch) {
    vi.stubGlobal('fetch', fetchImpl)
    const w = mount(EquipEnhanceView)
    await flushPromises()
    w.findComponent(EquipSelector).vm.$emit('select', id)
    await flushPromises()
    return w
  }
  const statLine = (w: Awaited<ReturnType<typeof selected>>, label: string) =>
    w
      .findComponent(EquipTooltip)
      .findAll('[data-test="stat-line"]')
      .find((l) => l.find('.stat-label').text() === label)!
      .text()

  it('replaces the placeholder with the editor', async () => {
    const w = await selected(1113211)
    expect(w.find('[data-test="editor-placeholder"]').exists()).toBe(false)
    expect(w.findComponent(EnhanceEditor).exists()).toBe(true)
  })

  it('updates the tooltip when the editor changes the star (B follows C)', async () => {
    const w = await selected(1113211)
    expect(statLine(w, 'STR')).toBe('STR+25')
    await w.find('[data-test="tab-starforce"]').trigger('click')
    await w.find('[data-test="sf-target"]').setValue('25')
    await flushPromises()
    expect(statLine(w, 'STR')).toContain('+142')
    expect(statLine(w, 'STR')).toContain('(25 +117)')
    expect(w.findComponent(EquipTooltip).findAll('.star.lit')).toHaveLength(25)
  })

  it('resets the enhancement state when another item is selected', async () => {
    const w = await selected(1113211)
    await w.find('[data-test="sf-target"]').setValue('10')
    await flushPromises()
    expect(w.findComponent(EquipTooltip).findAll('.star.lit')).toHaveLength(10)
    w.findComponent(EquipSelector).vm.$emit('select', 1005983)
    await flushPromises()
    expect(w.findComponent(EquipTooltip).text()).toContain('永恆盜賊頭巾')
    expect(w.findComponent(EquipTooltip).findAll('.star.lit')).toHaveLength(0)
    expect((w.find('[data-test="sf-target"]').element as HTMLInputElement).value).toBe('0')
  })

  it('keeps the latest selection when an earlier load resolves last (race guard)', async () => {
    const gates = new Map<string, () => void>()
    const gatedFetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/equip/')) await new Promise<void>((r) => gates.set(url.slice(url.lastIndexOf('/') + 1), r))
      return diskFetch(input)
    }) as typeof fetch
    vi.stubGlobal('fetch', gatedFetch)
    const w = mount(EquipEnhanceView)
    await flushPromises()
    const sel = w.findComponent(EquipSelector)
    sel.vm.$emit('select', 1113211) // Ring.json
    await flushPromises()
    sel.vm.$emit('select', 1005983) // Cap.json
    await flushPromises()
    expect([...gates.keys()].sort()).toEqual(['Cap.json', 'Ring.json'])
    gates.get('Cap.json')!()
    await flushPromises()
    gates.get('Ring.json')!()
    await flushPromises()
    expect(w.findComponent(EquipTooltip).text()).toContain('永恆盜賊頭巾')
    expect(w.findComponent(EquipTooltip).text()).not.toContain('天上的氣息')
  })

  describe('mobile layout', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })
    const mobileMatchMedia = (query: string) =>
      ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList

    it('shows the compact tooltip pinned on top and expands / collapses it', async () => {
      vi.stubGlobal('matchMedia', mobileMatchMedia)
      const w = await selected(1113211)
      const pinned = w.find('[data-test="tooltip-pin"]')
      expect(pinned.classes()).toContain('mobile')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(true)
      await w.find('[data-test="tooltip-toggle"]').trigger('click')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(false)
      await w.find('[data-test="tooltip-toggle"]').trigger('click')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(true)
    })

    it('uses the full tooltip without a toggle on desktop', async () => {
      const w = await selected(1113211)
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(false)
      expect(w.find('[data-test="tooltip-toggle"]').exists()).toBe(false)
    })
  })
})

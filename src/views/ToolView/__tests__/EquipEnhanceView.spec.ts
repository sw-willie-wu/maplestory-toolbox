import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import EquipEnhanceView from '../EquipEnhanceView.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import EnhanceEditor from '@/components/equip/EnhanceEditor.vue'
import { DATA_DIR } from '@/utils/mst/enhance/__tests__/helpers'
import type { IndexEntry } from '@/utils/mst/enhance/types'

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

/** Tool-scope entries (canonical && !cash && enhanceable) of the real index, in index.json order (= randomPick order). */
const TOOL = (JSON.parse(readFileSync(DATA_DIR + 'index.json', 'utf8')) as IndexEntry[]).filter(
  (e) => e.canonical && !e.cash && e.enhanceable
)

/** Makes the page's on-load randomPick() land on `id` (until Task 7 adds the picker, the only way to select). */
function pickOnLoad(id: number) {
  const i = TOOL.findIndex((e) => e.id === id)
  if (i < 0) throw new Error(`${id} is not in the tool scope`)
  vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / TOOL.length)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

  it('picks a random tool-scope equipment on load', async () => {
    vi.stubGlobal('fetch', diskFetch)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const w = mount(EquipEnhanceView)
    expect(w.findComponent(EquipTooltip).exists()).toBe(false)
    await flushPromises()
    expect(w.findComponent(EquipTooltip).text()).toContain(TOOL[0].name)
  })

  it('renders the tooltip for the selected equipment', async () => {
    vi.stubGlobal('fetch', diskFetch)
    pickOnLoad(1113211)
    const w = mount(EquipEnhanceView)
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
    pickOnLoad(id)
    const w = mount(EquipEnhanceView)
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

  // Need a second selection (EquipSelector removed in Task 3); Task 7 rewrites them with EquipPicker.
  it.todo('resets the enhancement state when another item is selected')
  it.todo('keeps the latest selection when an earlier load resolves last (race guard)')

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

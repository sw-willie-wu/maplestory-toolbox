import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import EquipEnhanceView from '../EquipEnhanceView.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
import EnhanceEditor from '@/components/equip/EnhanceEditor.vue'
import EquipPicker from '@/components/equip/EquipPicker.vue'
import ItemIcon from '@/components/equip/ItemIcon.vue'
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

// Real exported items (public/data/tms-v283):
const RING = 1113211 // 天上的氣息 (Ring), star force ok, flame locked
const CAP = 1003601 // 天照的頭盔 (Cap)
const CAP_BOSS = 1005983 // 永恆盜賊頭巾 (Cap)
const MEDAL = 1143471 // 不朽的遺產: star force / scroll / hammer locked, exceptional ok
const SUPERIOR = 1072732 // 赫力席母精銳戰士靴: star force unsupported

/** rng that makes the page's on-load randomPick() land on `id`. */
function rngFor(id: number): () => number {
  const i = TOOL.findIndex((e) => e.id === id)
  if (i < 0) throw new Error(`${id} is not in the tool scope`)
  return () => (i + 0.5) / TOOL.length
}

const mounted: VueWrapper[] = []
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Mounted attached to the document so isVisible() sees v-show. */
function mountView(props: { rng?: () => number } = {}) {
  const w = mount(EquipEnhanceView, { props, attachTo: document.body })
  mounted.push(w)
  return w
}

async function selected(id: number, fetchImpl: typeof fetch = diskFetch) {
  vi.stubGlobal('fetch', fetchImpl)
  const w = mountView({ rng: rngFor(id) })
  await flushPromises()
  return w
}

const side = (w: VueWrapper, id: string) => w.find(`[data-test="side-${id}"]`)
async function choose(w: VueWrapper, id: string) {
  await side(w, id).trigger('click')
  await flushPromises()
}
/** Selects an equip the way the picker does (search / dropdown / cascade all emit select). */
async function pick(w: VueWrapper, id: number) {
  w.findComponent(EquipPicker).vm.$emit('select', id)
  await flushPromises()
}
const tipName = (w: VueWrapper) => w.findComponent(EquipTooltip).text()
const inputValue = (w: VueWrapper, test: string) => (w.find(`[data-test="${test}"]`).element as HTMLInputElement).value
/** Types into a StepperInput (data-test lands on its inner input) and commits it (blur). */
async function stepTo(w: VueWrapper, test: string, v: string) {
  const input = w.find(`[data-test="${test}"]`)
  await input.setValue(v)
  await input.trigger('blur')
}

describe('EquipEnhanceView', () => {
  it('shows data version from meta', async () => {
    const w = await selected(RING)
    expect(w.find('[data-test="data-version"]').text()).toContain('資料版本：TMS v283')
  })

  it('shows the load error message', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response) as typeof fetch)
    const w = mountView()
    await flushPromises()
    expect(w.find('[data-test="load-error"]').text()).toContain('HTTP 500')
  })

  it('random equip on load with injected rng', async () => {
    vi.stubGlobal('fetch', diskFetch)
    const w = mountView({ rng: () => 0 })
    expect(w.findComponent(EquipTooltip).exists()).toBe(false)
    await flushPromises()
    expect(tipName(w)).toContain(TOOL[0].name)
    // the picker's cascade follows the random pick
    expect((w.find('[data-test="equip"]').element as HTMLSelectElement).value).toBe(String(TOOL[0].id))
  })

  it('renders the tooltip for the selected equipment', async () => {
    const w = await selected(RING)
    const tip = w.findComponent(EquipTooltip)
    expect(tip.text()).toContain('天上的氣息')
    expect(tip.text()).toContain('Lv.150')
    expect(tip.findAll('.star.lit')).toHaveLength(0)
    expect(tip.findAll('.star')).toHaveLength(30)
  })

  it('no page h1; data version inside main card', async () => {
    const w = await selected(RING)
    expect(w.find('h1').exists()).toBe(false)
    const editor = w.findComponent(EnhanceEditor)
    expect(editor.find('[data-test="data-version"]').exists()).toBe(true)
  })
})

describe('EquipEnhanceView sidebar and panels', () => {
  it('default panel is starforce; jumps to first unlocked when locked', async () => {
    const w = await selected(RING)
    expect(side(w, 'starforce').classes()).toContain('on')
    expect(w.find('[data-test="panel-starforce"]').isVisible()).toBe(true)

    await pick(w, MEDAL) // star force / scroll / hammer locked → 星火 is the first unlocked
    expect(w.find('[data-test="panel-flame"]').exists()).toBe(true)
    expect(side(w, 'flame').classes()).toContain('on')
    expect(side(w, 'starforce').attributes('aria-disabled')).toBe('true')
  })

  it('sidebar switches panels', async () => {
    const w = await selected(CAP_BOSS)
    await choose(w, 'scroll')
    expect(w.find('[data-test="panel-scroll"]').exists()).toBe(true)
    expect(side(w, 'scroll').classes()).toContain('on')
    expect(side(w, 'starforce').classes()).not.toContain('on')
    await choose(w, 'picker')
    expect(w.findComponent(EquipPicker).isVisible()).toBe(true)
    expect(w.findComponent(EnhanceEditor).exists()).toBe(true) // kept mounted
    expect(w.findComponent(EnhanceEditor).isVisible()).toBe(false)
  })

  it('a locked panel cannot be opened', async () => {
    const w = await selected(SUPERIOR)
    expect(side(w, 'starforce').attributes('aria-disabled')).toBe('true')
    expect(side(w, 'starforce').attributes('title')).toContain('不支援')
    await choose(w, 'starforce')
    expect(w.find('[data-test="panel-starforce"]').exists()).toBe(false)
  })

  it('panel inputs survive switching to the picker and back', async () => {
    const w = await selected(RING)
    await stepTo(w, 'sf-from', '12')
    await stepTo(w, 'sf-target', '22')
    await choose(w, 'picker')
    await choose(w, 'starforce')
    expect(inputValue(w, 'sf-target')).toBe('22')
    expect(inputValue(w, 'sf-from')).toBe('12') // panel-local input
    // and across other panels (KeepAlive)
    await choose(w, 'scroll')
    await choose(w, 'starforce')
    expect(inputValue(w, 'sf-from')).toBe('12')
    expect(w.findComponent(EquipTooltip).findAll('.star.lit')).toHaveLength(22)
  })

  it('selecting another equip resets panel inputs', async () => {
    const w = await selected(CAP_BOSS)
    await stepTo(w, 'sf-from', '12')
    await stepTo(w, 'sf-target', '18')
    // same item again → reset as well
    await pick(w, CAP_BOSS)
    expect(inputValue(w, 'sf-from')).toBe('0')
    expect(inputValue(w, 'sf-target')).toBe('0')
    expect(w.findComponent(EquipTooltip).findAll('.star.lit')).toHaveLength(0)

    await stepTo(w, 'sf-target', '10')
    await pick(w, CAP)
    expect(tipName(w)).toContain('天照的頭盔')
    expect(inputValue(w, 'sf-target')).toBe('0')
  })

  it('latest selection wins when loads resolve out of order', async () => {
    let releaseRing: () => void = () => {}
    const ringGate = new Promise<void>((r) => (releaseRing = r))
    const gated = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/equip/Ring.json')) await ringGate
      return diskFetch(input)
    }) as typeof fetch
    const w = await selected(CAP_BOSS, gated)

    w.findComponent(EquipPicker).vm.$emit('select', RING) // slow (gated)
    w.findComponent(EquipPicker).vm.$emit('select', CAP) // fast (Cap.json cached)
    await flushPromises()
    expect(tipName(w)).toContain('天照的頭盔')
    releaseRing()
    await flushPromises()
    expect(tipName(w)).toContain('天照的頭盔')
    expect(tipName(w)).not.toContain('天上的氣息')
    expect((w.find('[data-test="equip"]').element as HTMLSelectElement).value).toBe(String(CAP))
  })

  it('exceptional item is shown disabled with reason, not hidden', async () => {
    const w = await selected(RING) // canExceptional false
    const ex = side(w, 'exceptional')
    expect(ex.exists()).toBe(true)
    expect(ex.attributes('aria-disabled')).toBe('true')
    expect(ex.attributes('title')).toContain('卓越')
  })

  it('sidebar disabled with 請先選擇裝備 when no equip', async () => {
    vi.stubGlobal('fetch', (async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response) as typeof fetch)
    const w = mountView()
    await flushPromises()
    for (const id of ['starforce', 'scroll', 'hammer', 'flame', 'potential', 'bonusPotential', 'exceptional', 'reverse']) {
      expect(side(w, id).attributes('aria-disabled')).toBe('true')
      expect(side(w, id).attributes('title')).toBe('請先選擇裝備')
    }
    expect(side(w, 'picker').attributes('aria-disabled')).toBeUndefined()
    expect(w.find('[data-test="tooltip-placeholder"]').exists()).toBe(true)
    expect(w.find('[data-test="editor-placeholder"]').exists()).toBe(true)
  })

  it('sidebar first cell shows equip icon, name and 選擇裝備', async () => {
    const w = await selected(RING)
    const cell = side(w, 'picker')
    expect(cell.text()).toContain('天上的氣息')
    expect(cell.text()).toContain('選擇裝備')
    expect(cell.findComponent(ItemIcon).props('itemId')).toBe(RING)
  })

  it('potential load failure sets potentialError; retryPotential reloads and clears it', async () => {
    let failPotential = true
    let potentialCalls = 0
    const flaky = (async (input: RequestInfo | URL) => {
      if (String(input).endsWith('potential-options.json')) {
        potentialCalls++
        if (failPotential) return { ok: false, status: 503, json: async () => ({}) } as Response
      }
      return diskFetch(input)
    }) as typeof fetch
    const w = await selected(CAP_BOSS, flaky)
    const editor = () => w.findComponent(EnhanceEditor)
    expect(editor().props('potentialError')).toContain('503')
    expect(editor().props('potentialOptions')).toBeNull()

    failPotential = false
    editor().vm.$emit('retryPotential')
    await flushPromises()
    expect(potentialCalls).toBe(2)
    expect(editor().props('potentialError')).toBeNull()
    expect(editor().props('potentialOptions')).not.toBeNull()
  })
})

describe('EquipEnhanceView layout', () => {
  it('tooltip column gets max-height and overflow auto', async () => {
    const w = await selected(RING)
    const style = w.find('[data-test="tooltip-scroll"]').attributes('style') ?? ''
    expect(style).toContain('max-height')
    expect(style).toContain('overflow-y: auto')
  })

  it('middle column height does not follow tooltip', async () => {
    const w = await selected(RING)
    const outer = w.find('[data-test="enhance-grid"]')
    expect(outer.attributes('style')).toContain('align-items: start')
    const left = w.find('[data-test="enhance-left"]')
    // C is a sibling of the left area (sidebar + middle), not inside it
    expect(left.find('[data-test="tooltip-pin"]').exists()).toBe(false)
    expect(outer.find('[data-test="tooltip-pin"]').exists()).toBe(true)
    expect(left.find('[data-test="side-picker"]').exists()).toBe(true)
    expect(left.findComponent(EnhanceEditor).exists()).toBe(true)
  })

  describe('compact tooltip (< 1200px)', () => {
    const narrowMatchMedia = (query: string) =>
      ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList

    it('shows the compact tooltip pinned on top and expands / collapses it', async () => {
      vi.stubGlobal('matchMedia', narrowMatchMedia)
      const w = await selected(RING)
      expect(w.find('[data-test="tooltip-pin"]').classes()).toContain('compact')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(true)
      await w.find('[data-test="tooltip-toggle"]').trigger('click')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(false)
      await w.find('[data-test="tooltip-toggle"]').trigger('click')
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(true)
    })

    it('uses the full tooltip without a toggle on desktop', async () => {
      const w = await selected(RING)
      expect(w.findComponent(EquipTooltip).props('compact')).toBe(false)
      expect(w.find('[data-test="tooltip-toggle"]').exists()).toBe(false)
    })
  })

  describe('mobile (< 992px)', () => {
    /** Every max-width query matches → compact (< 1200) and mobile (< 992) both on. */
    const mobileMatchMedia = (query: string) =>
      ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {}
      }) as unknown as MediaQueryList
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    const IDS = ['starforce', 'scroll', 'hammer', 'flame', 'potential', 'bonusPotential', 'exceptional', 'reverse']

    it('DOM order: equip block, compact C, tab row, editor', async () => {
      vi.stubGlobal('matchMedia', mobileMatchMedia)
      const w = await selected(RING)
      const equipBlock = w.find('[data-test="mobile-equip"]')
      const tip = w.find('[data-test="tooltip-pin"]')
      const tabs = w.find('[data-test="enhance-tabs"]')
      const editor = w.findComponent(EnhanceEditor)
      expect(equipBlock.exists()).toBe(true)
      expect(tabs.exists()).toBe(true)
      expect(tip.classes()).toContain('compact')
      expect(equipBlock.find('[data-test="side-picker"]').exists()).toBe(true)
      expect(before(equipBlock.element, tip.element)).toBe(true)
      expect(before(tip.element, tabs.element)).toBe(true)
      expect(before(tabs.element, editor.element)).toBe(true)
      // the vertical sidebar is not rendered; the equip cell is not part of the tab row
      expect(w.find('[data-test="enhance-left"] > .eq-left__side').exists()).toBe(false)
      expect(tabs.find('[data-test="side-picker"]').exists()).toBe(false)
      expect(w.findAll('[data-test="side-picker"]')).toHaveLength(1)
    })

    it('tab row holds all 8 panels and switches the active panel', async () => {
      vi.stubGlobal('matchMedia', mobileMatchMedia)
      const w = await selected(CAP_BOSS)
      const tabs = w.find('[data-test="enhance-tabs"]')
      expect(tabs.findAll('.eq-side__btn').map((b) => b.attributes('data-test'))).toEqual(IDS.map((id) => `side-${id}`))
      expect(side(w, 'starforce').classes()).toContain('on')
      await choose(w, 'scroll')
      expect(w.find('[data-test="panel-scroll"]').isVisible()).toBe(true)
      expect(side(w, 'scroll').classes()).toContain('on')
      expect(side(w, 'starforce').classes()).not.toContain('on')
    })

    it('equip block click opens the picker; a tab returns to the editor', async () => {
      vi.stubGlobal('matchMedia', mobileMatchMedia)
      const w = await selected(RING)
      await choose(w, 'picker')
      expect(w.findComponent(EquipPicker).isVisible()).toBe(true)
      expect(w.findComponent(EnhanceEditor).isVisible()).toBe(false)
      expect(side(w, 'picker').classes()).toContain('on')
      expect(w.find('[data-test="enhance-tabs"]').isVisible()).toBe(true)
      await choose(w, 'starforce')
      expect(w.findComponent(EnhanceEditor).isVisible()).toBe(true)
      expect(w.findComponent(EquipPicker).isVisible()).toBe(false)
    })

    it('a locked tab is faded with the reason and cannot be opened', async () => {
      vi.stubGlobal('matchMedia', mobileMatchMedia)
      const w = await selected(SUPERIOR)
      const sf = w.find('[data-test="enhance-tabs"] [data-test="side-starforce"]')
      expect(sf.classes()).toContain('off')
      expect(sf.attributes('aria-disabled')).toBe('true')
      expect(sf.attributes('title')).toContain('不支援')
      await sf.trigger('click')
      await flushPromises()
      expect(w.find('[data-test="panel-starforce"]').exists()).toBe(false)
    })

    it('desktop keeps the vertical sidebar and no mobile blocks', async () => {
      const w = await selected(RING)
      expect(w.find('[data-test="mobile-equip"]').exists()).toBe(false)
      expect(w.find('[data-test="enhance-tabs"]').exists()).toBe(false)
      expect(w.find('[data-test="enhance-left"] > .eq-left__side').exists()).toBe(true)
    })
  })

  it('updates the tooltip when the editor changes the star (B follows C)', async () => {
    const w = await selected(RING)
    const statLine = (label: string) =>
      w
        .findComponent(EquipTooltip)
        .findAll('[data-test="stat-line"]')
        .find((l) => l.find('.stat-label').text() === label)!
        .text()
    expect(statLine('STR')).toBe('STR+25')
    await stepTo(w, 'sf-target', '25')
    await flushPromises()
    expect(statLine('STR')).toContain('+142')
    expect(statLine('STR')).toContain('(25 +117)')
  })
})

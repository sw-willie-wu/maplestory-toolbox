import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import EquipEnhanceView from '../EquipEnhanceView.vue'
import EquipSelector from '@/components/equip/EquipSelector.vue'
import EquipTooltip from '@/components/equip/EquipTooltip.vue'
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

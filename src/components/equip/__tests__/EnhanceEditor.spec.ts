import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EnhanceEditor from '../EnhanceEditor.vue'
import { emptyState, type EnhanceState } from '@/utils/mst/enhance/equip'
import { lockReasons, PANELS, type PanelId } from '../panels'
import { loadEquipSync, readDataJson } from '@/utils/mst/enhance/__tests__/helpers'
import { POTENTIAL, type RawPotentialOption } from '@/utils/mst/enhance/rules/potential'
import { reverseScrollDetailed, REVERSE_MAX_USED_SLOTS } from '@/utils/mst/enhance/scroll'
import type { EquipData } from '@/utils/mst/enhance/types'
import * as starforceModule from '@/utils/mst/enhance/starforce'
import { STARFORCE } from '@/utils/mst/enhance/rules/starforce'
import { RECOVERY, SCROLLS } from '@/utils/mst/enhance/rules/scroll'
import { HAMMER } from '@/utils/mst/enhance/rules/hammer'
import StarforceTab from '../tabs/StarforceTab.vue'
import HammerTab from '../tabs/HammerTab.vue'
import ItemIcon from '../ItemIcon.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'

// StepperInput is a generic SFC, which findComponent's typings do not accept; select it by name.
const STEPPER = { name: 'StepperInput' }

// Real exported items (public/data/tms-v283):
const RING = 1113211 // 天上的氣息 Lv150 accessory, tuc 2, canFlame false
const CAP_BOSS = 1005983 // 永恆盜賊頭巾 Lv250, tuc 12, boss flames
const CAP = 1003601 // 天照的頭盔 Lv150, non-boss flames, tuc 11
const FIST = 1472290 // 命運鬥拳 Lv250 boss weapon
const MEDAL = 1143471 // 不朽的遺產 Lv250, tuc 0, exceptionalMax 3 (only level 2 observed)
const BLOCKED = 1122000 // 闇黑龍王項鍊, blockGoldHammer
const GLOVES = 1082000 // 鋼製短手套 Lv15 gloves, tuc 6

const potentialOptions = POTENTIAL.buildOptions(readDataJson<RawPotentialOption[]>('potential-options.json'))

type Panel = Exclude<PanelId, 'picker'>

function mountEditor(
  id: number,
  opts: { active?: Panel; state?: Partial<EnhanceState>; potential?: boolean; potentialError?: string | null } = {},
): { w: VueWrapper; state: EnhanceState; equip: EquipData } {
  const equip = loadEquipSync(id)
  const state = reactive({ ...emptyState(equip), ...opts.state }) as EnhanceState
  const w = mount(EnhanceEditor, {
    props: {
      equip,
      state,
      active: opts.active ?? PANELS.find((p) => !lockReasons(equip).has(p.id))!.id,
      potentialOptions: opts.potential === false ? null : potentialOptions,
      potentialError: opts.potentialError ?? null,
    },
  })
  return { w, state, equip }
}

async function open(w: VueWrapper, id: Panel) {
  await w.setProps({ active: id })
}
const optionTexts = (w: VueWrapper, sel: string) =>
  w
    .find(sel)
    .findAll('option')
    .map((o) => o.text())

describe('EnhanceEditor panels', () => {
  it('shows only the panel given by active, without its own tab bar or locked note', async () => {
    const { w } = mountEditor(CAP_BOSS, { active: 'scroll' })
    expect(w.find('[data-test="panel-scroll"]').exists()).toBe(true)
    expect(w.find('[data-test="panel-starforce"]').exists()).toBe(false)
    expect(w.find('[role="tablist"]').exists()).toBe(false)
    expect(w.find('[data-test="locked-note"]').exists()).toBe(false)
    await open(w, 'reverse')
    expect(w.find('[data-test="panel-reverse"]').exists()).toBe(true)
    expect(w.find('[data-test="panel-scroll"]').exists()).toBe(false)
  })

  it('keeps panel-local inputs when switching panels (KeepAlive)', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await step(w, '[data-test="sf-from"]', '12')
    await open(w, 'flame')
    await open(w, 'starforce')
    expect((w.find('[data-test="sf-from"]').element as HTMLInputElement).value).toBe('12')
  })

  it('potential panel renders only its kind', async () => {
    const { w } = mountEditor(CAP_BOSS, { active: 'bonusPotential' })
    const panel = w.find('[data-test="panel-bonusPotential"]')
    expect(panel.find('[data-test="pot-grade-additional"]').exists()).toBe(true)
    expect(panel.find('[data-test="pot-grade-potential"]').exists()).toBe(false)
    expect(panel.text()).toContain('附加潛在能力')
    expect(panel.text().replace(/附加潛在能力/g, '')).not.toContain('潛在能力')

    await open(w, 'potential')
    const main = w.find('[data-test="panel-potential"]')
    expect(main.find('[data-test="pot-grade-potential"]').exists()).toBe(true)
    expect(main.find('[data-test="pot-grade-additional"]').exists()).toBe(false)
  })

  it('potential load failure shows a retry that emits retryPotential', async () => {
    const { w } = mountEditor(CAP_BOSS, { active: 'potential', potential: false, potentialError: 'HTTP 503' })
    expect(w.find('[data-test="potential-error"]').text()).toContain('潛能選項載入失敗')
    await w.find('[data-test="potential-retry"]').trigger('click')
    expect(w.emitted('retryPotential')).toHaveLength(1)
  })
})

/** StepperInput commits on blur/enter; data-test lands on its inner input. */
async function step(w: VueWrapper, sel: string, v: string) {
  const input = w.find(sel)
  await input.setValue(v)
  await input.trigger('blur')
}

describe('StarforceTab', () => {
  it('writes the target star into the state and shows the expectation', async () => {
    const { w, state } = mountEditor(RING)
    await step(w, '[data-test="sf-target"]', '17')
    expect(state.star).toBe(17)
    const exp = w.find('[data-test="sf-expect"]')
    expect(exp.classes()).toContain('eq-res')
    expect(exp.text()).toContain('期望楓幣')
    expect(exp.text()).toContain('嘗試次數')
    expect(exp.text()).toContain('爆裝次數')
    expect(exp.text()).toContain('至少爆一次')
  })

  it('clamps the target star to the level maximum', async () => {
    const { w, state } = mountEditor(RING)
    await step(w, '[data-test="sf-target"]', '40')
    expect(state.star).toBe(30)
  })

  it('starforce uses steppers and toggle', () => {
    const { w } = mountEditor(RING)
    const panel = w.findComponent(StarforceTab)
    const steppers = panel.findAllComponents(STEPPER)
    expect(steppers).toHaveLength(2)
    const target = steppers.find((s) => s.find('[data-test="sf-target"]').exists())!
    expect(target.props('suffix')).toBe('/ 30')
    expect(target.props('max')).toBe(30)
    expect(steppers.find((s) => s.find('[data-test="sf-from"]').exists())!.props('max')).toBe(30)
    const toggles = panel.findAllComponents(ToggleSwitch)
    expect(toggles).toHaveLength(1)
    expect(toggles[0].attributes('data-test')).toBe('sf-safeguard')
    expect(panel.find('input[type="checkbox"]').exists()).toBe(false)
    expect(panel.find('input[type="number"]').exists()).toBe(false)
  })

  it('shows KMS estimate notice when rule source is KMS-estimate', () => {
    const { w } = mountEditor(RING)
    expect(w.find('[data-test="panel-starforce"] [data-test="kms-notice"]').text()).toContain('依 KMS 資料推估')
  })

  it('safeguard notice is TMS official, not KMS estimate', () => {
    const { w } = mountEditor(RING)
    expect(STARFORCE.ruleSources.safeguard.source).toBe('TMS')
    expect(w.find('[data-test="panel-starforce"] [data-test="kms-notice"]').text()).not.toContain('防爆')
    expect(w.find('[data-test="sf-safeguard"]').text()).toContain('防爆（15～17 星，費用 +200%）')
  })

  it('starforce hides star catch when alwaysOn', () => {
    expect(STARFORCE.starCatch.alwaysOn).toBe(true)
    const { w } = mountEditor(RING)
    expect(w.find('[data-test="sf-starcatch"]').exists()).toBe(false)
    expect(w.find('[data-test="panel-starforce"]').text()).not.toContain('常駐')
  })

  it('offers TMS VIP tiers and no PC-room discount', () => {
    const { w } = mountEditor(RING)
    const vip = optionTexts(w, '[data-test="sf-vip"]')
    expect(vip).toEqual(expect.arrayContaining(['VIP 金牌', 'VIP 鑽石', 'VIP 皇家以上']))
    expect(w.find('[data-test="panel-starforce"]').text()).not.toMatch(/PC/i)
  })

  it('starforce has no item price field', async () => {
    const spy = vi.spyOn(starforceModule, 'starforceExpectation')
    try {
      const { w } = mountEditor(RING)
      expect(w.find('[data-test="sf-item-price"]').exists()).toBe(false)
      expect(w.find('[data-test="sf-total-item"]').exists()).toBe(false)
      expect(w.find('[data-test="panel-starforce"]').text()).not.toContain('裝備單價')
      await step(w, '[data-test="sf-target"]', '18')
      expect(spy).toHaveBeenCalled()
      for (const call of spy.mock.calls) expect(call[3]?.itemPrice).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('safeguard changes the expectation', async () => {
    const { w } = mountEditor(RING)
    await step(w, '[data-test="sf-from"]', '12')
    await step(w, '[data-test="sf-target"]', '18')
    const before = w.find('[data-test="sf-meso"]').text()
    await w.find('[data-test="sf-safeguard"]').trigger('click')
    expect(w.find('[data-test="sf-safeguard"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="sf-meso"]').text()).not.toBe(before)
  })
})

describe('ScrollTab', () => {
  async function addScroll(w: VueWrapper, scrollId: string, count: number) {
    await w.find(`[data-test="scroll-card-${scrollId}"]`).trigger('click')
    const rows = w.findAll('[data-test="scroll-entry"]')
    const row = rows[rows.length - 1]
    await row.find('[data-test="scroll-count"]').setValue(String(count))
    await row.find('[data-test="scroll-count"]').trigger('blur')
    return row
  }
  const cardIds = (w: VueWrapper) =>
    w.findAll('[data-test^="scroll-card-"]').map((c) => c.attributes('data-test')!.replace('scroll-card-', ''))

  it('edits entries and the fail count in the state', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await addScroll(w, 'trace30', 3)
    await step(w, '[data-test="scroll-fail"]', '2')
    expect(state.scroll.entries).toEqual([expect.objectContaining({ scrollId: 'trace30', count: 3 })])
    expect(state.scroll.failCount).toBe(2)
  })

  it('clicking a card again adds one more success to the same entry', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await w.find('[data-test="scroll-card-trace30"]').trigger('click')
    await w.find('[data-test="scroll-card-trace30"]').trigger('click')
    expect(state.scroll.entries).toEqual([expect.objectContaining({ scrollId: 'trace30', count: 2 })])
    expect(w.findAll('[data-test="scroll-entry"]')).toHaveLength(1)
  })

  it('only offers scrolls usable on the item slot', async () => {
    const ring = mountEditor(RING).w
    await open(ring, 'scroll')
    expect(cardIds(ring)).not.toContain('trace15')
    const cap = mountEditor(CAP_BOSS).w
    await open(cap, 'scroll')
    expect(cardIds(cap)).toContain('trace15')
  })

  it('scroll cards show icons', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    const cards = w.findAll('[data-test^="scroll-card-"]')
    expect(cards.length).toBeGreaterThan(5)
    for (const card of cards) {
      const id = card.attributes('data-test')!.replace('scroll-card-', '')
      const def = SCROLLS.items.find((d) => d.id === id)!
      const icon = card.findComponent(ItemIcon)
      expect(icon.exists()).toBe(true)
      expect(icon.props('itemId')).toBe(def.iconItemId)
      expect(card.text()).toContain(def.name)
    }
    // effect line: 咒文的痕跡 30% on a Lv250 cap = main stat +7, HP +120, DEF +10
    expect(w.find('[data-test="scroll-card-trace30"] [data-test="scroll-effect"]').text()).toContain('+7')
    expect(w.find('[data-test="scroll-card-destiny"] [data-test="scroll-effect"]').text()).toContain('隨機')
  })

  it('scroll card icon shows a placeholder when iconItemId is null', async () => {
    const def = SCROLLS.items.find((d) => d.id === 'x')!
    const saved = def.iconItemId
    def.iconItemId = null
    try {
      const { w } = mountEditor(CAP_BOSS)
      await open(w, 'scroll')
      const card = w.find('[data-test="scroll-card-x"]')
      expect(card.findComponent(ItemIcon).props('itemId')).toBeNull()
      expect(card.find('[data-test="icon-placeholder"]').exists()).toBe(true)
    } finally {
      def.iconItemId = saved
    }
  })

  it('used scroll list rows show icons', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    const row = await addScroll(w, 'x', 2)
    expect(row.findComponent(ItemIcon).props('itemId')).toBe(SCROLLS.items.find((d) => d.id === 'x')!.iconItemId)
    expect(row.text()).toContain('X 卷軸')
    expect(row.findComponent(STEPPER).exists()).toBe(true)
  })

  it('scroll tab shows recovery expectation when a recovery scroll is chosen', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await addScroll(w, 'trace30', 3)
    const exp = w.find('[data-test="scroll-expect"]')
    expect(exp.classes()).toContain('eq-res')
    expect(exp.text()).toContain('10') // 3 / 0.3
    expect(w.find('[data-test="scroll-recovery-used"]').exists()).toBe(false)
    const toggle = w.find('[data-test="scroll-recovery-cleanSlate"]')
    expect(toggle.findComponent(ItemIcon).props('itemId')).toBe(RECOVERY.items[0].iconItemId)
    await toggle.find('[role="switch"]').trigger('click')
    expect(w.find('[data-test="scroll-expect"]').text()).toContain('純白卷軸')
    expect(w.find('[data-test="scroll-recovery-used"]').text()).toContain('7') // 7 expected failures, recovered at 100%
  })

  it('scroll tab shows overflow warning', async () => {
    const { w } = mountEditor(RING) // tuc 2
    await open(w, 'scroll')
    expect(w.find('[data-test="scroll-overflow"]').exists()).toBe(false)
    await addScroll(w, 'x', 5)
    expect(w.find('[data-test="scroll-overflow"]').text()).toContain('超出可上卷次數 3')
  })

  it('推測 note only for armor, not gloves', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    expect(w.find('[data-test="panel-scroll"] [data-test="guess-notice"]').exists()).toBe(false)
    await addScroll(w, 'trace100', 4)
    expect(w.find('[data-test="panel-scroll"] [data-test="guess-notice"]').text()).toContain('推測')

    // The guessed bonus is an armor rule (gloves excluded): no note on gloves or an accessory.
    const gloves = mountEditor(GLOVES).w
    await open(gloves, 'scroll')
    await addScroll(gloves, 'trace100', 4)
    expect(gloves.find('[data-test="panel-scroll"] [data-test="guess-notice"]').exists()).toBe(false)

    const ring = mountEditor(RING).w
    await open(ring, 'scroll')
    await addScroll(ring, 'trace100', 2)
    expect(ring.find('[data-test="panel-scroll"] [data-test="guess-notice"]').exists()).toBe(false)
  })

  it('takes the average gain per scroll for random-value scrolls', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    const row = await addScroll(w, 'destiny', 2)
    await row.find('[data-test="scroll-avg-att"]').setValue('3')
    expect(state.scroll.entries[0].avgPerScroll).toEqual({ att: 3 })
  })

  it('removes an entry', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await addScroll(w, 'x', 1)
    await w.find('[data-test="scroll-remove"]').trigger('click')
    expect(state.scroll.entries).toEqual([])
  })
})

describe('HammerTab', () => {
  it('hammer uses stepper for uses', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'hammer')
    const steppers = w.findComponent(HammerTab).findAllComponents(STEPPER)
    expect(steppers).toHaveLength(HAMMER.types.length)
    for (const def of HAMMER.types) {
      const s = steppers.find((x) => x.find(`[data-test="hammer-${def.id}"]`).exists())!
      expect(s.props('max')).toBe(def.max)
      expect(s.props('suffix')).toBe(`/ ${def.max}`)
    }
    expect(w.find('[data-test="panel-hammer"] input[type="number"]').exists()).toBe(false)
    await step(w, '[data-test="hammer-platinum"]', '9')
    expect(state.hammer.platinum).toBe(5) // clamped to max
  })

  it('writes uses into the state and shows 規則待查證 for platinum refine', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'hammer')
    await step(w, '[data-test="hammer-platinum"]', '3')
    expect(state.hammer.platinum).toBe(3)
    expect(w.find('[data-test="hammer-expect-platinum"]').text()).toContain('規則待查證')
    await step(w, '[data-test="hammer-golden"]', '1')
    expect(w.find('[data-test="hammer-expect-golden"]').text()).toContain('24,000')
  })

  it('surfaces why hammer uses are ignored (blocked / max)', async () => {
    const blocked = mountEditor(BLOCKED).w
    await open(blocked, 'hammer')
    expect(blocked.find('[data-test="hammer-golden"]').exists()).toBe(false)
    expect(blocked.find('[data-test="hammer-reason-golden"]').text()).toContain('不可使用')

    // An over-max use count already in the state is still reported.
    const { w } = mountEditor(CAP_BOSS, { state: { hammer: { platinum: 9 } } })
    await open(w, 'hammer')
    expect(w.find('[data-test="hammer-reason-platinum"]').text()).toContain('上限')
  })
})

describe('FlameTab', () => {
  async function addLine(w: VueWrapper, stat: string, tier: number) {
    await w.find('[data-test="flame-add"]').trigger('click')
    const rows = w.findAll('[data-test="flame-line"]')
    const row = rows[rows.length - 1]
    await row.find('[data-test="flame-stat"]').setValue(stat)
    await row.find('[data-test="flame-tier"]').setValue(String(tier))
    return row
  }

  it('edits lines and shows the probability per flame type', async () => {
    const { w, state } = mountEditor(CAP)
    await open(w, 'flame')
    const row = await addLine(w, 'str', 3)
    expect(state.flame).toEqual([{ stat: 'str', tier: 3 }])
    expect(row.text()).toContain('+24') // Lv150 single stat: 8 per tier
    const rows = w.findAll('[data-test="flame-prob"]')
    expect(rows).toHaveLength(4)
    expect(rows[0].text()).toContain('%')
    expect(w.find('[data-test="panel-flame"] [data-test="kms-notice"]').text()).toContain('依 KMS 資料推估')
  })

  it('does not offer a stat twice', async () => {
    const { w } = mountEditor(CAP)
    await open(w, 'flame')
    await addLine(w, 'str', 1)
    await w.find('[data-test="flame-add"]').trigger('click')
    const second = w.findAll('[data-test="flame-line"]')[1]
    const values = second.find('[data-test="flame-stat"]').findAll('option').map((o) => (o.element as HTMLOptionElement).value)
    expect(values).not.toContain('str')
  })

  it('shows the value note for extrapolated boss weapon ATT tiers', async () => {
    const { w } = mountEditor(FIST)
    await open(w, 'flame')
    await addLine(w, 'att', 1)
    expect(w.find('[data-test="flame-notes"]').text()).toContain('外推')
  })
})

describe('ExceptionalTab', () => {
  it('sets the level, shows 無資料 for unobserved levels and the hammer expectation', async () => {
    const { w, state } = mountEditor(MEDAL)
    await open(w, 'exceptional')
    await w.find('[data-test="ex-level"]').setValue('1')
    expect(state.exceptional).toBe(1)
    expect(w.find('[data-test="ex-stats"]').text()).toContain('無資料')
    await w.find('[data-test="ex-level"]').setValue('2')
    expect(w.find('[data-test="ex-stats"]').text()).toContain('+40')
    const exp = w.find('[data-test="ex-expect"]').text()
    expect(exp).toContain('卓越鐵鎚')
    expect(exp).toContain('3') // 1/1 + 1/0.5
    expect(w.find('[data-test="panel-exceptional"] [data-test="kms-notice"]').exists()).toBe(true)
  })
})

describe('PotentialTab', () => {
  it('picks grade and lines for potential and additional potential', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'potential')
    await w.find('[data-test="pot-grade-potential"]').setValue('傳說')
    expect(state.potential.grade).toBe('傳說')
    const line = w.find('[data-test="pot-line-potential-0"]')
    const opts = line.findAll('option').filter((o) => (o.element as HTMLOptionElement).value !== '')
    expect(opts.length).toBeGreaterThan(5)
    await line.setValue((opts[0].element as HTMLOptionElement).value)
    expect(state.potential.lines[0]).toBe(opts[0].text())
    expect(state.potential.lines[0]).not.toContain('#')

    expect(w.find('[data-test="panel-potential"] [data-test="kms-notice"]').exists()).toBe(true)

    await open(w, 'bonusPotential')
    await w.find('[data-test="pot-grade-additional"]').setValue('稀有')
    expect(state.additional.grade).toBe('稀有')
  })

  it('clears lines that the new grade does not offer', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'potential')
    await w.find('[data-test="pot-grade-potential"]').setValue('傳說')
    const line = w.find('[data-test="pot-line-potential-0"]')
    const legendaryOnly = line.findAll('option').find((o) => o.text().includes('全屬性') && o.text().includes('%'))!
    await line.setValue((legendaryOnly.element as HTMLOptionElement).value)
    await w.find('[data-test="pot-grade-potential"]').setValue('特殊')
    expect(state.potential.lines[0]).toBeNull()
  })

  it('says it is loading while the option list is not there yet', async () => {
    const { w } = mountEditor(CAP_BOSS, { potential: false })
    await open(w, 'potential')
    expect(w.find('[data-test="panel-potential"]').text()).toContain('載入中')
  })
})

describe('ReverseTab', () => {
  it('reverse tab lists flame combinations and shows not-found message', async () => {
    const { w, state } = mountEditor(CAP)
    await open(w, 'reverse')
    await w.find('[data-test="rf-str"]').setValue('24')
    await w.find('[data-test="rf-run"]').trigger('click')
    const results = w.findAll('[data-test="rf-result"]')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text()).toContain('STR')
    expect(results[0].text()).toContain('T3')
    expect(w.find('[data-test="rf-none"]').exists()).toBe(false)
    await results[0].find('[data-test="rf-apply"]').trigger('click')
    expect(state.flame).toEqual([{ stat: 'str', tier: 3 }])

    await w.find('[data-test="rf-str"]').setValue('7')
    await w.find('[data-test="rf-run"]').trigger('click')
    expect(w.findAll('[data-test="rf-result"]')).toHaveLength(0)
    expect(w.find('[data-test="rf-none"]').text()).toContain('找不到')
  })

  it('scroll reverse lists combinations, warns when incomplete and shows the random average', async () => {
    const { w, equip } = mountEditor(RING)
    await open(w, 'reverse')
    await w.find('[data-test="rs-att"]').setValue('100')
    await w.find('[data-test="rs-slots"]').setValue('20')
    await w.find('[data-test="rs-run"]').trigger('click')
    await flushPromises()
    const expected = reverseScrollDetailed(equip, { att: 100 }, 20)
    expect(expected.truncated || expected.timedOut).toBe(true)
    expect(w.findAll('[data-test="rs-result"]')).toHaveLength(expected.results.length)
    expect(w.find('[data-test="rs-incomplete"]').text()).toContain('結果可能不完整')
    expect(w.find('[data-test="rs-avg"]').text()).toContain('5') // 100 / 20
  })

  it('scroll reverse shows not-found and blocks used slots above the limit', async () => {
    const { w } = mountEditor(RING)
    await open(w, 'reverse')
    await w.find('[data-test="rs-att"]').setValue('1')
    await w.find('[data-test="rs-slots"]').setValue('1')
    await w.find('[data-test="rs-run"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="rs-none"]').text()).toContain('找不到')

    await w.find('[data-test="rs-slots"]').setValue(String(REVERSE_MAX_USED_SLOTS + 1))
    expect(w.find('[data-test="rs-limit"]').text()).toContain(String(REVERSE_MAX_USED_SLOTS))
    expect(w.find('[data-test="rs-run"]').attributes('disabled')).toBeDefined()
  })
})

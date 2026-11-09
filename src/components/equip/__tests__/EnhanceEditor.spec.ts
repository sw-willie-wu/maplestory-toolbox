import { describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import EnhanceEditor from '../EnhanceEditor.vue'
import { emptyState, type EnhanceState } from '@/utils/mst/enhance/equip'
import { lockReasons, PANELS, type PanelId } from '../panels'
import { loadEquipSync, readDataJson } from '@/utils/mst/enhance/__tests__/helpers'
import { POTENTIAL, type RawPotentialOption } from '@/utils/mst/enhance/rules/potential'
import { reverseScrollDetailed, REVERSE_MAX_USED_SLOTS } from '@/utils/mst/enhance/scroll'
import type { EquipData } from '@/utils/mst/enhance/types'

// Real exported items (public/data/tms-v283):
const RING = 1113211 // 天上的氣息 Lv150 accessory, tuc 2, canFlame false
const CAP_BOSS = 1005983 // 永恆盜賊頭巾 Lv250, tuc 12, boss flames
const CAP = 1003601 // 天照的頭盔 Lv150, non-boss flames, tuc 11
const FIST = 1472290 // 命運鬥拳 Lv250 boss weapon
const MEDAL = 1143471 // 不朽的遺產 Lv250, tuc 0, exceptionalMax 3 (only level 2 observed)
const BLOCKED = 1122000 // 闇黑龍王項鍊, blockGoldHammer

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
    await w.find('[data-test="sf-from"]').setValue('12')
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

describe('StarforceTab', () => {
  it('writes the target star into the state and shows the expectation', async () => {
    const { w, state } = mountEditor(RING)
    await w.find('[data-test="sf-target"]').setValue('17')
    expect(state.star).toBe(17)
    const exp = w.find('[data-test="sf-expect"]').text()
    expect(exp).toContain('期望楓幣')
    expect(exp).toContain('期望嘗試次數')
    expect(exp).toContain('期望爆裝次數')
    expect(exp).toContain('至少爆一次')
  })

  it('clamps the target star to the level maximum', async () => {
    const { w, state } = mountEditor(RING)
    await w.find('[data-test="sf-target"]').setValue('40')
    expect(state.star).toBe(30)
  })

  it('shows KMS estimate notice when rule source is KMS-estimate', () => {
    const { w } = mountEditor(RING)
    expect(w.find('[data-test="panel-starforce"] [data-test="kms-notice"]').text()).toContain('依 KMS 資料推估')
  })

  it('keeps star catch on and locked (always applied)', () => {
    const { w } = mountEditor(RING)
    const box = w.find('[data-test="sf-starcatch"]').element as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
  })

  it('offers TMS VIP tiers and no PC-room discount', () => {
    const { w } = mountEditor(RING)
    const vip = optionTexts(w, '[data-test="sf-vip"]')
    expect(vip).toEqual(expect.arrayContaining(['VIP 金牌', 'VIP 鑽石', 'VIP 皇家以上']))
    expect(w.find('[data-test="panel-starforce"]').text()).not.toMatch(/PC/i)
  })

  it('safeguard and item price change the expectation', async () => {
    const { w } = mountEditor(RING)
    await w.find('[data-test="sf-from"]').setValue('12')
    await w.find('[data-test="sf-target"]').setValue('18')
    const before = w.find('[data-test="sf-meso"]').text()
    await w.find('[data-test="sf-safeguard"]').setValue(true)
    expect(w.find('[data-test="sf-meso"]').text()).not.toBe(before)
    expect(w.find('[data-test="sf-total-item"]').exists()).toBe(false)
    await w.find('[data-test="sf-item-price"]').setValue('1000000000')
    expect(w.find('[data-test="sf-total-item"]').exists()).toBe(true)
  })
})

describe('ScrollTab', () => {
  async function addScroll(w: VueWrapper, scrollId: string, count: number) {
    await w.find('[data-test="scroll-add"]').trigger('click')
    const rows = w.findAll('[data-test="scroll-entry"]')
    const row = rows[rows.length - 1]
    await row.find('[data-test="scroll-id"]').setValue(scrollId)
    await row.find('[data-test="scroll-count"]').setValue(String(count))
    return row
  }

  it('edits entries and the fail count in the state', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await addScroll(w, 'trace30', 3)
    await w.find('[data-test="scroll-fail"]').setValue('2')
    expect(state.scroll.entries).toEqual([expect.objectContaining({ scrollId: 'trace30', count: 3 })])
    expect(state.scroll.failCount).toBe(2)
  })

  it('only offers scrolls usable on the item slot', async () => {
    const ring = mountEditor(RING).w
    await open(ring, 'scroll')
    await ring.find('[data-test="scroll-add"]').trigger('click')
    expect(optionTexts(ring, '[data-test="scroll-id"]')).not.toContain('咒文的痕跡 15%')
    const cap = mountEditor(CAP_BOSS).w
    await open(cap, 'scroll')
    await cap.find('[data-test="scroll-add"]').trigger('click')
    expect(optionTexts(cap, '[data-test="scroll-id"]')).toContain('咒文的痕跡 15%')
  })

  it('scroll tab shows recovery expectation when a recovery scroll is chosen', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    await addScroll(w, 'trace30', 3)
    expect(w.find('[data-test="scroll-expect"]').text()).toContain('10') // 3 / 0.3
    expect(w.find('[data-test="scroll-recovery-used"]').exists()).toBe(false)
    await w.find('[data-test="scroll-recovery"]').setValue('cleanSlate')
    const rec = w.find('[data-test="scroll-recovery-used"]').text()
    expect(rec).toContain('純白卷軸')
    expect(rec).toContain('7') // 7 expected failures, recovered at 100%
  })

  it('scroll tab shows overflow warning', async () => {
    const { w } = mountEditor(RING) // tuc 2
    await open(w, 'scroll')
    expect(w.find('[data-test="scroll-overflow"]').exists()).toBe(false)
    await addScroll(w, 'x', 5)
    expect(w.find('[data-test="scroll-overflow"]').text()).toContain('超出可上卷次數 3')
  })

  it('marks the guessed spell trace 4th-success rule as 推測', async () => {
    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'scroll')
    expect(w.find('[data-test="panel-scroll"] [data-test="guess-notice"]').exists()).toBe(false)
    await addScroll(w, 'trace100', 4)
    expect(w.find('[data-test="panel-scroll"] [data-test="guess-notice"]').text()).toContain('推測')

    // The guessed bonus is an armor rule: no note on an accessory.
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
})

describe('HammerTab', () => {
  it('writes uses into the state and shows 規則待查證 for platinum refine', async () => {
    const { w, state } = mountEditor(CAP_BOSS)
    await open(w, 'hammer')
    await w.find('[data-test="hammer-platinum"]').setValue('3')
    expect(state.hammer.platinum).toBe(3)
    expect(w.find('[data-test="hammer-expect-platinum"]').text()).toContain('規則待查證')
    await w.find('[data-test="hammer-golden"]').setValue('1')
    expect(w.find('[data-test="hammer-expect-golden"]').text()).toContain('24,000')
  })

  it('surfaces why hammer uses are ignored (blocked / max)', async () => {
    const blocked = mountEditor(BLOCKED).w
    await open(blocked, 'hammer')
    expect((blocked.find('[data-test="hammer-golden"]').element as HTMLInputElement).disabled).toBe(true)
    expect(blocked.find('[data-test="hammer-reason-golden"]').text()).toContain('不可使用')

    const { w } = mountEditor(CAP_BOSS)
    await open(w, 'hammer')
    await w.find('[data-test="hammer-platinum"]').setValue('9')
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

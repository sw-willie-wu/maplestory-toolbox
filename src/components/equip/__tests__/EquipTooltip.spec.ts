import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EquipTooltip from '../EquipTooltip.vue'
import ItemIcon from '../ItemIcon.vue'
import { tooltipSummary } from '../summary'
import { computeBreakdown, emptyState, lockedTabs, type EquipBreakdown, type EnhanceState } from '@/utils/mst/enhance/equip'
import { STARFORCE } from '@/utils/mst/enhance/rules/starforce'
import type { EquipData } from '@/utils/mst/enhance/types'

function equip(p: Partial<EquipData> = {}): EquipData {
  return {
    id: 1113211,
    name: '天上的氣息',
    category: 'Ring',
    slot: 'Ri',
    level: 150,
    jobs: 'all',
    isWeapon: false,
    isMagicWeapon: false,
    base: { str: 25, att: 25 },
    tuc: 2,
    cash: false,
    setId: null,
    bossReward: false,
    canStarforce: true,
    canFlame: false,
    canExceptional: false,
    tradeBlock: true,
    superior: false,
    blockGoldHammer: false,
    exceptionalMax: 0,
    flameBoss: false,
    timeLimited: false,
    fixedPotential: false,
    eventVariant: false,
    accountShare: false,
    searchCategory: 'Accessory',
    searchDetail: 'Ring',
    specJob: null,
    ...p
  }
}

function breakdown(p: Partial<EquipBreakdown> = {}): EquipBreakdown {
  return {
    base: { str: 25, att: 25 },
    scroll: { att: 68 },
    starforce: { str: 117, att: 145 },
    flame: {},
    exceptional: {},
    total: { str: 142, att: 238 },
    exceptionalNoData: false,
    star: 25,
    starforceUnsourced: false,
    ...p
  }
}

function render(opts: {
  e?: EquipData
  b?: EquipBreakdown
  s?: EnhanceState
  specJob?: { name: string; guess: boolean } | null
  compact?: boolean
  tags?: string[]
} = {}) {
  const e = opts.e ?? equip()
  const s = opts.s ?? { ...emptyState(e), star: 25 }
  const b = opts.b ?? breakdown()
  const locked = lockedTabs(e)
  return mount(EquipTooltip, {
    props: {
      equip: e,
      breakdown: b,
      state: s,
      summary: tooltipSummary(e, s, b, locked),
      locked,
      specJob: opts.specJob ?? null,
      compact: opts.compact ?? false,
      tags: opts.tags ?? []
    }
  })
}

const statLine = (w: ReturnType<typeof render>, label: string) => {
  const line = w.findAll('[data-test="stat-line"]').find((l) => l.find('.stat-label').text() === label)
  if (!line) throw new Error(`no stat line ${label}`)
  return line
}

describe('EquipTooltip', () => {
  it('renders stat line as total (base +starforce +scroll)', () => {
    const w = render({ b: breakdown({ flame: { att: 3 }, total: { str: 142, att: 241 } }) })
    const str = statLine(w, 'STR')
    expect(str.text()).toContain('+142')
    expect(str.text()).toContain('(25 +117)')
    expect(str.find('.sf').text()).toBe('+117')

    const att = statLine(w, '攻擊力')
    expect(att.text()).toContain('+241')
    expect(att.text()).toContain('(25 +145 +68 +3)')
    expect(att.find('.sf').text()).toBe('+145')
    expect(att.find('.sc').text()).toBe('+68')
    expect(att.find('.fl').text()).toBe('+3')
  })

  it('renders a base-only stat without the breakdown', () => {
    const b = breakdown({ base: { speed: 18 }, scroll: {}, starforce: {}, total: { speed: 18 } })
    const line = statLine(render({ b }), '移動速度')
    expect(line.text()).toBe('移動速度+18')
  })

  it('renders N stars with M lit (max from STARFORCE.maxStarByLevel)', () => {
    const w = render()
    const max = STARFORCE.maxStarByLevel(150)
    expect(w.findAll('.star')).toHaveLength(max)
    expect(w.findAll('.star.lit')).toHaveLength(25)

    const low = equip({ level: 100 })
    const w2 = render({ e: low, b: breakdown({ star: 3 }) })
    expect(w2.findAll('.star')).toHaveLength(STARFORCE.maxStarByLevel(100))
    expect(w2.findAll('.star.lit')).toHaveLength(3)
  })

  it('shows lit stars from breakdown.star, not the raw state', () => {
    const e = equip({ level: 100 })
    const w = render({ e, s: { ...emptyState(e), star: 25 }, b: breakdown({ star: 8 }) })
    expect(w.findAll('.star.lit')).toHaveLength(8)
  })

  it('shows 無法強化 for locked flame', () => {
    const w = render({ e: equip({ canFlame: false }) })
    expect(w.find('[data-test="summary-flame"]').text()).toContain('無法強化')
    const w2 = render({ e: equip({ canFlame: true }) })
    expect(w2.find('[data-test="summary-flame"]').text()).not.toContain('無法強化')
  })

  it('shows the scroll and hammer summary', () => {
    const e = equip()
    const s: EnhanceState = { ...emptyState(e), hammer: { platinum: 5 } }
    const w = render({ e, s, b: computeBreakdown(e, s) })
    const scroll = w.find('[data-test="summary-scroll"]').text()
    expect(scroll).toContain('0次')
    expect(scroll).toContain('剩餘7次')
    expect(scroll).toContain('可恢復0次')
    expect(w.find('[data-test="summary-hammer"]').text()).toContain('5/5')
  })

  it('shows a hammer row only when that hammer was used', () => {
    const e = equip()
    const s: EnhanceState = { ...emptyState(e), hammer: { platinum: 5 } }
    const hammer = render({ e, s, b: computeBreakdown(e, s) }).find('[data-test="summary-hammer"]').text()
    expect(hammer).toContain('白金鐵鎚')
    expect(hammer).not.toContain('黃金鐵鎚')
    const none = emptyState(e)
    expect(render({ e, s: none, b: computeBreakdown(e, none) }).find('[data-test="summary-hammer"]').exists()).toBe(false)
  })

  it('does not show a set line (user decision 2026-11-09)', () => {
    const w = render({ e: { ...equip(), setId: 889 } })
    expect(w.find('[data-test="set"]').exists()).toBe(false)
    expect(w.text()).not.toContain('套裝')
  })

  it('shows the special job restriction, marking guesses', () => {
    expect(render({ specJob: { name: '狂狼勇士', guess: false } }).text()).toContain('狂狼勇士')
    const w = render({ specJob: { name: '龍魔導士', guess: true } })
    expect(w.find('[data-test="spec-job"]').text()).toContain('龍魔導士(推測)')
  })

  it('uses ItemIcon for the equip icon and falls back to its placeholder on error', async () => {
    const w = render()
    expect(w.findComponent(ItemIcon).props('itemId')).toBe(1113211)
    const img = w.find('[data-test="tt-icon"] img')
    expect(img.attributes('src')).toContain('https://open.api.nexon.com/static/maplestorytw/item/icon/')
    await img.trigger('error')
    expect(w.find('[data-test="tt-icon"] img').exists()).toBe(false)
    expect(w.find('[data-test="icon-placeholder"]').exists()).toBe(true)
  })

  it('treats a 1x1 (HTTP 204) icon as missing', async () => {
    const w = render()
    const el = w.find('[data-test="tt-icon"] img').element as HTMLImageElement
    Object.defineProperty(el, 'naturalWidth', { value: 1 })
    Object.defineProperty(el, 'naturalHeight', { value: 1 })
    await w.find('[data-test="tt-icon"] img').trigger('load')
    expect(w.find('[data-test="icon-placeholder"]').exists()).toBe(true)
  })

  it('shows exceptional part only when available', () => {
    const withEx = render({
      b: breakdown({ exceptional: { str: 15 }, total: { str: 157, att: 238 } })
    })
    const str = statLine(withEx, 'STR')
    expect(str.text()).toContain('+157')
    expect(str.find('.ex').text()).toBe('+15')

    expect(render().find('.ex').exists()).toBe(false)
    const noData = render({ b: breakdown({ exceptional: {}, exceptionalNoData: true }) })
    expect(noData.find('.ex').exists()).toBe(false)
  })

  it('renders a condensed version when compact', () => {
    const w = render({ compact: true })
    expect(w.classes()).toContain('compact')
    expect(w.text()).toContain('天上的氣息')
    expect(w.text()).toContain('25')
    expect(w.text()).not.toContain('(25 +117)')
  })

  it('shows combat power placeholder +0', () => {
    const cp = render().find('[data-test="combat-power"]')
    expect(cp.text()).toContain('戰鬥力提升量')
    expect(cp.find('.cp-value').text()).toBe('+ 0')
  })

  it('shows two tags: category and detail names', () => {
    const tags = render({ tags: ['飾品', '戒指'] }).findAll('.tag')
    expect(tags.map((t) => t.text())).toEqual(['飾品', '戒指'])
    // same category and detail name → still two tags (index keys, no duplicate-key collapse)
    expect(render({ tags: ['機器人', '機器人'] }).findAll('.tag')).toHaveLength(2)
  })

  it('no job row', () => {
    const w = render()
    expect(w.text()).not.toContain('初心者')
    expect(w.find('[data-test="job-row"]').exists()).toBe(false)
    const meta = w.find('[data-test="meta"]').text()
    expect(meta).toContain('裝備職業')
    expect(meta).toContain('共用')
    expect(meta).toContain('要求等級')
    expect(meta).toContain('Lv.150')
  })

  it('stars use 11px and groups of five', () => {
    const w = render()
    const rows = w.findAll('.star-row')
    expect(rows).toHaveLength(2) // 30 stars at Lv.150
    for (const row of rows) {
      const groups = row.findAll('.star-group')
      expect(groups).toHaveLength(3)
      for (const g of groups) expect(g.findAll('.star')).toHaveLength(5)
    }
  })

  it('shows status lines in game wording', () => {
    const e = equip()
    const s: EnhanceState = { ...emptyState(e), hammer: { platinum: 5 } }
    const w = render({ e, s, b: computeBreakdown(e, s) })
    expect(w.find('[data-test="summary-flame"]').text()).toBe('追加屬性 無法強化')
    expect(w.find('[data-test="summary-scroll"]').text()).toBe('卷軸 強化 0次（剩餘7次，可恢復0次）')
    expect(w.find('[data-test="summary-hammer"]').text()).toBe('白金鐵鎚 提煉 5/5')
  })

  it('marks potential grades with a letter badge', () => {
    const e = equip()
    const s: EnhanceState = {
      ...emptyState(e),
      potential: { grade: '傳說', lines: ['LUK +12%', null, '全屬性 +9%'] },
      additional: { grade: '稀有', lines: ['LUK +2%', null, null] }
    }
    const pots = render({ e, s }).findAll('[data-test="potential"]')
    expect(pots).toHaveLength(2)
    expect(pots[0].find('.badge').text()).toBe('L')
    expect(pots[0].find('.badge').classes()).toContain('L')
    expect(pots[0].text()).toContain('潛在能力：傳說')
    expect(pots[0].findAll('li').map((l) => l.text())).toEqual(['LUK +12%', '全屬性 +9%'])
    expect(pots[1].find('.badge').text()).toBe('E')
    expect(pots[1].text()).toContain('附加潛在能力：稀有')
  })

  it('placeholder renders 請選擇裝備 without stats', () => {
    const w = mount(EquipTooltip, { props: { placeholder: true } })
    expect(w.find('[data-test="tooltip-placeholder"]').exists()).toBe(true)
    expect(w.text()).toContain('請選擇裝備')
    expect(w.findAll('[data-test="stat-line"]')).toHaveLength(0)
    expect(w.find('.star').exists()).toBe(false)
    expect(w.findComponent(ItemIcon).props('itemId')).toBeNull()
  })

  it('compact mode still renders name, stars and stat summary', () => {
    const w = render({ compact: true })
    expect(w.find('.equip-name').text()).toBe('天上的氣息')
    expect(w.find('[data-test="compact-stars"]').text()).toContain('25/30')
    const stats = w.findAll('[data-test="stat-line"]')
    expect(stats.map((l) => l.find('.stat-label').text())).toEqual(['STR', '攻擊力'])
    expect(stats[0].text()).toContain('+142')
    expect(w.findComponent(ItemIcon).props('itemId')).toBe(1113211)
  })
})

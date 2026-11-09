import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EquipTooltip from '../EquipTooltip.vue'
import { tooltipSummary } from '../summary'
import { computeBreakdown, emptyState, lockedTabs, type EquipBreakdown, type EnhanceState } from '@/utils/mst/enhance/equip'
import { STARFORCE } from '@/utils/mst/enhance/rules/starforce'
import type { EquipData, SetInfo } from '@/utils/mst/enhance/types'

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
  setInfo?: SetInfo | null
  specJob?: { name: string; guess: boolean } | null
  compact?: boolean
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
      setInfo: opts.setInfo ?? null,
      specJob: opts.specJob ?? null,
      compact: opts.compact ?? false
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

  it('shows set name and count when setInfo given', () => {
    const info: SetInfo = { name: '永恆套裝', completeCount: 7, effects: {}, jokerPossible: true, zeroWeaponJokerPossible: false }
    const w = render({ setInfo: info })
    expect(w.find('[data-test="set"]').text()).toContain('永恆套裝')
    expect(w.find('[data-test="set"]').text()).toContain('7')
    expect(render().find('[data-test="set"]').exists()).toBe(false)
  })

  it('shows the special job restriction, marking guesses', () => {
    expect(render({ specJob: { name: '狂狼勇士', guess: false } }).text()).toContain('狂狼勇士')
    const w = render({ specJob: { name: '龍魔導士', guess: true } })
    expect(w.find('[data-test="spec-job"]').text()).toContain('龍魔導士(推測)')
  })

  it('falls back to placeholder when icon fails to load', async () => {
    const w = render()
    const img = w.find('img.equip-icon')
    expect(img.attributes('src')).toContain('https://open.api.nexon.com/static/maplestorytw/item/icon/')
    await img.trigger('error')
    expect(w.find('img.equip-icon').exists()).toBe(false)
    expect(w.find('[data-test="icon-placeholder"]').exists()).toBe(true)
  })

  it('treats the CDN empty image (256x256 after the 308 redirect) as missing', async () => {
    const w = render()
    const el = w.find('img.equip-icon').element as HTMLImageElement
    Object.defineProperty(el, 'naturalWidth', { value: 256 })
    Object.defineProperty(el, 'naturalHeight', { value: 256 })
    await w.find('img.equip-icon').trigger('load')
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
})

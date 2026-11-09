import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EnhanceSidebar from '../EnhanceSidebar.vue'
import LineIcon from '../ui/LineIcon.vue'
import { lockReasons, PANELS, type PanelId } from '../panels'
import { loadEquipSync } from '@/utils/mst/enhance/__tests__/helpers'

const RING = 1113211 // flame + exceptional locked
const CAP_BOSS = 1005983
const SUPERIOR = 1072732
const MEDAL = 1143471 // tuc 0: scroll + hammer locked

describe('panels', () => {
  it('lists the enhancement panels in game order with game names', () => {
    expect(PANELS.map((p) => p.label)).toEqual([
      '星力',
      '卷軸',
      '強化次數增加',
      '星火',
      '潛在能力',
      '附加潛在能力',
      '卓越',
      '反算'
    ])
    expect(PANELS.map((p) => p.id)).toEqual([
      'starforce',
      'scroll',
      'hammer',
      'flame',
      'potential',
      'bonusPotential',
      'exceptional',
      'reverse'
    ])
  })

  it('lockReasons: every enhancement panel (not the picker) says 請先選擇裝備 without an equip', () => {
    const m = lockReasons(null)
    expect([...m.keys()].sort()).toEqual(PANELS.map((p) => p.id).sort())
    expect(m.has('picker')).toBe(false)
    expect(new Set(m.values())).toEqual(new Set(['請先選擇裝備']))
  })

  it('lockReasons uses game names', () => {
    expect(lockReasons(loadEquipSync(RING)).get('flame')).toBe('此裝備無法使用星火')
    expect(lockReasons(loadEquipSync(RING)).get('exceptional')).toContain('卓越')
    expect(lockReasons(loadEquipSync(SUPERIOR)).get('starforce')).toContain('不支援')
    expect(lockReasons(loadEquipSync(MEDAL)).get('hammer')).toContain('強化次數增加')
    const cap = lockReasons(loadEquipSync(CAP_BOSS))
    for (const id of ['starforce', 'scroll', 'hammer', 'potential', 'bonusPotential', 'reverse'] as PanelId[]) {
      expect(cap.has(id)).toBe(false)
    }
  })
})

describe('EnhanceSidebar', () => {
  const ring = loadEquipSync(RING)

  it('marks the active item and emits select', async () => {
    const w = mount(EnhanceSidebar, { props: { equip: ring, active: 'scroll', locked: lockReasons(ring) } })
    expect(w.find('[data-test="side-scroll"]').classes()).toContain('on')
    expect(w.find('[data-test="side-scroll"]').attributes('aria-current')).toBe('true')
    expect(w.findAllComponents(LineIcon)).toHaveLength(PANELS.length)
    await w.find('[data-test="side-hammer"]').trigger('click')
    await w.find('[data-test="side-picker"]').trigger('click')
    expect(w.emitted('select')).toEqual([['hammer'], ['picker']])
  })

  it('locked items are greyed with the reason and do not emit', async () => {
    const w = mount(EnhanceSidebar, { props: { equip: ring, active: 'starforce', locked: lockReasons(ring) } })
    const flame = w.find('[data-test="side-flame"]')
    expect(flame.attributes('aria-disabled')).toBe('true')
    expect(flame.classes()).toContain('off')
    expect(flame.attributes('title')).toBe('此裝備無法使用星火')
    await flame.trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })

  it('part="equip" renders only the equip cell and emits picker', async () => {
    const w = mount(EnhanceSidebar, {
      props: { equip: ring, active: 'starforce', locked: lockReasons(ring), part: 'equip' }
    })
    expect(w.find('[data-test="side-picker"]').text()).toContain('天上的氣息')
    for (const p of PANELS) expect(w.find(`[data-test="side-${p.id}"]`).exists()).toBe(false)
    expect(w.find('[role="separator"]').exists()).toBe(false)
    await w.find('[data-test="side-picker"]').trigger('click')
    expect(w.emitted('select')).toEqual([['picker']])
  })

  it('part="tabs" renders the 8 panels as a tab row without the equip cell', async () => {
    const w = mount(EnhanceSidebar, {
      props: { equip: ring, active: 'scroll', locked: lockReasons(ring), part: 'tabs' }
    })
    expect(w.classes()).toContain('eq-side--tabs')
    expect(w.find('[data-test="side-picker"]').exists()).toBe(false)
    expect(w.find('[role="separator"]').exists()).toBe(false)
    expect(w.findAll('.eq-side__btn').map((b) => b.text())).toEqual(PANELS.map((p) => p.label))
    expect(w.findAllComponents(LineIcon)).toHaveLength(PANELS.length)
    expect(w.find('[data-test="side-scroll"]').classes()).toContain('on')
    expect(w.find('[data-test="side-flame"]').attributes('title')).toBe('此裝備無法使用星火')
    await w.find('[data-test="side-flame"]').trigger('click')
    await w.find('[data-test="side-hammer"]').trigger('click')
    expect(w.emitted('select')).toEqual([['hammer']])
  })

  it('shows 請選擇裝備 in the first cell without an equip', () => {
    const w = mount(EnhanceSidebar, { props: { equip: null, active: 'starforce', locked: lockReasons(null) } })
    expect(w.find('[data-test="side-picker"]').text()).toContain('請選擇裝備')
    expect(w.find('[data-test="side-picker"]').text()).toContain('選擇裝備')
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToggleSwitch from '../ToggleSwitch.vue'

describe('ToggleSwitch', () => {
  it('toggle emits and reflects aria-checked', async () => {
    const w = mount(ToggleSwitch, { props: { modelValue: false, label: '防爆' } })
    const btn = w.find('button[role="switch"]')
    expect(btn.attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('防爆')
    await btn.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
    await w.setProps({ modelValue: true })
    expect(btn.attributes('aria-checked')).toBe('true')
    await btn.trigger('click')
    expect(w.emitted('update:modelValue')?.[1]).toEqual([false])
  })

  it('toggle disabled does not emit', async () => {
    const w = mount(ToggleSwitch, { props: { modelValue: false, label: '防爆', disabled: true } })
    const btn = w.find('button[role="switch"]')
    expect(btn.attributes('disabled')).toBeDefined()
    await btn.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})

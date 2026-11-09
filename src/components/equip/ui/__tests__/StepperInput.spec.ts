import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StepperInput from '../StepperInput.vue'

function lastEmit(w: ReturnType<typeof mount>): unknown {
  const ev = w.emitted('update:modelValue')
  return ev ? ev[ev.length - 1][0] : undefined
}

describe('StepperInput', () => {
  it('stepper clamps on buttons', async () => {
    const w = mount(StepperInput, { props: { modelValue: 30, min: 0, max: 30, ariaLabel: '目標星數' } })
    const [minus, plus] = w.findAll('button')
    await plus.trigger('click')
    expect(lastEmit(w)).toBe(30)
    await minus.trigger('click')
    expect(lastEmit(w)).toBe(29)

    const w0 = mount(StepperInput, { props: { modelValue: 0, min: 0, max: 30, ariaLabel: 'x' } })
    await w0.findAll('button')[0].trigger('click')
    expect(lastEmit(w0)).toBe(0)
  })

  it('stepper respects step', async () => {
    const w = mount(StepperInput, { props: { modelValue: 10, min: 0, max: 12, step: 5, ariaLabel: 'x' } })
    await w.findAll('button')[1].trigger('click')
    expect(lastEmit(w)).toBe(12)
  })

  it('stepper plus on null yields min', async () => {
    const w = mount(StepperInput, { props: { modelValue: null, min: 3, max: 30, nullable: true, ariaLabel: 'x' } })
    await w.findAll('button')[1].trigger('click')
    expect(lastEmit(w)).toBe(3)
  })

  it('precision keeps decimals when normalizing and steps by step', async () => {
    const w = mount(StepperInput, {
      props: { modelValue: null, min: -Infinity, nullable: true, precision: 2, ariaLabel: 'x' }
    })
    const input = w.find('input')
    await input.setValue('2.345')
    await input.trigger('blur')
    expect(lastEmit(w)).toBe(2.35)
    expect((input.element as HTMLInputElement).value).toBe('2.35')
    await input.setValue('-3.5')
    await input.trigger('blur')
    expect(lastEmit(w)).toBe(-3.5)
    await w.setProps({ modelValue: 2.5 })
    await w.findAll('button')[1].trigger('click')
    expect(lastEmit(w)).toBe(3.5)
  })

  it('without precision input is still rounded to an integer', async () => {
    const w = mount(StepperInput, { props: { modelValue: 0, min: 0, ariaLabel: 'x' } })
    await w.find('input').setValue('2.5')
    await w.find('input').trigger('blur')
    expect(lastEmit(w)).toBe(3)
  })

  it('stepping from null starts at 0 when the range allows negatives', async () => {
    const w = mount(StepperInput, { props: { modelValue: null, min: -Infinity, nullable: true, ariaLabel: 'x' } })
    await w.findAll('button')[0].trigger('click')
    expect(lastEmit(w)).toBe(0)
    await w.setProps({ modelValue: 0 })
    await w.findAll('button')[0].trigger('click')
    expect(lastEmit(w)).toBe(-1)
  })

  it('stepper normalizes empty/NaN/decimal/out-of-range input', async () => {
    const cases: [string, number, string][] = [
      ['', 0, '0'],
      ['abc', 0, '0'],
      ['7.6', 8, '8'],
      ['35', 30, '30'],
      ['-4', 0, '0']
    ]
    for (const [typed, expected, shown] of cases) {
      const w = mount(StepperInput, { props: { modelValue: 5, min: 0, max: 30, ariaLabel: 'x' } })
      const input = w.find('input')
      await input.setValue(typed)
      await input.trigger('blur')
      expect(lastEmit(w)).toBe(expected)
      expect((input.element as HTMLInputElement).value).toBe(shown)
    }
  })

  it('stepper normalizes on Enter and writes back even when value unchanged', async () => {
    // modelValue already equals the clamped value → parent would not re-render; input must still show it
    const w = mount(StepperInput, { props: { modelValue: 30, min: 0, max: 30, ariaLabel: 'x' } })
    const input = w.find('input')
    await input.setValue('99')
    await input.trigger('keydown', { key: 'Enter' })
    expect(lastEmit(w)).toBe(30)
    expect((input.element as HTMLInputElement).value).toBe('30')
  })

  it('stepper reflects external modelValue changes', async () => {
    const w = mount(StepperInput, { props: { modelValue: 3, min: 0, max: 30, ariaLabel: 'x' } })
    await w.setProps({ modelValue: 12 })
    expect((w.find('input').element as HTMLInputElement).value).toBe('12')
  })

  it('stepper shows suffix', () => {
    const w = mount(StepperInput, { props: { modelValue: 25, min: 0, max: 30, suffix: '/ 30', ariaLabel: 'x' } })
    expect(w.text()).toContain('/ 30')
  })

  it('nullable stepper keeps blank as null', async () => {
    const w = mount(StepperInput, { props: { modelValue: 5, min: 0, max: 30, nullable: true, ariaLabel: 'x' } })
    const input = w.find('input')
    await input.setValue('')
    await input.trigger('blur')
    expect(lastEmit(w)).toBeNull()
    expect((input.element as HTMLInputElement).value).toBe('')
    await input.setValue('abc')
    await input.trigger('blur')
    expect(lastEmit(w)).toBeNull()
  })

  it('stepper without max allows large values', async () => {
    const w = mount(StepperInput, { props: { modelValue: 0, min: 0, ariaLabel: 'x' } })
    const input = w.find('input')
    await input.setValue('123456789')
    await input.trigger('blur')
    expect(lastEmit(w)).toBe(123456789)
    await w.setProps({ modelValue: 123456789 })
    await w.findAll('button')[1].trigger('click')
    expect(lastEmit(w)).toBe(123456790)
  })

  it('attrs (data-test) land on inner input', () => {
    const w = mount(StepperInput, {
      props: { modelValue: 1, min: 0, ariaLabel: '目前星數' },
      attrs: { 'data-test': 'sf-current', id: 'sf-cur' }
    })
    const input = w.find('[data-test="sf-current"]')
    expect(input.exists()).toBe(true)
    expect(input.element.tagName).toBe('INPUT')
    expect(input.attributes('id')).toBe('sf-cur')
    expect(input.attributes('aria-label')).toBe('目前星數')
    expect(w.element.getAttribute('data-test')).toBeNull()
  })
})

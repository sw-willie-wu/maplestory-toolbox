import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LineIcon, { type LineIconName } from '../LineIcon.vue'

const NAMES: LineIconName[] = [
  'starforce',
  'scroll',
  'hammer',
  'flame',
  'potential',
  'bonusPotential',
  'exceptional',
  'reverse'
]

describe('LineIcon', () => {
  it('line icon renders svg without emoji', () => {
    for (const name of NAMES) {
      const w = mount(LineIcon, { props: { name } })
      const svg = w.find('svg')
      expect(svg.exists(), name).toBe(true)
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.attributes('stroke')).toBe('currentColor')
      expect(svg.attributes('stroke-width')).toBe('1.6')
      expect(svg.attributes('stroke-linecap')).toBe('round')
      expect(svg.findAll('path, circle').length, name).toBeGreaterThan(0)
      // eslint-disable-next-line no-control-regex
      expect(/[^\x00-\x7F]/.test(w.text()), name).toBe(false)
    }
  })

  it('flame icon is the crystal + facets + flame + sparkle set', () => {
    const w = mount(LineIcon, { props: { name: 'flame' } })
    expect(w.findAll('path').length).toBe(4)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EnhanceSidebar from '../EnhanceSidebar.vue'
import { lockReasons } from '../panels'
import { loadEquipSync } from '@/utils/mst/enhance/__tests__/helpers'

// Exceptional rules unavailable (EXCEPTIONAL === null in a future data set).
vi.mock('@/utils/mst/enhance/exceptional', async (orig) => ({
  ...(await orig<typeof import('@/utils/mst/enhance/exceptional')>()),
  exceptionalAvailable: () => false
}))

describe('EnhanceSidebar without exceptional rules', () => {
  it('greys out 卓越 with its reason instead of hiding it', () => {
    const equip = loadEquipSync(1012632) // canExceptional, exceptionalMax 1
    const locked = lockReasons(equip)
    const w = mount(EnhanceSidebar, { props: { equip, active: 'starforce', locked } })
    expect(w.find('[data-test="side-starforce"]').attributes('aria-disabled')).toBeUndefined()
    const ex = w.find('[data-test="side-exceptional"]')
    expect(ex.exists()).toBe(true)
    expect(ex.attributes('aria-disabled')).toBe('true')
    expect(ex.attributes('title')).toBe('此裝備無法卓越強化')
  })
})

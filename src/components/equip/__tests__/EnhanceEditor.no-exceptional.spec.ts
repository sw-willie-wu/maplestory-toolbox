import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import EnhanceEditor from '../EnhanceEditor.vue'
import { emptyState } from '@/utils/mst/enhance/equip'
import { loadEquipSync } from '@/utils/mst/enhance/__tests__/helpers'

// Exceptional rules unavailable (EXCEPTIONAL === null in a future data set).
vi.mock('@/utils/mst/enhance/exceptional', async (orig) => ({
  ...(await orig<typeof import('@/utils/mst/enhance/exceptional')>()),
  exceptionalAvailable: () => false
}))

describe('EnhanceEditor without exceptional rules', () => {
  it('hides exceptional tab when rules unavailable', () => {
    const equip = loadEquipSync(1012632) // canExceptional, exceptionalMax 1
    // locked omitted → the editor derives it with lockedTabs(equip)
    const w = mount(EnhanceEditor, { props: { equip, state: reactive(emptyState(equip)), potentialOptions: null } })
    expect(w.find('[data-test="tab-starforce"]').exists()).toBe(true)
    expect(w.find('[data-test="tab-exceptional"]').exists()).toBe(false)
  })
})

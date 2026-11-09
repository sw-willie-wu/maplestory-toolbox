import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemIcon from '../ItemIcon.vue'
import { iconUrl } from '@/utils/mst/icon'

const RING = 1113211

/** Fires load on the <img> with the given natural size (jsdom never loads images). */
async function loadWith(w: ReturnType<typeof mount>, width: number, height: number) {
  const img = w.find('img')
  Object.defineProperty(img.element, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(img.element, 'naturalHeight', { value: height, configurable: true })
  await img.trigger('load')
}

describe('ItemIcon', () => {
  it('renders the Nexon CDN icon at the given size', () => {
    const w = mount(ItemIcon, { props: { itemId: RING, size: 34 } })
    expect(w.find('img').attributes('src')).toBe(iconUrl(RING))
    expect(w.attributes('style')).toContain('width: 34px')
    expect(w.find('[data-test="icon-placeholder"]').exists()).toBe(false)
  })

  it('ItemIcon shows placeholder for null id, load error and empty_img', async () => {
    const none = mount(ItemIcon, { props: { itemId: null } })
    expect(none.find('img').exists()).toBe(false)
    expect(none.find('[data-test="icon-placeholder"]').exists()).toBe(true)

    const broken = mount(ItemIcon, { props: { itemId: RING } })
    await broken.find('img').trigger('error')
    expect(broken.find('img').exists()).toBe(false)
    expect(broken.find('[data-test="icon-placeholder"]').exists()).toBe(true)

    // CDN redirects unknown codes to its 256×256 empty_img.png
    const empty = mount(ItemIcon, { props: { itemId: RING } })
    await loadWith(empty, 256, 256)
    expect(empty.find('[data-test="icon-placeholder"]').exists()).toBe(true)

    // HTTP 204 (no image body) → zero-size load
    const noBody = mount(ItemIcon, { props: { itemId: RING } })
    await loadWith(noBody, 0, 0)
    expect(noBody.find('[data-test="icon-placeholder"]').exists()).toBe(true)

    const ok = mount(ItemIcon, { props: { itemId: RING } })
    await loadWith(ok, 32, 31)
    expect(ok.find('img').exists()).toBe(true)
    expect(ok.find('[data-test="icon-placeholder"]').exists()).toBe(false)
  })

  it('retries the image when the item id changes', async () => {
    const w = mount(ItemIcon, { props: { itemId: RING } })
    await w.find('img').trigger('error')
    await w.setProps({ itemId: 1003601 })
    expect(w.find('img').attributes('src')).toBe(iconUrl(1003601))
  })

  it('shows the placeholder for an id the icon code cannot encode', () => {
    const w = mount(ItemIcon, { props: { itemId: -1 } })
    expect(w.find('[data-test="icon-placeholder"]').exists()).toBe(true)
  })
})

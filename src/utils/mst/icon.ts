// Item icons are served by NEXON Open API's static CDN (TMS).
// The 8-letter code is derived from the zero-padded 8-digit item ID:
// each digit d at position p maps to chr(65 + (d ^ KEY[p])).
// Undocumented (reverse-engineered 2026-11): if NEXON changes it, the CDN
// redirects unknown codes to /static/empty_img.png.
const ICON_BASE = 'https://open.api.nexon.com/static/maplestorytw/item/icon/'
const KEY = [10, 5, 15, 2, 11, 7, 14, 1]

export const encodeIconCode = (itemId: number): string => {
  if (!Number.isInteger(itemId) || itemId < 0 || itemId > 99999999) {
    throw new RangeError(`invalid item id: ${itemId}`)
  }
  return itemId
    .toString()
    .padStart(8, '0')
    .split('')
    .map((d, p) => String.fromCharCode(65 + (Number(d) ^ KEY[p])))
    .join('')
}

export const iconUrl = (itemId: number): string => ICON_BASE + encodeIconCode(itemId)

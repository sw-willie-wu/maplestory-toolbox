// Star force stat bonuses, checked against every supported fixture item (Nexon API export).
import { describe, expect, it } from 'vitest'
import { starforceStats, starforceUnsourced } from '../starforce'
import { STARFORCE } from '../rules/starforce'
import type { Stats } from '../types'
import fixture from './fixtures/nexon-items.json'
import { add, loadEquipSync, loadIndexSync, nonZero } from './helpers'

interface FixtureItem {
  id: number
  name: string
  starforce: number
  base: Stats
  scroll: Stats
  starforceStats: Stats
}

const items = (fixture as FixtureItem[]).filter((f) => f.starforce > 0)
const indexed = new Set(loadIndexSync().map((e) => e.id))
const inIndex = items.filter((f) => indexed.has(f.id))
const supported = inIndex.filter((f) => STARFORCE.supports(loadEquipSync(f.id)))

const find = (id: number): FixtureItem => {
  const f = items.find((i) => i.id === id)
  if (!f) throw new Error(`fixture item ${id} missing`)
  return f
}
const calc = (f: FixtureItem): Stats => starforceStats(loadEquipSync(f.id), f.starforce, add(f.base, f.scroll))

describe('starforceStats', () => {
  it('fixture coverage: every item resolves and every star-forced fixture item is supported', () => {
    expect(inIndex.length).toBe(items.length)
    const skipped = new Set(inIndex.filter((f) => !supported.includes(f)).map((f) => f.id))
    expect(skipped).toEqual(new Set())
  })

  it('172xxxx 阿斯特拉 secondaries: DEF only through 15★ (0 DEF → fixed +16 at 19–25★)', () => {
    const ids = [1723902, 1720602, 1721102, 1720801, 1722902]
    for (const id of ids) {
      const f = find(id)
      expect(f.starforce).toBeGreaterThan(15)
      expect(calc(f).def, `${id}`).toBe(16)
    }
    const equip = loadEquipSync(1723902)
    expect(STARFORCE.statTable.defMaxStar(equip)).toBe(15)
    expect(STARFORCE.statTable.defMaxStar(loadEquipSync(1005983))).toBe(Infinity)
    // 15★ and below are unchanged by the cap
    expect(starforceStats(equip, 15, {}).def).toBe(16)
    expect(starforceStats(equip, 8, {}).def).toBe(9)
  })

  it.each(supported.map((f) => [f.id, f.name, f.starforce, f] as const))(
    '%i %s %i★ matches the Nexon export',
    (_id, _name, _star, f) => {
      expect(calc(f)).toEqual(nonZero(f.starforceStats))
    },
  )

  it('job stats get 1–15★, scrolled off-job stats only 16–22★ (thief cap 25★: STR/INT 119, DEX/LUK 159)', () => {
    const s = calc(find(1005983)) // 永恆盜賊頭巾
    expect(s.str).toBe(119)
    expect(s.int).toBe(119)
    expect(s.dex).toBe(159)
    expect(s.luk).toBe(159)
  })

  it('common equip gets all four (天上的氣息 25★ → 117 each)', () => {
    const f = items.find((i) => i.name === '天上的氣息' && i.starforce === 25)
    if (!f) throw new Error('天上的氣息 25★ missing from fixture')
    const s = calc(f)
    for (const k of ['str', 'dex', 'int', 'luk'] as const) expect(s[k]).toBe(117)
  })

  it('flags stars that hit unsourced ATT cells', () => {
    const weapon = loadEquipSync(1472290) // 命運鬥拳 Lv250: weapon ATT known to 25★
    expect(starforceUnsourced(weapon, 25)).toBe(false)
    expect(starforceUnsourced(weapon, 26)).toBe(true)
    expect(starforceUnsourced(weapon, 30)).toBe(true)
    const hat = loadEquipSync(1005983) // non-weapon Lv250: table complete to 30★
    expect(starforceUnsourced(hat, 26)).toBe(false)
    expect(starforceUnsourced(hat, 30)).toBe(false)
  })

  it('returns {} for 0★ and for unsupported (superior) equipment', () => {
    const f = find(1005983)
    const equip = loadEquipSync(f.id)
    expect(starforceStats(equip, 0, add(f.base, f.scroll))).toEqual({})
    expect(starforceStats({ ...equip, superior: true }, 25, add(f.base, f.scroll))).toEqual({})
    expect(starforceStats({ ...equip, canStarforce: false }, 25, add(f.base, f.scroll))).toEqual({})
  })
})

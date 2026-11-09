import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import type { EquipData } from '../types'
import fixture from './fixtures/nexon-items.json'
import { DATA_DIR, anyWithPrefix, loadEquipSync, loadIndexSync, readDataJson } from './helpers'

/** Every exported equip (all category files, including unnamed items not in index.json). */
let allCache: EquipData[] | null = null
function allEquips(): EquipData[] {
  allCache ??= readdirSync(DATA_DIR + 'equip').flatMap((f) =>
    Object.values(readDataJson<Record<string, EquipData>>(`equip/${f}`)),
  )
  return allCache
}

describe('exported TMS v283 equipment data', () => {
  it('meta has data version', () => {
    const meta = readDataJson<{ dataVersion: string }>('meta.json')
    expect(meta.dataVersion).toBe('TMS v283')
  })

  it('index contains known items', () => {
    const e = loadIndexSync().find((x) => x.id === 1005983)!
    expect(e).toMatchObject({ name: '永恆盜賊頭巾', level: 250 })
  })

  it('category file has base stats', () => {
    const d = loadEquipSync(1005983)
    expect(d.base).toMatchObject({ dex: 80, luk: 80, att: 10, def: 750, ignoreDef: 15 })
    expect(d.bossReward).toBeTypeOf('boolean')
    expect(loadEquipSync(1472290).base.att).toBe(189)
  })

  it('magic weapon flag', () => {
    expect(anyWithPrefix(1372).isMagicWeapon).toBe(true)
    expect(anyWithPrefix(1213).isMagicWeapon).toBe(false)
    expect(anyWithPrefix(1352).isWeapon).toBe(false)
  })

  it('starforce eligibility uses tuc > 0 && !cash only', () => {
    // 命運鬥拳 carries WZ exceptUpgrade but is 22★ in real Nexon data.
    expect(loadEquipSync(1472290).canStarforce).toBe(true)
  })

  it('exports superior / blockGoldHammer / exceptionalMax', () => {
    const d = loadEquipSync(1005983)
    expect(d.superior).toBeTypeOf('boolean')
    expect(d.blockGoldHammer).toBeTypeOf('boolean')
    expect(d.exceptionalMax).toBeTypeOf('number')
    expect(d).toMatchObject({ superior: false, blockGoldHammer: false, exceptionalMax: 0, canExceptional: false })
    // From the WZ spike: superiorEqp, blockGoldHammer, Etuc.
    expect(loadEquipSync(1122241).superior).toBe(true) // 超越的心之項鍊
    expect(loadEquipSync(1122000).blockGoldHammer).toBe(true) // 闇黑龍王項鍊
    expect(loadEquipSync(1012911)).toMatchObject({ exceptionalMax: 3, canExceptional: true }) // 傲慢的原罪
    expect(loadEquipSync(1032316)).toMatchObject({ exceptionalMax: 1, canExceptional: true }) // 指揮官力量耳環
  })

  it('172xxxx 阿斯特拉 secondaries can be star-forced although WZ tuc = 0 (fixture 19–25★)', () => {
    for (const id of [1723902, 1720602, 1721102, 1720801, 1722902]) {
      expect(loadEquipSync(id), `${id}`).toMatchObject({ tuc: 0, slot: 'Si', canStarforce: true })
    }
  })

  it('canStarforce stays tuc > 0 && !cash except for the 172xxxx 阿斯特拉 secondaries', () => {
    for (const e of allEquips()) {
      const astra = Math.floor(e.id / 10000) === 172 && e.slot === 'Si'
      expect(e.canStarforce, `${e.id}`).toBe((e.tuc > 0 || astra) && !e.cash)
    }
  })

  it('flame overrides: 不朽的遺產 and 古代石板複製品 are flammable; the tablet rolls non-boss flames', () => {
    expect(loadEquipSync(1143471)).toMatchObject({ canFlame: true, bossReward: true, flameBoss: true })
    expect(loadEquipSync(1202287)).toMatchObject({ canFlame: true, bossReward: true, flameBoss: false })
  })

  it('flameBoss equals bossReward for every other item', () => {
    for (const e of allEquips()) {
      if (e.id === 1202287) continue
      expect(e.flameBoss, `${e.id}`).toBe(e.bossReward)
    }
  })

  it('exports variant flags', () => {
    expect(loadEquipSync(1003797)).toMatchObject({ timeLimited: false, fixedPotential: false, eventVariant: false })
    expect(loadEquipSync(1006425)).toMatchObject({ timeLimited: true, fixedPotential: true, eventVariant: true })
    for (const e of allEquips().slice(0, 50)) {
      for (const k of ['timeLimited', 'fixedPotential', 'eventVariant', 'accountShare', 'tradeBlock', 'flameBoss'] as const)
        expect(e[k], `${e.id}.${k}`).toBeTypeOf('boolean')
    }
  })

  it('variant labels of 高貴的戰士頭盔', () => {
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    const expected: [number, boolean, string][] = [
      [1003797, true, ''],
      [1005302, false, '綁定版'],
      [1005567, false, '活動版'],
      [1005196, false, '活動版・期限'],
      [1006425, false, '活動版・期限・固定潛能'],
    ]
    for (const [id, canonical, variantLabel] of expected)
      expect(byId.get(id), `${id}`).toMatchObject({ name: '高貴的戰士頭盔', canonical, variantLabel })
  })

  it('every (slot, name, cash) group has exactly one canonical entry, and canonical entries have no label', () => {
    const canon = new Map<string, number>()
    for (const e of loadIndexSync()) {
      expect(e.canonical, `${e.id}`).toBeTypeOf('boolean')
      expect(e.variantLabel, `${e.id}`).toBeTypeOf('string')
      const key = `${e.slot}\u0000${e.name}\u0000${e.cash}`
      canon.set(key, (canon.get(key) ?? 0) + (e.canonical ? 1 : 0))
      if (e.canonical) expect(e.variantLabel, `${e.id}`).toBe('')
    }
    for (const [key, n] of canon) expect(n, key).toBe(1)
  })

  it('cash and non-cash entries never compete for canonical (紅鷹鋼盔: non-cash 1000054, cash 1000009)', () => {
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    expect(byId.get(1000054)).toMatchObject({ name: '紅鷹鋼盔', cash: false, canonical: true, variantLabel: '' })
    expect(byId.get(1000009)).toMatchObject({ name: '紅鷹鋼盔', cash: true, canonical: true, variantLabel: '' })
  })

  it('fallback labels for flag-less duplicates: first differing field tuc → level → base → #id; identical → empty', () => {
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    const expected: [number, string][] = [
      [1000068, '可上卷8次'], // 神鳴的帽子 vs canonical 1000064 (tuc differs)
      [1002509, 'Lv.8'], // 真‧楓葉頭盔 vs 1002508 (level differs)
      [1002872, '數值不同'], // 麋鹿角 vs 1002871 (base differs)
      [1012309, '#1012309'], // 血腥面具 vs 1012240 (another field differs)
      [1001059, ''], // 戰士覺醒套裝帽子: identical to canonical 1000039 except id
    ]
    for (const [id, variantLabel] of expected)
      expect(byId.get(id), `${id}`).toMatchObject({ canonical: false, variantLabel })

    // Property check over every non-canonical entry without a flag label.
    const index = loadIndexSync()
    const key = (e: { slot: string; name: string; cash: boolean }) => `${e.slot}\u0000${e.name}\u0000${e.cash}`
    const canonOf = new Map(index.filter((e) => e.canonical).map((e) => [key(e), e.id]))
    const FLAG_LABEL = /^(活動版|期限|固定潛能|綁定版)(・|$)/
    const strip = ({ id: _id, ...rest }: EquipData) => rest
    const seen = { tuc: 0, level: 0, base: 0, id: 0, identical: 0 }
    for (const e of index) {
      if (e.canonical || FLAG_LABEL.test(e.variantLabel)) continue
      const me = loadEquipSync(e.id)
      const c = loadEquipSync(canonOf.get(key(e))!)
      const same = (k: keyof EquipData) => JSON.stringify(me[k]) === JSON.stringify(c[k])
      let want: string
      if (!same('tuc')) (want = `可上卷${me.tuc}次`), seen.tuc++
      else if (!same('level')) (want = `Lv.${me.level}`), seen.level++
      else if (!same('base')) (want = '數值不同'), seen.base++
      else if (JSON.stringify(strip(me)) !== JSON.stringify(strip(c))) (want = `#${e.id}`), seen.id++
      else (want = ''), seen.identical++
      expect(e.variantLabel, `${e.id}`).toBe(want)
    }
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(0)
  })

  it('test / placeholder equipment is excluded from the export (dummy, 1–3 ASCII letters, GM, Hangul, explicit ids)', () => {
    const excluded = (n: string) =>
      /dummy/i.test(n) || /^[A-Za-z]{1,3}$/.test(n) || n.includes('GM') || /[가-힣]/.test(n)
    const gmStats = (e: EquipData) => (['str', 'dex', 'int', 'luk'] as const).every((k) => (e.base[k] ?? 0) >= 999)
    expect(allEquips().filter((e) => excluded(e.name) || gmStats(e)).map((e) => e.id)).toEqual([])
    const ids = new Set(allEquips().map((e) => e.id))
    for (const id of [1302362, 1302363, 1690206, 1932565, 1932566, 1983517, 1983518, 1983519, 1003890, 1007171,
      1051351, 1052173, 1052624, 1072633, 1072830, 1102582, 1702431, 1932236 /* "2014 horse", explicit id */,
      1002140, 1003142 /* 維澤特帽: GM stats */])
      expect(ids.has(id), `${id}`).toBe(false)
  })

  it('keeps real items with test-like names, and every fixture item loads', () => {
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    for (const id of [1262001, 1262018, 1262022, 1262060]) expect(byId.get(id)?.name, `${id}`).toMatch(/測試用ESP限制器/)
    for (const name of ['烏勒斯的握力測試機', '名譽開發者', '祕密團體臨時成員'])
      expect(loadIndexSync().some((e) => e.name === name), name).toBe(true)
    expect(loadIndexSync().filter((e) => e.slot === 'Me' && /^[ -~]+$/.test(e.name)).length).toBeGreaterThanOrEqual(31)
    for (const id of new Set((fixture as { id: number }[]).map((f) => f.id))) expect(loadEquipSync(id).id).toBe(id)
  })

  it('every index entry has a non-empty name', () => {
    for (const e of loadIndexSync()) expect(e.name.trim().length, `name of ${e.id}`).toBeGreaterThan(0)
  })

  it('index ids are unique and every id resolves to a category file', () => {
    const index = loadIndexSync()
    expect(index.length).toBeGreaterThan(0)
    expect(new Set(index.map((e) => e.id)).size).toBe(index.length)
    const files = new Set(readdirSync(DATA_DIR + 'equip').map((f) => f.replace(/\.json$/, '')))
    for (const e of index) {
      expect(files.has(e.category), `category file for ${e.id}`).toBe(true)
      expect(loadEquipSync(e.id).id).toBe(e.id)
    }
  })
})

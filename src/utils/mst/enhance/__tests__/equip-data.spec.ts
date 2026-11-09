import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { DATA_DIR, anyWithPrefix, loadEquipSync, loadIndexSync, readDataJson } from './helpers'

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

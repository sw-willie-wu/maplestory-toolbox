import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { EquipData, IndexEntry, JobsData, SearchCategory, SetInfo } from '../types'
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

  it('cash and non-cash entries never share a group (紅鷹鋼盔: non-cash 1000054 and cash 1000009 both canonical)', () => {
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    expect(byId.get(1000054)).toMatchObject({ name: '紅鷹鋼盔', cash: false, canonical: true, variantLabel: '' })
    expect(byId.get(1000009)).toMatchObject({ name: '紅鷹鋼盔', cash: true, canonical: true, variantLabel: '' })
  })

  it('exports cash items again (index.json, equip/<category>.json, equip/PetEquip.json)', () => {
    expect(loadIndexSync().filter((e) => e.cash).length).toBeGreaterThan(10000)
    expect(allEquips().filter((e) => e.cash).length).toBeGreaterThan(10000)
    expect(readdirSync(DATA_DIR + 'equip')).toContain('PetEquip.json')
    expect(loadEquipSync(1000009).cash).toBe(true)
  })

  it('enhanceable = !cash && (canStarforce || tuc > 0 || canFlame || canExceptional); cash is never enhanceable', () => {
    const index = loadIndexSync()
    for (const e of index) {
      const d = loadEquipSync(e.id)
      expect(e.enhanceable, `${e.id}`).toBe(!d.cash && (d.canStarforce || d.tuc > 0 || d.canFlame || d.canExceptional))
      if (e.cash) expect(e.enhanceable, `${e.id}`).toBe(false)
    }
    expect(index.filter((e) => e.enhanceable).length).toBeGreaterThan(10000)
  })

  it('no 1690xxx placeholders (index.json and every equip/<category>.json)', () => {
    const p1690 = (id: number) => Math.floor(id / 1000) === 1690
    expect(loadIndexSync().filter((e) => p1690(e.id)).map((e) => e.id)).toEqual([])
    expect(allEquips().filter((e) => p1690(e.id)).map((e) => e.id)).toEqual([])
  })

  it('six non-enhanceable categories have no enhanceable rows', () => {
    const six = new Set(['Bits', 'TamingMob', 'SkillSkin', 'ArcaneForce', 'AuthenticForce', 'Jewel'])
    const index = loadIndexSync()
    for (const c of six) expect(index.some((e) => e.category === c), c).toBe(true)
    expect(index.filter((e) => six.has(e.category) && e.enhanceable).map((e) => e.id)).toEqual([])
  })

  it('canonical prefers enhanceable: a group with any enhanceable entry has an enhanceable canonical', () => {
    const groups = new Map<string, IndexEntry[]>()
    for (const e of loadIndexSync()) {
      const key = `${e.slot}\u0000${e.name}\u0000${e.cash}`
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    for (const [key, members] of groups)
      if (members.some((e) => e.enhanceable)) expect(members.find((e) => e.canonical)!.enhanceable, key).toBe(true)
    // v283's one group where this overrides the lowest id: 凱撒戒指 1112751 (tuc 0) vs 1112779 (tuc 2).
    const byId = new Map(loadIndexSync().map((e) => [e.id, e]))
    expect(byId.get(1112779)).toMatchObject({ name: '凱撒戒指', enhanceable: true, canonical: true, variantLabel: '' })
    expect(byId.get(1112751)).toMatchObject({ name: '凱撒戒指', enhanceable: false, canonical: false, variantLabel: '可上卷0次' })
  })

  it('tool index stays small (index.json gzip <= 1.5 MB)', () => {
    expect(gzipSync(readFileSync(DATA_DIR + 'index.json')).length).toBeLessThanOrEqual(1.5 * 1024 * 1024)
  })

  it('categories.json: official ThothSearchOption categories with detail id ranges', () => {
    const cats = readDataJson<SearchCategory[]>('categories.json')
    expect(cats.length).toBeGreaterThan(0)
    expect(cats.map((c) => c.id)).toEqual(expect.arrayContaining(['Armor', 'Accessory', 'SubWeapon']))
    for (const c of cats) {
      expect(c.name, c.id).toMatch(/\S/)
      expect(c.details.length, c.id).toBeGreaterThan(0)
      for (const d of c.details) {
        expect(d.ranges[0], `${c.id}/${d.id}`).toEqual([d.begin, d.end])
        for (const [b, e] of d.ranges) expect(b, `${c.id}/${d.id}`).toBeLessThanOrEqual(e)
      }
    }
    const armor = cats.find((c) => c.id === 'Armor')!
    expect(armor.details.find((d) => d.id === 'Cap')).toMatchObject({ name: '帽子', begin: 1000000, end: 1009999 })
  })

  it('searchCategory / searchDetail: every non-cash weapon has a category; details contain the id', () => {
    const cats = new Map(readDataJson<SearchCategory[]>('categories.json').map((c) => [c.id, c]))
    for (const e of allEquips()) {
      if (e.searchCategory !== null) expect(cats.has(e.searchCategory), `${e.id}`).toBe(true)
      // Cash weapon-folder items may have none (v283: 13 rows, 1602000–1602007 技能效果 islot Ri, 5 × 1702xxx islot MaPn).
      if (e.isWeapon && !e.cash) expect(e.searchCategory, `${e.id}`).not.toBeNull()
      if (e.searchDetail !== null) {
        const d = cats.get(e.searchCategory!)!.details.find((x) => x.id === e.searchDetail)
        expect(d, `${e.id}`).toBeDefined()
        // Derived Accessory/Emblem (emblems past the WZ Emblem range) is the only detail allowed outside its ranges.
        const derivedEmblem = e.searchDetail === 'Emblem' && e.id >= 1190000 && e.id <= 1191999
        if (!derivedEmblem) expect(d!.ranges.some(([b, end]) => e.id >= b && e.id <= end), `${e.id}`).toBe(true)
      }
    }
    expect(loadEquipSync(1005983)).toMatchObject({ searchCategory: 'Armor', searchDetail: 'Cap' })
    expect(loadEquipSync(1262002)).toMatchObject({ searchCategory: 'OneHandSword', searchDetail: 'Bracelet' })
    // 1352910–1352919 are 鷹眼 (Captain sights): ThothSearchOption gives CaptainSight and AranPendulum the same range.
    expect(loadEquipSync(1352910)).toMatchObject({ searchCategory: 'SubWeapon', searchDetail: 'CaptainSight' })
  })

  it('weapons outside ThothSearchOption ranges: category from id prefix, not islot (detail null)', () => {
    const cases: [number, string][] = [
      [1542000, 'TwoHandSword'], // 鐵刀 (islot Wp)
      [1552000, 'TwoHandSword'], // 鐵扇 (islot Wp)
      [1403000, 'TwoHandSword'], // 老舊武拳 (islot Wp)
      [1252001, 'OneHandSword'], // 露西奧萊記憶長杖
      [1720000, 'SubWeapon'], // 阿斯特拉獎牌
    ]
    for (const [id, cat] of cases) expect(loadEquipSync(id), `${id}`).toMatchObject({ searchCategory: cat, searchDetail: null })
    for (const e of allEquips()) {
      if (e.category !== 'Weapon' || e.searchDetail !== null) continue
      const p = Math.floor(e.id / 10000)
      if (p >= 140 && p <= 159) expect(e.searchCategory, `${e.id}`).toBe('TwoHandSword')
      if (p >= 121 && p <= 139 && p !== 135) expect(e.searchCategory, `${e.id}`).toBe('OneHandSword')
      if (p === 135 || p === 172) expect(e.searchCategory, `${e.id}`).toBe('SubWeapon')
    }
  })

  it('emblems beyond the WZ Emblem range (1190300+, 1191xxx) are Accessory / Emblem', () => {
    expect(loadEquipSync(1190301)).toMatchObject({ searchCategory: 'Accessory', searchDetail: 'Emblem' }) // 黃金楓葉徽章
    expect(loadEquipSync(1191000)).toMatchObject({ searchCategory: 'Accessory', searchDetail: 'Emblem' }) // 銀凱內西斯徽章
  })

  it('specJob: Kinesis weapons are 142; every specJob value is listed in jobs.json', () => {
    expect(loadEquipSync(1262002).specJob).toBe(142) // 初始ESP限制器
    expect(loadEquipSync(1005983).specJob).toBeNull()
    const jobs = readDataJson<JobsData>('jobs.json')
    const byId = new Map(jobs.specJobs.map((j) => [j.id, j]))
    expect(byId.get(142)).toMatchObject({ name: '凱內西斯', nameEn: 'Kinesis', confirmed: true })
    const present = new Set(allEquips().map((e) => e.specJob).filter((v): v is number => v !== null))
    expect([...present].sort((a, b) => a - b)).toEqual(jobs.specJobs.map((j) => j.id))
    for (const j of jobs.specJobs) {
      expect(j.count, `${j.id}`).toBeGreaterThan(0)
      if (!j.confirmed) expect(j.name, `${j.id}`).toBeNull()
    }
    expect(jobs.groups.map((g) => g.id)).toEqual(['warrior', 'magician', 'bowman', 'thief', 'pirate'])
  })

  it('index entries carry searchCategory / searchDetail / specJob equal to EquipData', () => {
    for (const e of loadIndexSync()) {
      const d = loadEquipSync(e.id)
      expect([e.searchCategory, e.searchDetail, e.specJob], `${e.id}`).toEqual([d.searchCategory, d.searchDetail, d.specJob])
    }
  })

  it('sets.json: set 247 (露塔必思套裝(劍士), incl. 高貴的戰士頭盔 1003797) has per-piece effects', () => {
    expect(loadEquipSync(1003797).setId).toBe(247)
    const s = readDataJson<Record<string, SetInfo>>('sets.json')['247']
    expect(s).toMatchObject({ completeCount: 4, jokerPossible: true, zeroWeaponJokerPossible: true })
    expect(s.effects['2'].stats).toMatchObject({ incSTR: 20, incDEX: 20, incMHP: 1000, incMMP: 1000 })
    expect(s.effects['3'].stats).toMatchObject({ incPAD: 50, incMHPr: 10, incMMPr: 10 })
    expect(s.effects['4'].options).toEqual([{ id: 30602, level: 15 }])
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

    // Property check over every non-canonical entry without a flag label (index.json is id-sorted, so lower ids come
    // first within each group): identical to the canonical in every field except id → ''; identical to a lower-id
    // non-canonical entry of the group that kept a fallback label → '' (one labelled representative per identical
    // set); otherwise the first differing field vs the canonical.
    const index = loadIndexSync()
    const key = (e: { slot: string; name: string; cash: boolean }) => `${e.slot}\u0000${e.name}\u0000${e.cash}`
    const canonOf = new Map(index.filter((e) => e.canonical).map((e) => [key(e), e.id]))
    const FLAG_LABEL = /^(活動版|期限|固定潛能|綁定版)(・|$)/
    const body = (e: EquipData) => JSON.stringify({ ...e, id: 0 })
    const kept = new Set<string>() // group key + body of entries that kept a fallback label
    const keptBound = new Set<string>() // group key + body of entries labelled 綁定版
    const seen = { tuc: 0, level: 0, base: 0, id: 0, identical: 0, collapsed: 0 }
    for (const e of index) {
      if (e.canonical) continue
      const me = loadEquipSync(e.id)
      const keptKey = `${key(e)}\u0000${body(me)}`
      if (e.variantLabel === '綁定版') keptBound.add(keptKey)
      if (FLAG_LABEL.test(e.variantLabel)) continue
      // Collapsed flag-labelled duplicates (checked in the next test): 活動版/期限/固定潛能 come from EquipData flags;
      // a '' entry identical to a lower-id 綁定版 entry is a collapsed 綁定版 duplicate.
      if (me.eventVariant || me.timeLimited || me.fixedPotential) continue
      if (e.variantLabel === '' && keptBound.has(keptKey)) continue
      const c = loadEquipSync(canonOf.get(key(e))!)
      const same = (k: keyof EquipData) => JSON.stringify(me[k]) === JSON.stringify(c[k])
      let want: string
      if (body(me) === body(c)) (want = ''), seen.identical++
      else if (kept.has(keptKey)) (want = ''), seen.collapsed++
      else {
        if (!same('tuc')) (want = `可上卷${me.tuc}次`), seen.tuc++
        else if (!same('level')) (want = `Lv.${me.level}`), seen.level++
        else if (!same('base')) (want = '數值不同'), seen.base++
        else (want = `#${e.id}`), seen.id++
        kept.add(keptKey)
      }
      expect(e.variantLabel, `${e.id}`).toBe(want)
    }
    for (const [k, n] of Object.entries(seen)) expect(n, k).toBeGreaterThan(0)
  })

  it('fully identical flag-labelled variants collapse: one representative per identical set keeps the label', () => {
    // Non-canonical entries of one group that are identical in every field except id and would carry the same flag
    // label: only the lowest id keeps it, the rest get ''. 活動版 / 期限 / 固定潛能 come from EquipData flags, so a row
    // identical to its canonical has the canonical's own flags and gets '' (controller ruling). 綁定版 keeps its label
    // even when identical to the canonical (1005302 vs 1003797: info/tradeBlock is not an EquipData field).
    const key = (e: { slot: string; name: string; cash: boolean }) => `${e.slot}\u0000${e.name}\u0000${e.cash}`
    const body = (e: EquipData) => JSON.stringify({ ...e, id: 0 })
    const FLAG_LABEL = /^(活動版|期限|固定潛能|綁定版)(・|$)/
    const index = loadIndexSync()
    const canonBody = new Map(index.filter((e) => e.canonical).map((e) => [key(e), body(loadEquipSync(e.id))]))
    const sets = new Map<string, IndexEntry[]>()
    let identicalToCanonical = 0
    for (const e of index) {
      if (e.canonical) continue
      const b = body(loadEquipSync(e.id))
      // A non-綁定版 flag row is never body-identical to its canonical.
      if (FLAG_LABEL.test(e.variantLabel) && e.variantLabel !== '綁定版')
        expect(b === canonBody.get(key(e)), `${e.id}:${e.variantLabel}`).toBe(false)
      const k = `${key(e)}\u0000${b}`
      sets.set(k, [...(sets.get(k) ?? []), e])
    }
    let collapsedSets = 0
    for (const [k, members] of sets) {
      const what = members.map((e) => `${e.id}:${e.variantLabel}`).join(' ')
      const flagged = members.filter((e) => FLAG_LABEL.test(e.variantLabel))
      expect(flagged.length, what).toBe(new Set(flagged.map((e) => e.variantLabel)).size)
      const d = loadEquipSync(members[0]!.id)
      if (d.eventVariant || d.timeLimited || d.fixedPotential) {
        const sameAsCanonical = k.endsWith(`\u0000${canonBody.get(key(members[0]!))}`)
        if (sameAsCanonical) {
          // Every member carries the canonical's own flags: all ''.
          expect(members.filter((e) => e.variantLabel !== '').map((e) => e.id), what).toEqual([])
          identicalToCanonical += members.length
        } else {
          // Every member carries the same flag label: exactly the lowest id keeps it and the rest are ''.
          expect(flagged.map((e) => e.id), what).toEqual([Math.min(...members.map((e) => e.id))])
          expect(members.filter((e) => e.variantLabel !== '').length, what).toBe(1)
          if (members.length > 1) collapsedSets++
        }
      }
    }
    expect(collapsedSets).toBeGreaterThan(0)
    expect(identicalToCanonical).toBeGreaterThan(0)
    // Review cases: flag rows identical to the canonical (1082708 武公的手套 期限・固定潛能 vs 1082393).
    const byId = new Map(index.map((e) => [e.id, e]))
    for (const id of [1082708, 1012362, 1114208, 1114227, 1122086])
      expect(byId.get(id), `${id}`).toMatchObject({ canonical: false, variantLabel: '' })
    expect(byId.get(1005302)).toMatchObject({ canonical: false, variantLabel: '綁定版' })
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
    // Fixtures removed by an export exclusion rule (1690xxx placeholders) are skipped and counted: none today.
    const exportExcluded = (id: number) => Math.floor(id / 1000) === 1690
    const ids = [...new Set((fixture as { id: number }[]).map((f) => f.id))]
    expect(ids.filter(exportExcluded)).toEqual([])
    for (const id of ids) if (!exportExcluded(id)) expect(loadEquipSync(id).id).toBe(id)
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

// Fetches real equipment from NEXON Open API (maplestorytw) for ranked characters
// of several job groups and writes a calculator test fixture.
// Usage: NEXON_API_KEY=... node tools/fixtures/fetch-nexon.mjs
// The key is read from the environment only and never written anywhere.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { itemIdFromIconUrl } from '../../src/utils/mst/icon.ts'

const root = new URL('../../', import.meta.url)
const API = 'https://open.api.nexon.com/maplestorytw/v1'
const RANK = 'https://maplestory-event.beanfun.com/api/UnionWebRank/FindRank'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const KEY = process.env.NEXON_API_KEY
if (!KEY) throw new Error('NEXON_API_KEY env var is required')

const PER_GROUP = 2
const QUOTA = { magician: 4 } // magicians: at most 1 per job, so several weapon types appear
const GROUPS = {
  warrior: ['英雄', '聖騎士', '黑騎士', '凱撒', '劍豪', '米哈逸', '狂狼勇士', '惡魔殺手', '惡魔復仇者', '爆拳槍神', '神之子', '阿戴爾', '閃雷悍將'],
  magician: ['主教', '火毒大魔導士', '冰雷大魔導士', '火毒魔導士', '冰雷魔導士', '夜光', '凱內西斯', '伊利恩', '幻獸師', '煉獄巫師', '陰陽師', '烈焰巫師', '龍魔導士'],
  bowman: ['箭神', '神射手', '開拓者', '破風使者', '狂豹獵人', '精靈遊俠', '凱殷'],
  thief: ['夜使者', '暗影神偷', '影武者', '暗夜行者', '卡蒂娜', '虎影', '卡莉'],
  pirate: ['拳霸', '槍神', '重砲指揮官', '機甲戰神', '隱月', '墨玄', '傑諾']
}
const groupOf = job => {
  for (const [g, names] of Object.entries(GROUPS)) if (names.includes(job)) return g
  return null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const sleepGap = () => sleep(400)

async function pickCharacters() {
  const chosen = []
  const count = {}
  const seenJobs = new Set()
  for (let page = 1; page <= 10; page++) {
    let res
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await fetch(RANK, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': UA },
        body: JSON.stringify({ rankType: 1, gameWorldId: -1, page })
      })
      if (res.ok) break
      await sleep(3000)
    }
    if (!res.ok) throw new Error(`rank page ${page}: HTTP ${res.status}`)
    const { data } = await res.json()
    for (const d of data.rankDatas) {
      seenJobs.add(d.jobName)
      const g = groupOf(d.jobName)
      if (!g || (count[g] ?? 0) >= (QUOTA[g] ?? PER_GROUP)) continue
      if (g === 'magician' && chosen.some(c => c.job === d.jobName)) continue
      count[g] = (count[g] ?? 0) + 1
      chosen.push({ name: d.characterName, job: d.jobName, group: g })
    }
    if (Object.keys(GROUPS).every(g => (count[g] ?? 0) >= (QUOTA[g] ?? PER_GROUP))) break
    await sleepGap()
  }
  console.log(`jobs seen in ranking: ${[...seenJobs].join(',')}`)
  if (!chosen.some(c => c.group === 'magician')) throw new Error('no magician-class character found in ranking')
  return chosen
}

async function nexon(path) {
  const res = await fetch(API + path, { headers: { 'x-nxopen-api-key': KEY, 'user-agent': UA } })
  if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

const STAT_MAP = {
  str: 'str', dex: 'dex', int: 'int', luk: 'luk', max_hp: 'maxHp', max_mp: 'maxMp',
  attack_power: 'att', magic_power: 'matt', armor: 'def', speed: 'speed', jump: 'jump',
  boss_damage: 'bossDamage', ignore_monster_armor: 'ignoreDef', all_stat: 'allStatPct',
  damage: 'damagePct', max_hp_rate: 'maxHpPct', max_mp_rate: 'maxMpPct',
  equipment_level_decrease: 'levelReduce'
}
function convertStats(obj, where, { drop = [] } = {}) {
  const out = {}
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (drop.includes(k)) continue
    const key = STAT_MAP[k]
    if (!key) throw new Error(`unknown stat key "${k}" in ${where}`)
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error(`non-numeric ${k}=${v} in ${where}`)
    if (n !== 0) out[key] = n
  }
  return out
}
const sum = (...ss) => {
  const o = {}
  for (const s of ss) for (const [k, v] of Object.entries(s)) o[k] = (o[k] ?? 0) + v
  return o
}
const same = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every(k => (a[k] ?? 0) === (b[k] ?? 0))
}

const index = JSON.parse(readFileSync(new URL('public/data/tms-v283/index.json', root), 'utf8'))
const indexIds = new Set(index.map(e => e.id))

const excluded = { shapeMismatch: [], starforceScroll: [], totalMismatch: [], notInIndex: [], badIcon: [] }
const seen = new Set()
const items = []

function convertItem(e, character) {
  const label = `${character}:${e.item_name}`
  if (e.item_shape_name !== e.item_name) return void excluded.shapeMismatch.push(label)
  if (e.starforce_scroll_flag !== '未套用') return void excluded.starforceScroll.push(label)
  const id = itemIdFromIconUrl(e.item_icon)
  if (id === null) return void excluded.badIcon.push(label)
  if (!indexIds.has(id)) return void excluded.notInIndex.push(`${label}(${id})`)
  const where = `${label}(${id})`
  const base = convertStats(e.item_base_option, where + '.base', { drop: ['base_equipment_level'] })
  const flame = convertStats(e.item_add_option, where + '.add')
  const scroll = convertStats(e.item_etc_option, where + '.etc')
  const starforceStats = convertStats(e.item_starforce_option, where + '.starforce')
  const exceptional = convertStats(e.item_exceptional_option, where + '.exceptional', { drop: ['exceptional_upgrade'] })
  const total = convertStats(e.item_total_option, where + '.total')
  // NEXON item_total_option EXCLUDES item_exceptional_option.
  if (!same(total, sum(base, flame, scroll, starforceStats))) {
    return void excluded.totalMismatch.push(label)
  }
  // Only '0' and '套用' were observed for golden_hammer_flag.
  const gh = e.golden_hammer_flag
  if (!['0', '1', '套用', '未套用'].includes(gh)) throw new Error(`unexpected golden_hammer_flag ${gh} in ${where}`)
  const item = {
    id, name: e.item_name, slot: e.item_equipment_slot,
    starforce: Number(e.starforce), scrollUpgrade: Number(e.scroll_upgrade),
    scrollUpgradeable: Number(e.scroll_upgradeable_count),
    resilience: Number(e.scroll_resilience_count), goldenHammer: gh === '1' || gh === '套用',
    exceptionalUpgrade: Number(e.item_exceptional_option?.exceptional_upgrade ?? 0),
    base, scroll, starforceStats, flame, exceptional, total
  }
  const dk = JSON.stringify([id, item.starforce, flame, scroll, item.exceptionalUpgrade])
  if (seen.has(dk)) return
  seen.add(dk)
  items.push(item)
}

const characters = await pickCharacters()
for (const c of characters) {
  await sleepGap()
  const { ocid } = await nexon(`/id?character_name=${encodeURIComponent(c.name)}`)
  await sleepGap()
  const eq = await nexon(`/character/item-equipment?ocid=${ocid}`)
  for (const key of ['item_equipment', 'item_equipment_preset_1', 'item_equipment_preset_2', 'item_equipment_preset_3']) {
    for (const e of eq[key] ?? []) convertItem(e, c.name)
  }
  console.log(`fetched ${c.name} (${c.job}, ${c.group})`)
}

const outDir = new URL('src/utils/mst/enhance/__tests__/fixtures/', root)
mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('nexon-items.json', outDir), JSON.stringify(items, null, 1) + '\n')
console.log(`characters: ${characters.map(c => `${c.name}/${c.job}`).join(', ')}`)
console.log(`fixture items: ${items.length}`)
for (const [k, v] of Object.entries(excluded)) console.log(`excluded ${k}: ${v.length}${v.length ? ' -> ' + v.join(', ') : ''}`)

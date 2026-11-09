// Test-only helpers: synchronous reads of the exported data in public/data (node:fs).
// The app uses the async `loadEquip` (Task 11) instead.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EquipData, IndexEntry, StatKey, Stats } from '../types'

// String form of import.meta.url: under the jsdom environment the global URL is not node's.
export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../public/data/tms-v283/')

export function readDataJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(DATA_DIR + relPath, 'utf8')) as T
}

let indexCache: IndexEntry[] | null = null
const categoryCache = new Map<string, Record<string, EquipData>>()

export function loadIndexSync(): IndexEntry[] {
  indexCache ??= readDataJson<IndexEntry[]>('index.json')
  return indexCache
}

function loadCategorySync(category: string): Record<string, EquipData> {
  let file = categoryCache.get(category)
  if (!file) {
    file = readDataJson<Record<string, EquipData>>(`equip/${category}.json`)
    categoryCache.set(category, file)
  }
  return file
}

export function loadEquipSync(id: number): EquipData {
  const entry = loadIndexSync().find((e) => e.id === id)
  if (!entry) throw new Error(`equip ${id} not in index.json`)
  const equip = loadCategorySync(entry.category)[String(id)]
  if (!equip) throw new Error(`equip ${id} missing from equip/${entry.category}.json`)
  return equip
}

/** First equip in index.json whose id starts with the given 4 digits; throws when none. */
export function anyWithPrefix(prefix4: number): EquipData {
  const entry = loadIndexSync().find((e) => Math.floor(e.id / 1000) === prefix4)
  if (!entry) throw new Error(`no equip with id prefix ${prefix4}`)
  return loadEquipSync(entry.id)
}

export function add(a: Stats, b: Stats): Stats {
  const out: Stats = { ...a }
  for (const [k, v] of Object.entries(b) as [StatKey, number][]) out[k] = (out[k] ?? 0) + v
  return out
}

export function nonZero(s: Stats): Stats {
  const out: Stats = {}
  for (const [k, v] of Object.entries(s) as [StatKey, number][]) if (v !== 0) out[k] = v
  return out
}

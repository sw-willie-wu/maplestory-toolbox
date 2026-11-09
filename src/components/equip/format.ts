// Display helpers for the enhancement editor (UI only).
import type { Sourced, StatKey, Stats } from '@/utils/mst/enhance/types'

export const STAT_LABEL: Record<StatKey, string> = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: '最大HP',
  maxMp: '最大MP',
  att: '攻擊力',
  matt: '魔法攻擊力',
  def: '防禦力',
  speed: '移動速度',
  jump: '跳躍力',
  bossDamage: 'BOSS攻擊時傷害%',
  ignoreDef: '無視防禦率%',
  allStatPct: '全屬性%',
  damagePct: '總傷害%',
  maxHpPct: '最大HP%',
  maxMpPct: '最大MP%',
  levelReduce: '要求等級減少',
}

const nf = (digits: number) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: digits })

/** Plain number with thousands separators; ∞ for Infinity. */
export function formatNum(n: number, digits = 2): string {
  if (n === Infinity) return '∞'
  if (!Number.isFinite(n)) return '—'
  return nf(digits).format(n)
}

/** Mesos with 億 / 萬 units. */
export function formatMeso(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e8) return `${nf(2).format(n / 1e8)} 億`
  if (Math.abs(n) >= 1e4) return `${nf(1).format(n / 1e4)} 萬`
  return nf(0).format(n)
}

/** Probability as a percentage with enough precision for small values. */
export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p === 0) return '0%'
  const v = p * 100
  if (v >= 1) return `${nf(2).format(v)}%`
  return `${Number(v.toPrecision(3))}%`
}

/** "STR +40、攻擊力 +30" (zero entries left out). */
export function formatStats(s: Stats): string {
  return (Object.entries(s) as [StatKey, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${STAT_LABEL[k]} ${v < 0 ? '-' : '+'}${formatNum(Math.abs(v))}`)
    .join('、')
}

export interface NoticeItem {
  label: string
  ref: string
}

/** KMS-estimate entries of `ruleSources` among `labels` (key → what the rule affects on screen), in `labels` order. */
export function kmsNotices<K extends string>(
  ruleSources: Partial<Record<K, Sourced>>,
  labels: Partial<Record<K, string>>,
): NoticeItem[] {
  const out: NoticeItem[] = []
  for (const [key, label] of Object.entries(labels) as [K, string][]) {
    const src = ruleSources[key]
    if (src && src.source === 'KMS-estimate') out.push({ label, ref: src.ref })
  }
  return out
}

/** Integer in [min, max]; NaN / empty → min. */
export function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

// Star force expected cost (absorbing Markov chain, exact linear solve).
import { describe, expect, it } from 'vitest'
import {
  solveStarforceChain,
  starforceExpectation,
  type StarforceOptions,
  type StarforceStep,
} from '../starforce'
import { STARFORCE } from '../rules/starforce'

const plain: StarforceOptions = { starCatch: false, safeguard: false, event: null, vip: 'none' }
const opt = (o: Partial<StarforceOptions> = {}): StarforceOptions => ({ ...plain, ...o })

/** |a − b| ≤ tol × |b| */
const expectRel = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol * Math.abs(expected))

const ZERO = { meso: 0, attempts: 0, destroys: 0, pDestroyAtLeastOnce: 0 }
const cost = (level: number, star: number) => STARFORCE.costFormula(level, star)

describe('starforceExpectation', () => {
  it('from>=to costs zero', () => {
    expect(starforceExpectation(200, 22, 22, plain)).toEqual(ZERO)
    expect(starforceExpectation(200, 22, 17, plain)).toEqual(ZERO)
    expect(starforceExpectation(200, 22, 17, opt({ itemPrice: 1e9 }))).toEqual({ ...ZERO, totalWithItemCost: 0 })
  })

  it('clamps target star to max and returns zero cost when from>=to', () => {
    // Lv130 → max 20★ (STARFORCE.maxStarByLevel); Lv100 → 8★.
    expect(STARFORCE.maxStarByLevel(130)).toBe(20)
    expect(starforceExpectation(130, 18, 25, plain)).toEqual(starforceExpectation(130, 18, 20, plain))
    expect(starforceExpectation(130, 22, 25, plain)).toEqual(ZERO)
    expect(starforceExpectation(100, 5, 30, plain)).toEqual(starforceExpectation(100, 5, 8, plain))
    expect(starforceExpectation(100, 8, 30, plain)).toEqual(ZERO)
    // Lv150 → max 30★: asking for 35 is the same as 30, finite and non-negative.
    const r = starforceExpectation(150, 22, 35, plain)
    expect(r).toEqual(starforceExpectation(150, 22, 30, plain))
    for (const v of Object.values(r)) expect(Number.isFinite(v) && v >= 0).toBe(true)
    // Negative start is clamped to 0.
    expect(starforceExpectation(200, -3, 1, plain)).toEqual(starforceExpectation(200, 0, 1, plain))
  })

  it('single step equals 1/p cost', () => {
    // 0→1: success 95%, no destroy, no drop (TMS V272).
    const r = starforceExpectation(200, 0, 1, plain)
    expect(r.attempts).toBeCloseTo(1 / 0.95, 12)
    expectRel(r.meso, cost(200, 0) / 0.95, 1e-12)
    expect(cost(200, 0)).toBe(223_200) // official table sample
    expect(r.destroys).toBe(0)
    expect(r.pDestroyAtLeastOnce).toBe(0)
    // Star catch ×1.05 (merged into the base rate after its removal).
    expect(starforceExpectation(200, 0, 1, opt({ starCatch: true })).attempts).toBeCloseTo(1 / 0.9975, 12)
    // 0→15 has no destroy and no drop: attempts = Σ 1/p.
    const sum = STARFORCE.rates.slice(0, 15).reduce((a, r) => a + 1 / r.success, 0)
    expect(starforceExpectation(200, 0, 15, plain).attempts).toBeCloseTo(sum, 9)
  })

  it('safeguard: no destroy at 15–17★ and +200% of the undiscounted base cost', () => {
    const r = starforceExpectation(200, 15, 16, opt({ safeguard: true }))
    expect(r.attempts).toBeCloseTo(1 / 0.3, 12)
    expectRel(r.meso, (3 * cost(200, 15)) / 0.3, 1e-12)
    expect(r.destroys).toBe(0)
    expect(r.pDestroyAtLeastOnce).toBe(0)
    // 18★ is outside the safeguard range → can still be destroyed, no surcharge.
    const s18 = starforceExpectation(200, 18, 19, opt({ safeguard: true }))
    expect(s18.pDestroyAtLeastOnce).toBeCloseTo(0.082 / (0.12 + 0.082), 12)
  })

  it('VIP discount applies to the base cost only, current star ≤ 16', () => {
    const royal = opt({ safeguard: true, vip: 'royal' })
    expectRel(starforceExpectation(200, 16, 17, royal).meso, ((0.9 + 2) * cost(200, 16)) / 0.3, 1e-12)
    expectRel(starforceExpectation(200, 17, 18, royal).meso, (3 * cost(200, 17)) / 0.15, 1e-12)
    expectRel(starforceExpectation(200, 0, 1, opt({ vip: 'gold' })).meso, (0.97 * cost(200, 0)) / 0.95, 1e-12)
    expectRel(starforceExpectation(200, 0, 1, opt({ vip: 'diamond' })).meso, (0.95 * cost(200, 0)) / 0.95, 1e-12)
  })

  it('events: 30% discount (all stars, not the safeguard surcharge) and −30% destroy (≤21★)', () => {
    const disc = opt({ event: 'discount30', safeguard: true, vip: 'royal' })
    expectRel(starforceExpectation(200, 15, 16, disc).meso, ((0.9 * 0.7 + 2) * cost(200, 15)) / 0.3, 1e-12)
    expectRel(starforceExpectation(200, 25, 26, opt({ event: 'discount30' })).pDestroyAtLeastOnce, 0.18 / 0.26, 1e-12)
    const down = opt({ event: 'destroyDown30' })
    const d15 = 0.021 * 0.7
    expect(starforceExpectation(200, 15, 16, down).pDestroyAtLeastOnce).toBeCloseTo(d15 / (0.3 + d15), 12)
    const d21 = 0.115 * 0.7
    expect(starforceExpectation(200, 21, 22, down).pDestroyAtLeastOnce).toBeCloseTo(d21 / (0.2 + d21), 12)
    // 22★ is above the event's maxStar 21 → unchanged.
    expect(starforceExpectation(200, 22, 23, down).pDestroyAtLeastOnce).toBeCloseTo(0.1225 / (0.175 + 0.1225), 12)
  })

  it('star catch scales destroy with keep: d′ = d·(1−s′)/(1−s)', () => {
    const s = 0.175 * 1.05
    const d = (0.1225 * (1 - s)) / (1 - 0.175)
    const r = starforceExpectation(200, 22, 23, opt({ starCatch: true }))
    expect(r.pDestroyAtLeastOnce).toBeCloseTo(d / (s + d), 12)
  })

  it('does not invent effects: unknown event throws, no star drops / chance time (chanceTime null)', () => {
    expect(() => starforceExpectation(200, 15, 16, opt({ event: 'guarantee51015' }))).toThrow(/event/)
    expect(STARFORCE.chanceTime).toBeNull()
    expect(STARFORCE.rates.every((r) => r.down === 0)).toBe(true)
  })

  it('itemPrice adds destroys × price', () => {
    const base = starforceExpectation(200, 17, 22, plain)
    expect(base.totalWithItemCost).toBeUndefined()
    expect(base.destroys).toBeGreaterThan(0)
    const r = starforceExpectation(200, 17, 22, opt({ itemPrice: 2e9 }))
    expect(r.meso).toBe(base.meso)
    expect(r.totalWithItemCost).toBeCloseTo(base.meso + base.destroys * 2e9, 0)
  })

  it('destroy returns to 12★ (TMS table, matches an independent step-wise recurrence)', () => {
    // Independent method (BlueMagic math.txt idea, no linear system): with no drops, the cost of
    // k→k+1 is x_k = (c_k + d_k·R_k)/s_k, R_k = Σ_{j=12}^{k−1} x_j (climb back after a destroy);
    // destroys y_k = d_k·(1 + Σ_{j=12}^{k−1} y_j)/s_k; P(no destroy on k→k+1) = s_k/(s_k + d_k).
    const level = 200
    const x: number[] = []
    const y: number[] = []
    const n: number[] = []
    for (let k = 0; k < 25; k++) {
      const { success: s, destroy: d } = STARFORCE.rates[k]
      const back = (arr: number[]) => (k > 12 ? arr.slice(12, k).reduce((a, v) => a + v, 0) : 0)
      x[k] = (cost(level, k) + d * back(x)) / s
      y[k] = (d * (1 + back(y))) / s
      n[k] = s / (s + d)
    }
    const range = (arr: number[], a: number, b: number) => arr.slice(a, b).reduce((p, v) => p + v, 0)
    const r = starforceExpectation(level, 12, 25, plain)
    expectRel(r.meso, range(x, 12, 25), 1e-9)
    expectRel(r.destroys, range(y, 12, 25), 1e-9)
    expectRel(1 - r.pDestroyAtLeastOnce, n.slice(12, 25).reduce((p, v) => p * v, 1), 1e-9)
  })
})

describe('solveStarforceChain — matches reference values', () => {
  /**
   * External reference 1: BlueMagic "Maplestory Star Force Calculator"
   * https://blushiemagic.github.io/Maplestory-Starforce-Calculator/ (source https://github.com/blushiemagic/Maplestory-Starforce-Calculator
   * src.js, commit dfcc7f2, 2026-09-27; analytic step-wise solver, not simulation). Values read from the live page 2026-11-09.
   * Its table is GMS (post-"New Age" enhancement modes, mode 1), NOT TMS, so the same table is rebuilt here:
   *   success × 1.05 (star catch always on); destroy rate is per *failed* attempt (per-attempt = (1 − s′)·d);
   *   destroy → 12★ (15–19★), 15★ (20★), 17★ (21★); "30% Less Destroys" = d × 0.7 for star < 22;
   *   cost = (round(L³·(S+1)/2500 or L³·(S+1)^2.7/div) + 10) × 100 with L = floor(level/10)·10;
   *   MVP multiplier on stars < 17, "30% Off" × 0.7 on all stars.
   */
  const BM_SUCCESS = [0.95, 0.9, 0.85, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.3, 0.3, 0.15, 0.15, 0.15, 0.3, 0.15]
  const BM_DESTROY: Record<number, [number, number]> = {
    15: [0.03, 12], 16: [0.03, 12], 17: [0.08, 12], 18: [0.08, 12], 19: [0.1, 12], 20: [0.15, 15], 21: [0.15, 17],
  }
  const BM_DIV: Record<number, number> = {
    10: 40000, 11: 22000, 12: 15000, 13: 11000, 14: 7500, 15: 20000, 16: 20000, 17: 15000, 18: 7000, 19: 4500, 20: 20000, 21: 12500,
  }
  function blueMagicChain(level: number, opts: { lowerDestroy?: boolean; discount?: boolean; mvp?: number }): StarforceStep[] {
    const L = Math.floor(level / 10) * 10
    return BM_SUCCESS.map((s0, k) => {
      const raw = k < 10 ? (L ** 3 * (k + 1)) / 2500 : (L ** 3 * (k + 1) ** 2.7) / BM_DIV[k]
      const base = (Math.round(raw) + 10) * 100
      const mult = (k < 17 ? opts.mvp ?? 1 : 1) * (opts.discount ? 0.7 : 1)
      const success = s0 * 1.05
      const [d, destroyTo] = BM_DESTROY[k] ?? [0, 0]
      const destroy = (1 - success) * d * (opts.lowerDestroy && k < 22 ? 0.7 : 1)
      return { success, destroy, down: 0, cost: base * mult, destroyTo }
    })
  }

  it('matches reference values', () => {
    // BlueMagic, Lv200 17→22, no event, no MVP: 31,296,211,406.146 mesos, 7.2460255634371435 destroys, 86.633% destroy.
    let r = solveStarforceChain(blueMagicChain(200, {}), 17, 22)
    expectRel(r.meso, 31_296_211_406.146, 1e-6)
    expectRel(r.destroys, 7.2460255634371435, 1e-6)
    expect(r.pDestroyAtLeastOnce).toBeCloseTo(0.86633, 4)

    // BlueMagic, Lv150 15→22, "30% Less Destroys": 9,401,085,468.007 mesos, 3.8161735264419514 destroys, 79.46%.
    r = solveStarforceChain(blueMagicChain(150, { lowerDestroy: true }), 15, 22)
    expectRel(r.meso, 9_401_085_468.007, 1e-6)
    expectRel(r.destroys, 3.8161735264419514, 1e-6)
    expect(r.pDestroyAtLeastOnce).toBeCloseTo(0.7946, 4)

    // BlueMagic, Lv250 10→18, "30% Off", MVP Diamond (×0.9): 3,894,167,977.769 mesos, 0.6203255344635209 destroys, 38.284%.
    r = solveStarforceChain(blueMagicChain(250, { discount: true, mvp: 0.9 }), 10, 18)
    expectRel(r.meso, 3_894_167_977.769, 1e-6)
    expectRel(r.destroys, 0.6203255344635209, 1e-6)
    expect(r.pDestroyAtLeastOnce).toBeCloseTo(0.38284, 4)
  })

  it('matches an external Markov-chain reference with star drops', () => {
    // External reference 2: allcalc.org「아이템 강화 확률 (12강 -> 18강을 이루기 위한 평균 기대 횟수는?)」
    // https://allcalc.org/45976 — fundamental-matrix solution (and 100k Monte Carlo 212.17).
    // Table: 12★ 30% up / 70% stay; 13–14★ 30% up / 30% stay / 40% down; 15–17★ 20% up / 45% stay / 35% down; no destroy.
    // Published: 12→18 ≈ 212.02, 15→18 ≈ 187.2, 17→18 ≈ 102.51 attempts.
    const steps: StarforceStep[] = Array.from({ length: 18 }, (_, k) => {
      if (k < 12) return { success: 1, destroy: 0, down: 0, cost: 0, destroyTo: 0 }
      if (k === 12) return { success: 0.3, destroy: 0, down: 0, cost: 1, destroyTo: 0 }
      if (k <= 14) return { success: 0.3, destroy: 0, down: 0.4, cost: 1, destroyTo: 0 }
      return { success: 0.2, destroy: 0, down: 0.35, cost: 1, destroyTo: 0 }
    })
    expect(solveStarforceChain(steps, 12, 18).attempts).toBeCloseTo(212.02, 1)
    expect(solveStarforceChain(steps, 15, 18).attempts).toBeCloseTo(187.2, 1)
    expect(solveStarforceChain(steps, 17, 18).attempts).toBeCloseTo(102.51, 1)
  })
})

describe('solveStarforceChain — destroyTo guard', () => {
  it('safeguard rule is TMS-sourced', () => {
    expect(STARFORCE.ruleSources.safeguard.source).toBe('TMS')
    expect(STARFORCE.ruleSources.safeguard.ref).toContain('https://maplestory.beanfun.com/bulletin?bid=74681')
  })

  it('solveStarforceChain throws when a destroying step returns past the target', () => {
    const steps: StarforceStep[] = [
      { success: 0.5, destroy: 0, down: 0, cost: 1, destroyTo: 0 },
      { success: 0.5, destroy: 0.1, down: 0, cost: 1, destroyTo: 2 }, // destroyTo 2 >= n = 2
    ]
    expect(() => solveStarforceChain(steps, 0, 2)).toThrow(/destroyTo/)
    // destroyTo inside the chain is fine
    expect(() => solveStarforceChain([steps[0], { ...steps[1], destroyTo: 0 }], 0, 2)).not.toThrow()
  })

  it('low-star chains do not throw', () => {
    // Real tmsStep steps (built by starforceExpectation): destroyReturnStar() is always 12, but these steps have destroy 0.
    expect(STARFORCE.destroyReturnStar(5)).toBe(12)
    for (const to of [10, 12]) {
      expect(() => starforceExpectation(200, 0, to, plain)).not.toThrow()
      expect(starforceExpectation(200, 0, to, plain).destroys).toBe(0)
    }
  })
})

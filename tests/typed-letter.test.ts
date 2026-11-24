import { describe, expect, it } from "vitest"
import { editorSpeedBudget } from "./browser/editor-speed-budget"
import { spikeKeys, typedLetters, warmupKeys } from "./browser/typed-letter"

const { typeTaskPerKey: meanLimit, typeTaskBeyondTypical: beyondLimit } = editorSpeedBudget({})
const keys = 48
const quietKey = 5.5
const busyMachine = 1.2

const spinOn = (spin: number, period: number, hits: number) =>
  Array.from({ length: keys }, (_, key) =>
    key >= warmupKeys && (key - warmupKeys) % period >= period - hits ? quietKey + spin : quietKey,
  )

const passes = (perKey: readonly number[]) => {
  const typed = typedLetters(perKey)
  return typed.trimmedMean < meanLimit && typed.beyondTypical < beyondLimit
}

describe("a typed letter's task", () => {
  it("accepts the high clean CI reading and catches a doubled low CI reading", () => {
    const { typeTaskPerKey } = editorSpeedBudget({ CI: "true" })
    const onEveryKey = (thread: number) => typedLetters(Array.from({ length: keys }, () => thread)).trimmedMean

    expect(onEveryKey(2.93)).toBeLessThan(typeTaskPerKey)
    expect(onEveryKey(2.2 * 2)).toBeGreaterThanOrEqual(typeTaskPerKey)
    expect(onEveryKey(2.2 * 2)).toBeLessThan(meanLimit)
  })

  it("passes a quiet run, and the same run on a machine that slows every key by a fifth", () => {
    expect(passes(Array.from({ length: keys }, () => quietKey))).toBe(true)
    expect(passes(Array.from({ length: keys }, () => quietKey * busyMachine))).toBe(true)
  })

  it("passes a busy run whose one lone key stalls 40 ms beside the letter that wraps the line", () => {
    const perKey = Array.from({ length: keys }, (_, key) => (key === 20 ? 40 : key === 44 ? 10.5 : 7.2))
    const typed = typedLetters(perKey)
    expect(typed.mean).toBeGreaterThan(meanLimit)
    expect(typed.trimmedMean).toBeCloseTo(7.2)
    expect(typed.beyondTypical).toBeLessThan(beyondLimit)
    expect(passes(perKey)).toBe(true)
  })

  it(`leaves only the slowest ${String(spikeKeys)} keys out of the trimmed mean`, () => {
    const perKey = Array.from({ length: keys }, (_, key) => (key >= keys - spikeKeys - 1 ? 30 : quietKey))
    expect(typedLetters(perKey).trimmedMean).toBeCloseTo((quietKey * 42 + 30) / 43)
  })

  it("leaves out the warmup keys", () => {
    const perKey = [
      ...Array.from({ length: warmupKeys }, () => 22.3),
      ...Array.from({ length: keys - warmupKeys }, () => quietKey),
    ]
    expect(typedLetters(perKey).mean).toBeCloseTo(quietKey)
  })

  it("catches 10 ms on a fifth of the keys beyond the typical key, which the mean lets pass", () => {
    const typed = typedLetters(spinOn(10, 5, 1))
    expect(typed.trimmedMean).toBeLessThan(meanLimit)
    expect(typed.typical).toBe(quietKey)
    expect(typed.beyondTypical).toBeGreaterThan(beyondLimit)
  })

  it("catches 10 ms on every key in the mean, where no key runs beyond the typical key", () => {
    const typed = typedLetters(spinOn(10, 1, 1))
    expect(typed.beyondTypical).toBe(0)
    expect(typed.trimmedMean).toBeGreaterThan(meanLimit)
  })

  it("fails every planted share from a fifth to all of the keys", () => {
    for (const spin of [10, 20])
      for (const [period, hits] of [
        [5, 1],
        [5, 2],
        [2, 1],
        [5, 3],
        [5, 4],
        [1, 1],
      ] as const)
        expect(passes(spinOn(spin, period, hits)), `${String(spin)} ms on ${String(hits)} of ${String(period)}`).toBe(
          false,
        )
  })
})

import { expect, it } from "vitest"
import type { FlushOutcome } from "./commit-edit"
import { resendFirst, resendMost, resendPause, resendPending } from "./deck-resend"

function flushes(outcomes: readonly FlushOutcome[], seen: string[]): () => Promise<FlushOutcome> {
  const queue = [...outcomes]
  return async () => {
    seen.push("flush")
    return queue.shift() ?? "sent"
  }
}

function resting(seen: string[]) {
  return async (ms: number) => {
    seen.push(`rest ${String(ms)}`)
  }
}

it("sends the pending edits again with no new edit until the server answers", async () => {
  const seen: string[] = []
  const settled: FlushOutcome[] = []
  const outcome = await resendPending(
    flushes(["offline", "offline", "sent"], seen),
    (each) => settled.push(each),
    new AbortController().signal,
    resting(seen),
    () => 1,
  )
  expect(outcome).toBe("sent")
  expect(settled).toEqual(["offline", "offline", "sent"])
  expect(seen).toEqual([
    `rest ${String(resendFirst)}`,
    "flush",
    `rest ${String(resendFirst * 2)}`,
    "flush",
    `rest ${String(resendFirst * 4)}`,
    "flush",
  ])
})

it.each(["kept", "set-aside", "signed-out"] as const)("stops once the server answers %s", async (answer) => {
  const seen: string[] = []
  const settled: FlushOutcome[] = []
  const outcome = await resendPending(
    flushes([answer, "sent"], seen),
    (each) => settled.push(each),
    new AbortController().signal,
    resting(seen),
    () => 1,
  )
  expect(outcome).toBe(answer)
  expect(settled).toEqual([answer])
  expect(seen.filter((step) => step === "flush")).toHaveLength(1)
})

it("waits twice as long after each unanswered send up to a bound, and spreads each wait over its upper half", () => {
  const attempts = Array.from({ length: 8 }, (_, attempt) => attempt)
  const longest = attempts.map((attempt) => resendPause(attempt, () => 1))
  const shortest = attempts.map((attempt) => resendPause(attempt, () => 0))
  expect(longest).toEqual([1000, 2000, 4000, 5000, 5000, 5000, 5000, 5000])
  expect(Math.max(...longest)).toBe(resendMost)
  expect(shortest).toEqual(longest.map((ms) => ms / 2))
  expect(resendPause(1, () => 0.5)).toBe(1500)
  expect(resendPause(1000, () => 1)).toBe(resendMost)
})

it("stops without sending once the editor leaves the deck", async () => {
  const seen: string[] = []
  const leaving = new AbortController()
  const outcome = await resendPending(
    flushes(["sent"], seen),
    () => seen.push("settle"),
    leaving.signal,
    async () => {
      leaving.abort()
    },
  )
  expect(outcome).toBeUndefined()
  expect(seen).toEqual([])
})

it("drops the answer to a send that was on its way when the editor left the deck", async () => {
  const seen: string[] = []
  const leaving = new AbortController()
  const outcome = await resendPending(
    async () => {
      seen.push("flush")
      leaving.abort()
      return "sent"
    },
    () => seen.push("settle"),
    leaving.signal,
    async () => undefined,
  )
  expect(outcome).toBeUndefined()
  expect(seen).toEqual(["flush"])
})

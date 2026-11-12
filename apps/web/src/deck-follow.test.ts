import type { FollowResult } from "@airdesign/live"
import { expect, it, vi } from "vitest"
import { followDeck, followPause } from "./deck-follow"

type Step = FollowResult | "offline"

function follower(steps: readonly Step[], seen: string[]) {
  const queue = [...steps]
  return {
    async follow(deck: string): Promise<FollowResult> {
      seen.push(`follow ${deck}`)
      const step = queue.shift() ?? { ok: false, refusal: "deleted" }
      if (step === "offline") throw new TypeError("Failed to fetch")
      return step
    },
  }
}

const changed = { ok: true, deck: "deck", revision: 2, changed: true } as FollowResult
const unchanged = { ok: true, deck: "deck", revision: 3, changed: false } as FollowResult

it("repaints once for each change it brings in and stops when the deck is gone", async () => {
  const seen: string[] = []
  const ended = await followDeck(
    follower([changed, unchanged, changed, { ok: false, refusal: "deleted" }], seen),
    "deck",
    () => {
      seen.push("repaint")
    },
    new AbortController().signal,
    async (ms) => {
      seen.push(`rest ${String(ms)}`)
    },
  )
  expect(ended).toBe("deleted")
  expect(seen).toEqual(["follow deck", "repaint", "follow deck", "follow deck", "repaint", "follow deck"])
})

it("rests and tries again after the network drops or the answer is unreadable", async () => {
  const seen: string[] = []
  const ended = await followDeck(
    follower(["offline", { ok: false, refusal: "payload" }, changed, { ok: false, refusal: "session" }], seen),
    "deck",
    () => {
      seen.push("repaint")
    },
    new AbortController().signal,
    async (ms) => {
      seen.push(`rest ${String(ms)}`)
    },
  )
  expect(ended).toBe("session")
  expect(seen).toEqual([
    "follow deck",
    `rest ${String(followPause)}`,
    "follow deck",
    `rest ${String(followPause)}`,
    "follow deck",
    "repaint",
    "follow deck",
  ])
})

it("stops without repainting once the editor leaves the deck", async () => {
  const seen: string[] = []
  const leaving = new AbortController()
  const link = {
    async follow(): Promise<FollowResult> {
      seen.push("follow")
      leaving.abort()
      return changed
    },
  }
  const ended = await followDeck(
    link,
    "deck",
    () => {
      seen.push("repaint")
    },
    leaving.signal,
  )
  expect(ended).toBeUndefined()
  expect(seen).toEqual(["follow"])
})

it("rests and keeps following when a repaint fails", async () => {
  const seen: string[] = []
  let repaints = 0
  const ended = await followDeck(
    follower([changed, changed, { ok: false, refusal: "owner" }], seen),
    "deck",
    () => {
      repaints += 1
      seen.push("repaint")
      if (repaints === 1) throw new Error("repaint")
    },
    new AbortController().signal,
    async (ms) => {
      seen.push(`rest ${String(ms)}`)
    },
  )
  expect(ended).toBe("owner")
  expect(seen).toEqual([
    "follow deck",
    "repaint",
    `rest ${String(followPause)}`,
    "follow deck",
    "repaint",
    "follow deck",
  ])
})

it("stops resting at once when the editor leaves the deck", async () => {
  vi.useFakeTimers()
  try {
    const leaving = new AbortController()
    const ended = followDeck(
      {
        async follow(): Promise<FollowResult> {
          throw new TypeError("Failed to fetch")
        },
      },
      "deck",
      () => undefined,
      leaving.signal,
    )
    await vi.advanceTimersByTimeAsync(1)
    leaving.abort()
    await expect(ended).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

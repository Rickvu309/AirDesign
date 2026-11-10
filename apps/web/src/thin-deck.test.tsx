import type { Remote } from "@airdesign/live"
import { expect, it, vi } from "vitest"
import { commitEdit } from "./thin-deck"

async function postsCommit(remote: Remote): Promise<boolean> {
  const seen: string[] = []
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    seen.push(String(url))
    expect(String(init.method)).toBe("POST")
    expect(String(init.credentials)).toBe("same-origin")
    expect(JSON.parse(String(init.body))).toEqual({ deck: "clean", batch: [{ value: "Hello!", node: "a" }] })
    return new Response(JSON.stringify({ ok: true, deck: "clean", revision: 1, key: "clean:1" }))
  })
  await remote.commit({ deck: "clean", batch: [{ value: "Hello!", node: "a" }] })
  return seen[0] === "/decks/commit"
}

it("flushes the http remote for deck clean after Hello! on node a", async () => {
  const calls: { op: "enqueue" | "flush"; remote: Remote; deck: string; value?: string; node?: string }[] = []
  try {
    await commitEdit((remote) => {
      return {
        async enqueue(deck, value, node) {
          calls.push({ op: "enqueue", remote, deck, value, node })
          return { ok: true }
        },
        async flush(deck) {
          calls.push({ op: "flush", remote, deck })
          return { ok: true }
        },
      }
    }, "Hello!")
    const enqueued = calls[0]
    const flushed = calls[1]
    expect(calls.map((call) => call.op)).toEqual(["enqueue", "flush"])
    expect(enqueued).toMatchObject({ deck: "clean", value: "Hello!", node: "a" })
    expect(flushed).toMatchObject({ deck: "clean" })
    if (enqueued === undefined || flushed === undefined) return
    expect(await postsCommit(enqueued.remote)).toBe(false)
    expect(await postsCommit(flushed.remote)).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})

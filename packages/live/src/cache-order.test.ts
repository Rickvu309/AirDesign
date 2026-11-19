import { currentValue } from "@airdesign/document"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { installSlowIndexedDb, memoryShelf, node, quiet, slowStore, traffic } from "./browser-fixtures.js"
import type { OpenDeckResult } from "./cache.js"
import { connect, deleteDatabase, memoryRemote, watchUnsent, type Remote } from "./index.js"

const slow = slowStore()

beforeEach(() => {
  installSlowIndexedDb(slow)
})

afterEach(async () => {
  slow.drop()
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function text(opened: OpenDeckResult): string | null {
  if (!opened.ok) throw new Error(opened.refusal)
  const body = opened.register.elements[node]
  return body === undefined ? null : currentValue(body)
}

it("reads a deck without an edit asked for after the read, while the device holds the read", async () => {
  const cache = connect(memoryRemote(), { shelf: memoryShelf() })
  expect((await cache.enqueue("deck", "Old", node, "file text")).ok).toBe(true)
  slow.hold()
  const before = cache.openDeck("deck")
  const typed = cache.enqueue("deck", "N", node, "file text")
  const after = cache.openDeck("deck")
  await new Promise((done) => setTimeout(done, 0))
  expect(slow.waiting.length).toBe(1)
  slow.release()
  expect(text(await before)).toBe("Old")
  expect((await typed).ok).toBe(true)
  expect(text(await after)).toBe("N")
})

type HeldAnswer = {
  readonly remote: Remote
  readonly opens: () => number
  readonly asked: () => Promise<void>
  readonly answer: () => void
}

function heldAnswer(): HeldAnswer {
  const real = memoryRemote()
  let opens = 0
  let asked: () => void = () => undefined
  let answer: () => void = () => undefined
  const sent = new Promise<void>((resolve) => {
    asked = resolve
  })
  const answered = new Promise<void>((resolve) => {
    answer = resolve
  })
  let holding = false
  return {
    remote: {
      ...real,
      open: (body) => {
        opens += 1
        return real.open(body)
      },
      commit: async (body) => {
        const result = await real.commit(body)
        if (!holding) return result
        holding = false
        asked()
        await answered
        return result
      },
    },
    opens: () => opens,
    asked: () => {
      holding = true
      return sent
    },
    answer: () => answer(),
  }
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(undefined)
  })
}

async function typedWhileConfirming(held: HeldAnswer, cache: ReturnType<typeof connect>): Promise<readonly string[]> {
  expect((await cache.enqueue("deck", " Ty", node, "")).ok).toBe(true)
  const sending = held.asked()
  const flushing = cache.flush("deck")
  await sending
  quiet()
  const answered: string[] = []
  const first = cache.enqueue("deck", " Typ", node, "").then(() => answered.push(" Typ"))
  while (traffic.puts === 0) await nextTask()
  held.answer()
  const second = cache.enqueue("deck", " Type", node, "").then(() => answered.push(" Type"))
  await Promise.all([flushing, first, second])
  return answered
}

it("answers keystrokes in the order they were typed when a commit's answer lands between two of them", async () => {
  const held = heldAnswer()
  const cache = connect(held.remote, { shelf: memoryShelf() })
  const stop = watchUnsent("deck", () => undefined)
  expect(await typedWhileConfirming(held, cache)).toEqual([" Typ", " Type"])
  stop()
  expect(text(await cache.openDeck("deck"))).toBe(" Type")
})

it("follows its own commit of those keystrokes without opening the deck again", async () => {
  const held = heldAnswer()
  const cache = connect(held.remote, { shelf: memoryShelf() })
  const stop = watchUnsent("deck", () => undefined)
  await typedWhileConfirming(held, cache)
  const opens = held.opens()
  const following = cache.follow("deck")
  expect(await cache.flush("deck")).toMatchObject({ ok: true, revision: 2 })
  expect(await following).toEqual({ ok: true, deck: "deck", revision: 2, changed: false })
  stop()
  expect(held.opens()).toBe(opens)
})

import { elementId, limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { commitBox, commitEdit, server } from "./commit-edit"

it("paints before the commit is sent", async () => {
  const order: string[] = []
  let sentFlush: () => void = () => undefined
  const flushSent = new Promise<void>((resolve) => {
    sentFlush = resolve
  })
  void commitEdit(
    () => {
      return {
        async enqueue() {
          order.push("enqueue")
          return { ok: true }
        },
        flush() {
          order.push("flush")
          sentFlush()
          return new Promise(() => undefined)
        },
        async pending() {
          return []
        },
      }
    },
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
    () => {
      order.push("paint")
    },
  )
  await flushSent
  expect(order).toEqual(["enqueue", "paint", "flush"])
})

function linkAnswering(flush: () => Promise<unknown>, waiting: readonly unknown[] = ["row"]) {
  return () => ({
    async enqueue() {
      return { ok: true }
    },
    flush,
    async pending() {
      return waiting
    },
  })
}

it("reports sent when the send carried nothing and nothing waits on the device", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: false, refusal: "batch" }), []),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("sent")
})

it("keeps the edit when the send carried nothing but rows still wait on the device", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: false, refusal: "batch" })),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("kept")
})

it("reports an offline device when the flush cannot reach the network", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.reject(new TypeError("Failed to fetch"))),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("offline")
})

it("reports edits set aside whether the rest of the flush landed or not", async () => {
  for (const answer of [
    { ok: true, deck: "any-deck", revision: 2, key: "any-deck:2", aside: 1 },
    { ok: false, refusal: "dead", aside: 2 },
  ]) {
    const outcome = await commitEdit(
      linkAnswering(() => Promise.resolve(answer)),
      "any-deck",
      "Hello!",
      {
        id: elementId("256.2"),
        file: "Hello",
      },
    )
    expect(outcome).toBe("set-aside")
  }
})

it("reports edits set aside as too large only when every one of them was too large", async () => {
  const outcomeFor = async (answer: object) =>
    commitEdit(
      linkAnswering(() => Promise.resolve(answer)),
      "any-deck",
      "Hello!",
      {
        id: elementId("256.2"),
        file: "Hello",
      },
    )
  const landed = { ok: true, deck: "any-deck", revision: 2, key: "any-deck:2" }
  expect(await outcomeFor({ ...landed, aside: 1, asideTooLarge: 1 })).toBe("set-aside-too-large")
  expect(await outcomeFor({ ok: false, refusal: "dead", aside: 2, asideTooLarge: 2 })).toBe("set-aside-too-large")
  expect(await outcomeFor({ ...landed, aside: 2, asideTooLarge: 1 })).toBe("set-aside")
})

it("reports a signed-out person when the flush is refused for the session", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: false, refusal: "session" })),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("signed-out")
})

it("keeps the edit without a word when the answer body is not JSON", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.reject(new SyntaxError("Unexpected token '<'"))),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("kept")
})

it("reports sent when the flush lands", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: true })),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("sent")
})

it("keeps the edit without a word when the server answers another refusal", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: false, refusal: "stale" })),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("kept")
})

it("keeps a box with the element's floor, paints it, then sends it on the text's flush path", async () => {
  const order: string[] = []
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  const outcome = await commitBox(
    (remote) => ({
      async enqueueBox(deck, value, node, floor) {
        order.push(`keep ${remote === server ? "server" : "device"} ${deck} ${JSON.stringify(value)} ${node} ${floor}`)
        return { ok: true }
      },
      async flush(deck) {
        order.push(`flush ${remote === server ? "server" : "device"} ${deck}`)
        return { ok: true }
      },
      async pending() {
        return []
      },
    }),
    "any-deck",
    box,
    { id: elementId("256.2"), file: "Hello" },
    () => {
      order.push("paint")
    },
  )
  expect(order).toEqual([`keep device any-deck ${JSON.stringify(box)} 256.2 Hello`, "paint", "flush server any-deck"])
  expect(outcome).toBe("sent")
})

it("puts a refused box back and sends nothing", async () => {
  const order: string[] = []
  const outcome = await commitBox(
    () => ({
      async enqueueBox() {
        return { ok: false }
      },
      async flush() {
        order.push("flush")
        return { ok: true }
      },
      async pending() {
        return []
      },
    }),
    "any-deck",
    { x: 1, y: 2, cx: 3, cy: 4 },
    { id: elementId("256.2"), file: "Hello" },
    () => {
      order.push("paint")
    },
    () => {
      order.push("refused")
    },
  )
  expect(order).toEqual(["refused"])
  expect(outcome).toBe("refused")
})

it.each(["size", "limit"])("reports %s as too-large, puts the element back and sends nothing", async (refusal) => {
  let flushed = 0
  let restored = 0
  const outcome = await commitEdit(
    () => ({
      async enqueue() {
        return { ok: false, refusal }
      },
      async flush() {
        flushed += 1
      },
      async pending() {
        return []
      },
    }),
    "any-deck",
    "x".repeat(limits.valueBytes + 1),
    { id: elementId("256.2"), file: "Hello" },
    undefined,
    () => {
      restored += 1
    },
  )
  expect(outcome).toBe("too-large")
  expect(flushed).toBe(0)
  expect(restored).toBe(1)
})

it("keeps a limit on a small edit distinct from the value-size refusal", async () => {
  const outcome = await commitEdit(
    () => ({
      async enqueue() {
        return { ok: false, refusal: "limit" }
      },
      async flush() {
        throw new Error("must not flush")
      },
    }),
    "deck",
    "Short",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("refused")
})

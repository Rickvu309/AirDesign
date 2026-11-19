import { elementId, limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { commitBoxes, commitEdit, flushPending, server } from "./commit-edit"

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

it("keeps a later edit pending when an earlier send succeeds", async () => {
  const open = linkAnswering(() => Promise.resolve({ ok: true }))
  expect(await flushPending(open, "any-deck")).toBe("kept")
})

it("reports a refused flush as kept, not as sent", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: false, refusal: "owner" })),
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

it("reports sent when the flush lands and no rows remain", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.resolve({ ok: true }), []),
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
  const outcome = await commitBoxes(
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
    [{ box, element: { id: elementId("256.2"), file: "Hello" } }],
    () => {
      order.push("paint")
    },
    () => {
      order.push("refused")
    },
  )
  expect(order).toEqual([`keep device any-deck ${JSON.stringify(box)} 256.2 Hello`, "paint", "flush server any-deck"])
  expect(outcome).toBe("sent")
})

it("puts a refused box back and sends nothing", async () => {
  const order: string[] = []
  const outcome = await commitBoxes(
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
    [{ box: { x: 1, y: 2, cx: 3, cy: 4 }, element: { id: elementId("256.2"), file: "Hello" } }],
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
      async pending() {
        return []
      },
    }),
    "deck",
    "Short",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("refused")
})

it("keeps every box it can, puts a refused one back, paints the kept ones once and flushes once", async () => {
  const order: string[] = []
  const refusedNode = elementId("256.3")
  const outcome = await commitBoxes(
    () => ({
      async pending() {
        return []
      },
      async enqueueBox(_deck, _value, node) {
        order.push(`keep ${node}`)
        return node === refusedNode ? { ok: false } : { ok: true }
      },
      async flush() {
        order.push("flush")
        return { ok: true }
      },
    }),
    "any-deck",
    [elementId("256.2"), refusedNode, elementId("256.4")].map((id) => ({
      box: { x: 1, y: 2, cx: 3, cy: 4 },
      element: { id, file: "" },
    })),
    (kept) => {
      order.push(`paint ${kept.join(" ")}`)
    },
    (node) => {
      order.push(`refused ${node}`)
    },
  )
  expect(order).toEqual(["keep 256.2", "keep 256.3", "refused 256.3", "keep 256.4", "paint 256.2 256.4", "flush"])
  expect(outcome).toBe("sent")
})

it("reports boxes too large to send as too-large, puts them back and sends nothing", async () => {
  let flushed = 0
  const restored: string[] = []
  const outcome = await commitBoxes(
    () => ({
      async pending() {
        return []
      },
      async enqueueBox() {
        return { ok: false, refusal: "size" }
      },
      async flush() {
        flushed += 1
      },
    }),
    "any-deck",
    [{ box: { x: 1, y: 2, cx: 3, cy: 4 }, element: { id: elementId("256.2"), file: "Hello" } }],
    () => {
      throw new Error("painted a refused box")
    },
    (node) => {
      restored.push(node)
    },
  )
  expect(outcome).toBe("too-large")
  expect(flushed).toBe(0)
  expect(restored).toEqual(["256.2"])
})

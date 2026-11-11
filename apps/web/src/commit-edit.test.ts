import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { commitEdit } from "./commit-edit"

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

function linkAnswering(flush: () => Promise<unknown>) {
  return () => ({
    async enqueue() {
      return { ok: true }
    },
    flush,
  })
}

it("reports an offline device when the flush cannot reach the network", async () => {
  const outcome = await commitEdit(
    linkAnswering(() => Promise.reject(new TypeError("Failed to fetch"))),
    "any-deck",
    "Hello!",
    { id: elementId("256.2"), file: "Hello" },
  )
  expect(outcome).toBe("offline")
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

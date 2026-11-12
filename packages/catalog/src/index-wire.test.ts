import { expect, it } from "vitest"
import { deckRoutes, readDeckIndex } from "./index.js"

const page = {
  deck: "deck",
  once: "page",
  offset: 0,
  total: 1,
  slides: [{ id: "258", position: 0 }],
  elements: [{ node: "258.7", kind: "shape", value: "Title", box: null, grouped: false }],
}

it("reads only owner index fields and keeps the route in the catalog", () => {
  expect(readDeckIndex(page)).toEqual({ ok: true, ...page })
  expect(deckRoutes.index.read(page)).toEqual({ ok: true, ...page })
  for (const changed of [
    { deck: "a b" },
    { once: "" },
    { actor: "person" },
    { offset: -1 },
    { total: 5001 },
    { elements: [{ ...page.elements[0], node: "a" }] },
    { slides: [{ id: "wrong", position: 0 }] },
  ]) {
    expect(readDeckIndex({ ...page, ...changed }).ok).toBe(false)
  }
})

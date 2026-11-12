import { describe, expect, it } from "vitest"
import { appendIndex, elementId, limits, readIndexPage, type IndexPage } from "./index.js"

const box = { x: 1, y: 2, cx: 3, cy: 4 }
const page: IndexPage = {
  once: "page-one",
  offset: 0,
  total: 2,
  slides: [
    { id: "258", position: 0 },
    { id: "259", position: 1 },
  ],
  elements: [{ node: elementId("258.7"), kind: "shape", value: "Title", box, grouped: false }],
}

describe("deck index", () => {
  it("appends immutable pages and replays a lost answer without duplicating elements", () => {
    const first = appendIndex(undefined, page)
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(first.refusal)
    expect(first.index.elements).toHaveLength(1)
    expect(appendIndex(first.index, page)).toEqual(first)
    expect(appendIndex(first.index, { ...page, elements: [{ ...page.elements[0]!, value: "Wrong" }] })).toEqual({
      ok: false,
      refusal: "present",
    })
    const last = appendIndex(first.index, {
      ...page,
      once: "page-two",
      offset: 1,
      elements: [{ node: elementId("259.9"), kind: "picture", value: null, box: null, grouped: true }],
    })
    expect(last.ok && last.index.elements.length === last.index.total).toBe(true)
    expect(appendIndex(undefined, { ...page, once: "bad", offset: 1 })).toEqual({ ok: false, refusal: "stale" })
  })

  it("rejects duplicate nodes, bad slide membership, order, text, boxes, and counts", () => {
    for (const changed of [
      { total: limits.elements + 1 },
      { slides: Array.from({ length: 51 }, (_, position) => ({ id: String(position), position })) },
      { slides: [{ id: "258", position: 1 }] },
      {
        slides: [
          { id: "258", position: 0 },
          { id: "258", position: 1 },
        ],
      },
      { elements: [page.elements[0], page.elements[0]] },
      { elements: [{ ...page.elements[0], node: "260.7" }] },
      { elements: [{ ...page.elements[0], value: "x".repeat(limits.body + 1) }] },
      { elements: [{ ...page.elements[0], value: "\u0000" }] },
      { elements: [{ ...page.elements[0], box: { ...box, cx: -1 } }] },
      { elements: [{ ...page.elements[0], kind: "invented" }] },
      { actor: "person" },
    ])
      expect(readIndexPage({ ...page, ...changed })).toBeNull()
    expect(readIndexPage({ ...page, elements: [{ ...page.elements[0], value: "é".repeat(5000) }] })).not.toBeNull()
  })
})

it("adds device layout placeholders to an older index without changing its opening elements", () => {
  const first = appendIndex(undefined, page)
  if (!first.ok) throw new Error(first.refusal)
  const title = { node: elementId("258.2"), kind: "shape", value: "", box, grouped: false } as const
  const enriched = {
    ...page,
    slides: [
      { id: "258", position: 0, layout: [title] },
      { id: "259", position: 1, layout: [] },
    ],
  }
  const next = appendIndex(first.index, enriched)
  expect(next.ok).toBe(true)
  if (!next.ok) return
  expect(next.index.elements).toEqual(first.index.elements)
  expect(next.index.slides[0]?.layout).toEqual([title])
  expect(appendIndex(next.index, enriched)).toEqual(next)
  expect(
    readIndexPage({ ...enriched, slides: [{ id: "258", position: 0, layout: [{ ...title, node: "259.2" }] }] }),
  ).toBeNull()
})

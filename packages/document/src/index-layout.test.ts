import { expect, it } from "vitest"

import { appendIndex, elementId, readIndexPage, type IndexPage } from "./index.js"

const box = { x: 1, y: 2, cx: 3, cy: 4 }
const title = { node: elementId("258.2"), kind: "shape", value: "", box, grouped: false, role: "title" } as const
const layouts = [
  { part: "ppt/slideLayouts/slideLayout1.xml", name: "Title", floor: [title] },
  { part: "ppt/slideLayouts/slideLayout7.xml", name: "Blank", floor: [] },
]
const first: IndexPage = {
  once: "one",
  offset: 0,
  total: 2,
  layouts,
  slides: [
    { id: "258", position: 0 },
    { id: "259", position: 1 },
  ],
  elements: [{ node: elementId("258.7"), kind: "shape", value: "A", box, grouped: false }],
}
const second: IndexPage = {
  once: "two",
  offset: 1,
  total: 2,
  slides: first.slides,
  elements: [{ node: elementId("259.7"), kind: "shape", value: "B", box, grouped: false }],
}

it("reads the deck's layouts, each with the layers a slide born on it starts with", () => {
  expect(readIndexPage(first)?.layouts).toEqual(layouts)
  expect(readIndexPage(second)?.layouts).toBeUndefined()
})

it("keeps the layouts the first page named when later pages arrive without them", () => {
  const one = appendIndex(undefined, first)
  if (!one.ok) throw new Error(one.refusal)
  const two = appendIndex(one.index, second)
  if (!two.ok) throw new Error(two.refusal)
  expect(two.index.layouts).toEqual(layouts)
  expect(two.index.elements).toHaveLength(2)
})

it("refuses layouts it cannot keep", () => {
  const [one] = layouts
  for (const bad of [
    "layouts",
    [{ ...one, part: "ppt/../secret.xml" }],
    [{ ...one, name: 7 }],
    [{ ...one, name: "n".repeat(300) }],
    [{ ...one, extra: true }],
    [one, one],
    [{ ...one, floor: [{ ...title, node: "259.2" }] }],
    [{ ...one, floor: [title, title] }],
    Array.from({ length: 65 }, (_, at) => ({ ...one, part: `ppt/slideLayouts/slideLayout${String(at)}.xml` })),
  ])
    expect(readIndexPage({ ...first, layouts: bad }), JSON.stringify(bad).slice(0, 80)).toBeNull()
})

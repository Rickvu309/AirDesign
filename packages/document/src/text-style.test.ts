import { expect, it } from "vitest"
import { elementId, openRegister, planChange, readTextValue, registerScope, writeTextValue } from "./index.js"
import { readTextStyles, textStylesOf } from "./text-style.js"
import type { DeckIndex } from "./deck-index.js"

it("applies template typography together without changing geometry, role or unrelated run formatting", () => {
  const node = elementId("258.2")
  const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Hello", italic: true, underline: true }] }])
  const box = { x: 10, y: 20, cx: 300, cy: 100 }
  const fields = {
    font: "+mj-lt",
    size: 4400,
    bold: true,
    color: { scheme: "accent1" as const },
    align: "center" as const,
    lineHeight: 120000,
  }
  const register = {
    ...openRegister("", ""),
    index: {
      total: 1,
      pages: [],
      slides: [{ id: "258", position: 0, textStyles: [{ id: "master/title", name: "Title", fields }] }],
      elements: [{ node, kind: "shape" as const, value, box, role: "body" as const, grouped: false }],
    },
  }
  const scope = registerScope(register)
  const planned = planChange({ target: { node }, text: { style: "master/title" } }, scope)
  expect(planned.ok).toBe(true)
  if (!planned.ok) return
  expect(planned.rows).toHaveLength(1)
  const row = planned.rows[0]?.row
  expect(Object.keys(row?.patch ?? {})).toEqual(["text"])
  const after = row?.patch.text?.value
  expect(typeof after === "object" && after !== null && "set" in after ? readTextValue(after.set) : null).toEqual([
    {
      from: 0,
      align: "center",
      lineHeight: 120000,
      runs: [
        {
          from: 0,
          text: "Hello",
          italic: true,
          underline: true,
          font: "+mj-lt",
          size: 4400,
          bold: true,
          color: { scheme: "accent1" },
        },
      ],
    },
  ])
  expect(scope.view(node)?.box).toEqual(box)
  expect(planChange({ target: { node }, text: { style: "missing" } }, scope).ok).toBe(false)
})

it("rejects invalid template fields at the index boundary", () => {
  expect(readTextStyles([{ id: "a", name: "Title", fields: { size: -1 } }])).toBeNull()
  expect(readTextStyles([{ id: "a", name: "Title", fields: { value: "replace content" } }])).toBeNull()
})

it("reads shared template definitions once per slide layout and rejects missing sources", async () => {
  const { readIndexPage } = await import("./deck-index.js")
  const page = {
    once: "styles",
    offset: 0,
    total: 0,
    elements: [],
    slides: [
      { id: "258", position: 0, textStyles: [{ id: "title", name: "Title", fields: { size: 4400 } }] },
      { id: "259", position: 1, textStyles: "258" },
    ],
  }
  expect(readIndexPage(page)).toEqual(page)
  expect(readIndexPage({ ...page, slides: [{ id: "258", position: 0, textStyles: "258" }] })).toBeNull()
})

const savedSubtitle = {
  id: "ppt/slideLayouts/slideLayout1.xml/3/0",
  name: "Subtitle",
  fields: {
    bold: false,
    font: "+mn-lt",
    size: 2400,
    align: "center",
    color: { scheme: "tx1" },
    italic: false,
    spaceAfter: 0,
    lineSpacing: 90000,
    spaceBefore: 0,
    letterSpacing: 0,
  },
}

it("reads a text style a build stored before line height had its name, at the index boundary", () => {
  const [read] = readTextStyles([savedSubtitle]) ?? []
  expect(read?.fields).toMatchObject({ lineHeight: 90_000, size: 2400 })
  expect(read?.fields).not.toHaveProperty("lineSpacing")
  expect(readTextStyles([{ ...savedSubtitle, fields: { ...savedSubtitle.fields, lineHeight: 1 } }])).toBeNull()
})

it("applies a stored index's text style with its line height when the index still says lineSpacing", () => {
  const node = elementId("256.3")
  const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "North" }] }])
  const index = {
    total: 1,
    pages: [],
    slides: [{ id: "256", position: 0, textStyles: [savedSubtitle] }],
    elements: [{ node, kind: "shape", value, box: { x: 0, y: 0, cx: 10, cy: 10 }, grouped: false }],
  } as unknown as DeckIndex
  const register = { ...openRegister("", ""), index }
  expect(textStylesOf(register, "256")[0]?.fields).toMatchObject({ lineHeight: 90_000 })
  const planned = planChange({ target: { node }, text: { style: savedSubtitle.id } }, registerScope(register))
  expect(planned.ok).toBe(true)
  if (!planned.ok) return
  const after = planned.rows[0]?.row.patch.text?.value
  expect(typeof after === "object" && "set" in after ? readTextValue(after.set)?.[0] : null).toMatchObject({
    lineHeight: 90_000,
    align: "center",
  })
})

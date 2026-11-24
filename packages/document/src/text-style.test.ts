import { expect, it } from "vitest"
import { readTextStyles } from "./text-style.js"

it("rejects invalid template fields at the index boundary", () => {
  expect(readTextStyles([{ id: "a", name: "Title", fields: { size: -1 } }])).toBeNull()
  expect(readTextStyles([{ id: "a", name: "Title", fields: { value: "replace content" } }])).toBeNull()
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

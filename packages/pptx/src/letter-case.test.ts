import type { TextCase, TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute } from "./slide-route.js"

const name = "ppt/slides/slide8.xml"
const box = (body: string): string =>
  `<p:sp xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`
const original = `<a:p><a:r><a:rPr lang="en-US" cap="all"/><a:t>quarterly review</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t>s and plans</a:t></a:r></a:p>`

function written(letters: TextCase): string {
  const value: TextValue = [
    {
      from: 0,
      runs: [
        { from: 0, text: "quarterly review", case: letters },
        { from: 1, text: "s and plans", case: letters },
      ],
    },
  ]
  const after = applyRoute(new Map([[name, encodeUtf8(box(original))]]), {
    name: "text",
    part: name,
    shape: "2",
    value,
  })
  return decodeUtf8(after.get(name) ?? encodeUtf8(""))
}

it("writes Uppercase and Small caps as PowerPoint's cap, keeping the typed letters", () => {
  expect(written("upper")).toContain('cap="all"/><a:t>quarterly review</a:t>')
  expect(written("small")).toContain('cap="small"/><a:t>quarterly review</a:t>')
  expect(written("none")).toContain('cap="none"/><a:t>quarterly review</a:t>')
})

it("writes Lowercase and Title case as the letters shown, since PowerPoint has no attribute for them", () => {
  expect(written("lower")).toContain('cap="none"/><a:t>quarterly review</a:t>')
  const titled = written("title")
  expect(titled).toContain("<a:t>Quarterly Review</a:t>")
  expect(titled).toContain("<a:t>s And Plans</a:t>")
})

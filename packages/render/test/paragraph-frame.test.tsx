import {expect, it} from "vitest"
import {renderToStaticMarkup} from "react-dom/server"
import {Body} from "../src/text/body.tsx"
import {decodeLegacyRunsV2} from "../../deck/src/text/legacy-v2.ts"
import {id} from "../../deck/src/model.ts"

it("renders independent paragraph styles, continuation, empty insertion styles and frame formatting", () => {
  const body = decodeLegacyRunsV2([{text: "one\ntwo", font: "Geist", size: 20, color: "#123456", bold: true}], id("frame"), id("first")), first = body.paragraphs[0]
  first.marker = {kind: "number", format: "alphaUpper", start: 4}; first.alignment = "right"; first.indentation = {left: 24, right: 8, firstLine: -12}
  first.spacing = {before: 4, after: 8, line: {kind: "multiple", value: 1.5}}
  body.paragraphs.push({...structuredClone(first), id: id("second"), runs: [], marker: {kind: "number", format: "alphaUpper", start: null}, endStyle: {...first.endStyle, size: 32}})
  body.frame.anchor = "middle"; body.frame.insets.left = 12; body.frame.autofit = {kind: "shrink", fontScale: 0.5, lineReduction: 0.2}
  const html = renderToStaticMarkup(<Body body={body}/>)
  document.body.innerHTML = html
  expect(document.querySelector('[data-text-frame]')?.getAttribute("style")).toContain("justify-content:center")
  const paragraphs = document.querySelectorAll("[data-paragraph]")
  expect(paragraphs).toHaveLength(2)
  expect(paragraphs[0]!.getAttribute("style")).toContain("text-align:right")
  expect(paragraphs[0]!.getAttribute("style")).toContain("text-indent:-12px")
  expect(paragraphs[1]!.getAttribute("style")).toContain("font-size:16px")
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["D.", "E."])
  expect(paragraphs[0]!.querySelectorAll("br")).toHaveLength(1)
  expect(paragraphs[1]!.querySelector("[data-paragraph-end]")).not.toBeNull()
})

it("renders bounded large numbering and alphabetical rollover", () => {
  const body = decodeLegacyRunsV2([{text: "", font: "Geist", size: 20, color: "#123456", bold: false}], id("frame"), id("first")), first = body.paragraphs[0]
  first.marker = {kind: "number", format: "romanUpper", start: 4000}
  body.paragraphs.push({...structuredClone(first), id: id("second"), marker: {kind: "number", format: "alphaLower", start: 27}})
  const html = renderToStaticMarkup(<Body body={body}/>)
  document.body.innerHTML = html
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["4000.", "aa."])
})

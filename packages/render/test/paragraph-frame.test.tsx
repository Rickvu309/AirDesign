import {expect, it} from "vitest"
import type {ParagraphMarker} from "../../deck/src/text/body.ts"
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
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["[numbering unavailable]", "aa."])
})


it("renders DrawingML repeated-letter alphabetic numbering independently of numeric state", () => {
  const body = decodeLegacyRunsV2([{text: "item", font: "Geist", size: 20, color: "#123456", bold: false}], id("letters"), id("letter")), first = body.paragraphs[0]
  first.marker = {kind: "number", format: "alphaLower", start: 26}
  for (const start of [27, 28, 52, 53]) body.paragraphs.push({...structuredClone(first), id: id(`letter${start}`), marker: {kind: "number", format: "alphaLower", start}})
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["z.", "aa.", "bb.", "zz.", "aaa."])
})

it("reduces percentage line spacing but preserves fixed point spacing under saved autofit", () => {
  const body = decodeLegacyRunsV2([{text: "saved", font: "Geist", size: 32, color: "#123456", bold: false}], id("saved"), id("point")), first = body.paragraphs[0]
  first.spacing.line = {kind: "points", value: 40}
  body.paragraphs.push({...structuredClone(first), id: id("percentage"), spacing: {...first.spacing, line: {kind: "multiple", value: 1.5}}})
  body.frame.autofit = {kind: "shrink", fontScale: 0.625, lineReduction: 0.2}
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll<HTMLElement>("[data-paragraph]")].map(node => node.style.lineHeight)).toEqual(["25px", "1.2"])
})


it("continues alphabetic counters past the maximum explicit DrawingML start without a clamp", () => {
  const body = decodeLegacyRunsV2([{text: "", font: "Geist", size: 20, color: "#123456", bold: false}], id("bounded"), id("boundedParagraph"))
  body.paragraphs[0].marker = {kind: "number", format: "alphaLower", start: 32767}
  body.paragraphs.push({...structuredClone(body.paragraphs[0]), id: id("continuedParagraph"), marker: {kind: "number", format: "alphaLower", start: null}})
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["g".repeat(1261) + ".", "h".repeat(1261) + "."])
})

it("paints numeric state for empty items, repeated starts, child return and interruption", () => {
  const body = decodeLegacyRunsV2([{text: "", font: "Geist", size: 20, color: "#123456", bold: false}], id("state"), id("stateFirst")), first = body.paragraphs[0]
  first.marker = {kind: "number", format: "alphaLower", start: 26}
  const add = (level: number, start: number | null) => body.paragraphs.push({...structuredClone(first), id: id(`state${body.paragraphs.length}`), level, marker: {kind: "number", format: "alphaLower", start}})
  add(0, null); add(0, 26); add(0, 31); add(1, null); add(0, null)
  body.paragraphs.push({...structuredClone(first), id: id("stateInterruption"), marker: {kind: "none"}})
  add(0, null)
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll("[data-paragraph]")].map(node => node.querySelector("[data-marker]")?.textContent ?? null)).toEqual(["z.", "aa.", "z.", "ee.", "a.", "ff.", null, "a."])
})


it("renders supported punctuation without changing text or inventing unsupported markers", () => {
  const body = decodeLegacyRunsV2([{text: "editable", font: "Geist", size: 20, color: "#123456", bold: false}], id("punctuation"), id("punctuationFirst"))
  const first = body.paragraphs[0]
  first.marker = {kind: "number", format: "decimal", punctuation: "plain", start: 4}
  body.paragraphs.push({...structuredClone(first), id: id("right"), marker: {kind: "number", format: "alphaLower", punctuation: "right-parenthesis", start: 27}})
  body.paragraphs.push({...structuredClone(first), id: id("both"), marker: {kind: "number", format: "romanUpper", punctuation: "parentheses", start: 4}})
  body.paragraphs.push({...structuredClone(first), id: id("retained"), marker: {kind: "source-number", scheme: "thaiAlphaPeriod", start: 1}})
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["4", "aa)", "(IV)", "[numbering unavailable]"])
  expect(document.querySelectorAll("[data-paragraph]")).toHaveLength(4)
  expect(document.body.textContent).toContain("editable")
})

it("renders the continued parent counter after a retained nested numbering scheme", () => {
  const body = decodeLegacyRunsV2([{text: "editable", font: "Arial", size: 20, color: "#123456", bold: false}], id("nestedFrame"), id("parentFirst"))
  const first = body.paragraphs[0]
  first.marker = {kind: "number", format: "decimal", start: null}
  body.paragraphs.push({...structuredClone(first), id: id("nestedRetained"), level: 1, marker: {kind: "source-number", scheme: "thaiAlphaPeriod", start: null}})
  body.paragraphs.push({...structuredClone(first), id: id("parentReturn")})
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  expect([...document.querySelectorAll("[data-marker]")].map(node => node.textContent)).toEqual(["1.", "[numbering unavailable]", "2."])
  expect([...document.querySelectorAll("[data-text-run]")].map(node => node.textContent)).toEqual(["editable", "editable", "editable"])
})

it("lays out no-fill glyphs with independent visible neighbors and retained shadow paint", () => {
  const body = decodeLegacyRunsV2([{text: "Invisible", font: "Geist", size: 20, color: "#123456", bold: false}, {text: "Visible", font: "Geist", size: 20, color: "#445566", bold: false}], id("frame"), id("first"))
  body.paragraphs[0].runs[0]!.style.color = null
  body.paragraphs[0].runs[0]!.style.outerShadow = {kind: "outer", color: "#112233", opacity: 0.5, blur: 2, distance: 3, direction: 45, scale: {x: 1, y: 1}, skew: {x: 0, y: 0}, alignment: "ctr", rotateWithShape: false}
  body.paragraphs[0].endStyle.color = null
  document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
  const runs = document.querySelectorAll<HTMLElement>("[data-text-run]")
  expect(runs[0]!.textContent).toBe("Invisible")
  expect(runs[0]!.style.color).toBe("transparent")
  expect(runs[0]!.style.opacity).toBe("")
  expect(runs[0]!.dataset.shadowColor).toBe("#112233")
  expect(runs[1]!.style.color).toBe("#445566")
  expect(document.querySelector<HTMLElement>("[data-paragraph]")!.style.color).toBe("transparent")
})

for (const marker of [{kind: "bullet", character: "•"}, {kind: "number", format: "decimal", start: null}] satisfies ParagraphMarker[]) {
  it(`renders ${marker.kind} paint from the first text run independently of the paragraph end`, () => {
    const body = decodeLegacyRunsV2([{text: "Visible", font: "Geist", size: 20, color: "#204060", bold: false}, {text: "Hidden", font: "Geist", size: 20, color: "#112233", bold: false}], id("frame"), id("first"))
    const paragraph = body.paragraphs[0]
    paragraph.marker = marker
    paragraph.endStyle.color = null
    paragraph.runs[1]!.style.color = null
    document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
    expect(document.querySelector<HTMLElement>("[data-marker]")!.style.color).toBe("#204060")
    paragraph.marker = {...marker, color: "#aabbcc"}
    document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
    expect(document.querySelector<HTMLElement>("[data-marker]")!.style.color).toBe("#aabbcc")
    paragraph.marker = marker
    paragraph.runs[0]!.style.color = null
    paragraph.endStyle.color = "#ffffff"
    document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
    expect(document.querySelector<HTMLElement>("[data-marker]")!.style.color).toBe("transparent")
    paragraph.runs = []
    document.body.innerHTML = renderToStaticMarkup(<Body body={body}/>)
    expect(document.querySelector<HTMLElement>("[data-marker]")!.style.color).toBe("#ffffff")
  })
}

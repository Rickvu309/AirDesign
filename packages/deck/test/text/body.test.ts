import {describe, expect, it} from "vitest"
import {id} from "../../src/model.ts"
import {fixtureDeck} from "../../src/fixture.ts"
import {parseDeck} from "../../src/parse.ts"
import {parseTextBody} from "../../src/text/body-codec.ts"
import {decodeLegacyRunsV2} from "../../src/text/legacy-v2.ts"
import {parseNativeArchiveV3} from "../../src/text/native-v3.ts"
import {paragraphNumbers} from "../../src/text/numbering.ts"
import type {Paragraph, TextBody} from "../../src/text/body.ts"

export function body(): TextBody {
  return decodeLegacyRunsV2([{text: "alpha\n\nbeta\n", font: "Geist", size: 20, color: "#123456", bold: false}], id("frame"), id("paragraph"))
}
describe("native text body boundary", () => {
  it("keeps one paragraph, explicit styled LF breaks and rendering defaults", () => {
    const value = body()
    expect(value.paragraphs).toHaveLength(1)
    expect(value.paragraphs[0].runs.map(run => run.kind === "text" ? run.text : "\n")).toEqual(["alpha", "\n", "\n", "beta", "\n"])
    expect(value.paragraphs[0].spacing.line).toEqual({kind: "multiple", value: 1.2})
    expect(value.frame.insets).toEqual({top: 0, right: 0, bottom: 0, left: 0})
  })
  it("preserves an empty paragraph's final insertion style", () => {
    const value = decodeLegacyRunsV2([{text: "", font: "Geist", size: 12, color: "red", bold: true}], id("f"), id("p"))
    expect(value.paragraphs[0].runs).toEqual([])
    expect(value.paragraphs[0].endStyle.bold).toBe(true)
    expect(parseTextBody(value)).toEqual(value)
  })
  it("refuses ambiguous CR input rather than losing content", () => {
    expect(() => decodeLegacyRunsV2([{text: "a\rb", font: "Geist", size: 12, color: "red", bold: true}], id("f"), id("p"))).toThrow("reconciliation")
  })
  it.each([
    (v: TextBody) => { Object.assign(v, {paragraphs: []}) },
    (v: TextBody) => { v.paragraphs[0].id = v.frame.id },
    (v: TextBody) => { v.paragraphs[0].level = 9 },
    (v: TextBody) => { v.paragraphs[0].indentation.right = -1 },
    (v: TextBody) => { v.paragraphs[0].spacing.line.value = 0 },
    (v: TextBody) => { v.frame.insets.top = Infinity },
    (v: TextBody) => { v.frame.autofit = {kind: "shrink", fontScale: 1.1, lineReduction: 0} },
    (v: TextBody) => { v.frame.autofit = {kind: "shrink", fontScale: 1, lineReduction: 1} },
    (v: TextBody) => { v.paragraphs[0].runs = [{kind: "text", text: "a\nb", style: v.paragraphs[0].endStyle}] },
    (v: TextBody) => { v.paragraphs[0].marker = {kind: "number", format: "decimal", start: 0} },
    (v: TextBody) => { v.paragraphs[0].endStyle.letterSpacing = Infinity },
    (v: TextBody) => { v.paragraphs[0].endStyle.baseline = NaN },
    (v: TextBody) => { v.paragraphs[0].endStyle.kerning = -1 },
    (v: TextBody) => { Object.assign(v.paragraphs[0].endStyle, {capitalization: "invented"}) },
    (v: TextBody) => { v.paragraphs[0].marker = {kind: "bullet", character: "•", font: ""} },
    (v: TextBody) => { v.paragraphs[0].endStyle.opacity = 1.1 },
    (v: TextBody) => { v.paragraphs[0].endStyle.highlight = "invalid" },
    (v: TextBody) => { v.paragraphs[0].spacing.before = {kind: "multiple", value: -1} },
    (v: TextBody) => { v.paragraphs[0].marker = {kind: "bullet", character: "•", size: {kind: "points", value: 0}} },
    (v: TextBody) => { Object.assign(v.frame, {compatibilityLineSpacing: "true"}) },
    (v: TextBody) => { Object.assign(v.frame, {wrap: "invented"}) },
    (v: TextBody) => { Object.assign(v.paragraphs[0], {glyphAlignment: "invented"}) },
    (v: TextBody) => { v.paragraphs[0].tabSize = 0 },
    (v: TextBody) => { v.paragraphs[0].tabSize = Infinity },
    (v: TextBody) => { v.paragraphs[0].endStyle.symbolFont = "" },
    (v: TextBody) => { Object.assign(v.paragraphs[0].endStyle, {outerShadow: {kind: "outer"}}) },
    (v: TextBody) => { Object.assign(v.frame, {spacingAtEdges: "true"}) },
    (v: TextBody) => { Object.assign(v.frame, {warp: "unknown"}) }
  ])("rejects malformed canonical input %#", mutate => {
    const value = body(); mutate(value)
    expect(() => parseTextBody(value)).toThrow()
  })
  it("validates negative first-line offsets and all frame alternatives", () => {
    const value = body()
    value.paragraphs[0].indentation.firstLine = -12
    for (const autofit of [{kind: "none"}, {kind: "resize-shape"}, {kind: "shrink", fontScale: 0.5, lineReduction: 0.2}] as const) {
      value.frame.autofit = autofit
      expect(parseTextBody(value)).toEqual(value)
    }
  })
  it("detaches parsed values from callers", () => {
    const input = body(), parsed = parseTextBody(input)
    input.paragraphs[0].endStyle.size = 77
    expect(parsed.paragraphs[0].endStyle.size).toBe(20)
  })
  it("rejects mixed text shapes and proves old readers cannot read native archives", () => {
    const legacy = fixtureDeck(1), element = legacy.slides[0]!.elements[0]!
    if (element.kind !== "text") throw new Error("fixture")
    const {runs, ...base} = element
    void runs
    const native = {...legacy, slides: [{...legacy.slides[0], elements: [{...base, body: body()}]}]}
    expect(parseNativeArchiveV3({version: 3, deck: native}).deck).toEqual(native)
    expect(() => parseDeck(native)).toThrow()
    Object.assign(native.slides[0]!.elements[0]!, {runs: element.runs})
    expect(() => parseNativeArchiveV3({version: 3, deck: native})).toThrow("invalid-native-archive-v3")
  })
  it("rejects cross-tree internal identity collisions", () => {
    const legacy = fixtureDeck(1), element = legacy.slides[0]!.elements[0]!
    if (element.kind !== "text") throw new Error("fixture")
    const {runs, ...base} = element
    void runs
    const value = body(); value.frame.id = legacy.id
    expect(() => parseNativeArchiveV3({version: 3, deck: {...legacy, slides: [{...legacy.slides[0], elements: [{...base, body: value}]}]}})).toThrow("duplicate")
  })
  it("continues compatible numbering per level and resets on restart or leaving a list", () => {
    function numbered(level: number, start: number | null = null): Paragraph { return {...body().paragraphs[0], level, marker: {kind: "number", format: "decimal", start}} }
    expect(paragraphNumbers([numbered(0), numbered(1), numbered(1), numbered(0), numbered(1), numbered(0, 4), numbered(1), body().paragraphs[0], numbered(0)])).toEqual([1, 1, 2, 2, 3, 4, 1, null, 1])
  })
  it("continues a parent list across nested retained numbering schemes", () => {
    const parent: Paragraph = {...body().paragraphs[0], level: 0, marker: {kind: "number", format: "decimal", start: null}}
    const retained: Paragraph = {...parent, level: 1, marker: {kind: "source-number", scheme: "thaiAlphaPeriod", start: null}}
    const changed: Paragraph = {...retained, marker: {kind: "source-number", scheme: "hindiAlphaPeriod", start: null}}
    expect(paragraphNumbers([parent, retained, retained, changed, parent, retained])).toEqual([1, 1, 2, 1, 2, 1])
    expect(paragraphNumbers([parent, retained, {...parent, marker: {kind: "number", format: "decimal", start: 4}}, retained])).toEqual([1, 1, 4, 1])
    expect(paragraphNumbers([parent, retained, body().paragraphs[0], parent])).toEqual([1, 1, null, 1])
  })
})

it("validates and detaches the complete outer text shadow contract", () => {
  const input = body(), shadow = {kind: "outer", blur: 4, distance: 12, direction: 128, scale: {x: 1, y: 0.3}, skew: {x: 21.67, y: 0}, alignment: "ctr", rotateWithShape: false, color: "#000000", opacity: 0.32} satisfies NonNullable<TextBody["paragraphs"][0]["endStyle"]["outerShadow"]>
  input.paragraphs[0].endStyle.outerShadow = shadow
  expect(parseTextBody(input)).toEqual(input)
  for (const invalid of [{blur: -1}, {distance: Infinity}, {direction: 360}, {skew: {x: 90, y: 0}}, {scale: {x: 1, y: NaN}}, {rotateWithShape: 0}, {opacity: 1.1}, {color: "black"}, {alignment: "center"}, {unknown: 1}]) {
    const value = structuredClone(input)
    Object.assign(value.paragraphs[0].endStyle.outerShadow!, invalid)
    expect(() => parseTextBody(value)).toThrow()
  }
  const parsed = parseTextBody(input)
  shadow.scale.y = 2
  expect(parsed.paragraphs[0].endStyle.outerShadow!.scale.y).toBe(0.3)
})

it("roundtrips explicit no-fill through the shared JSON body contract", () => {
  const value = body()
  value.paragraphs[0].runs[0]!.style.color = null
  value.paragraphs[0].endStyle.color = null
  expect(parseTextBody(JSON.parse(JSON.stringify(value)))).toEqual(value)
  expect(parseTextBody(body())).toEqual(body())
  const missing = JSON.parse(JSON.stringify(value))
  delete missing.paragraphs[0].endStyle.color
  expect(() => parseTextBody(missing)).toThrow()
})

it.each([
  {kind: "shrink", fontScale: null, lineReduction: null},
  {kind: "shrink", fontScale: 1, lineReduction: null},
  {kind: "shrink", fontScale: null, lineReduction: 0.125},
  {kind: "shrink", fontScale: 0.625, lineReduction: 0.2}
] satisfies TextBody["frame"]["autofit"][])("decodes saved autofit omission and preexisting numeric archives without reinterpretation: %j", autofit => {
  const value = body()
  value.frame.autofit = autofit
  expect(parseTextBody(JSON.parse(JSON.stringify(value)))).toEqual(value)
})

import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import type { PaintRun } from "./paint-text.js"

const slidePart = "ppt/slides/slide1.xml"

const rels = (type: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${type}" Target="${target}"/></Relationships>`

const sheet = (root: string, shapes: string, tail = "") =>
  `<${root}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</${root}>`

const shape = (ph: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>`

const level = (inner: string) => `<a:lvl1pPr>${inner}</a:lvl1pPr>`
const defaults = (attributes: string, inner = "") => `<a:defRPr ${attributes}>${inner}</a:defRPr>`
const solid = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`
const masterStyles =
  `<p:titleStyle>${level(defaults(`sz="4400"`))}</p:titleStyle>` +
  `<p:bodyStyle>${level(defaults(`sz="2800"`))}</p:bodyStyle>`

const runOf = (ph: string, presentationDefaults: string): PaintRun => {
  const parts = new Map<string, Uint8Array>(
    (
      [
        [
          "ppt/presentation.xml",
          `<p:presentation><p:defaultTextStyle>${presentationDefaults}</p:defaultTextStyle></p:presentation>`,
        ],
        [slidePart, sheet("p:sld", shape(ph))],
        ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/slideLayout1.xml")],
        ["ppt/slideLayouts/slideLayout1.xml", sheet("p:sldLayout", "")],
        ["ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels("slideMaster", "../slideMasters/slideMaster1.xml")],
        ["ppt/slideMasters/slideMaster1.xml", sheet("p:sldMaster", "", `<p:txStyles>${masterStyles}</p:txStyles>`)],
      ] as const
    ).map(([name, text]) => [name, encodeUtf8(text)] as const),
  )
  const run = paintReader(parts)
    .slide(slidePart)
    .elements.find((element) => element.shape === "2")?.text?.paragraphs[0]?.runs[0]
  if (run === undefined) throw new Error("no run")
  return run
}

describe("paintText and the presentation's default text style", () => {
  it.each([
    ["title", `<p:ph type="title"/>`, 44],
    ["body", `<p:ph type="body" idx="1"/>`, 28],
    ["content", `<p:ph idx="1"/>`, 28],
  ])("keeps %s placeholder text regular when only the default style makes it bold", (_, ph, size) => {
    const found = runOf(ph, level(defaults(`b="1" sz="1200"`)))
    expect([found.bold, found.size]).toEqual([false, size])
  })

  it("gives text outside a placeholder its size, bold and color", () => {
    const found = runOf("", level(defaults(`sz="1600" b="1"`, solid("000006"))))
    expect([found.size, found.bold, found.color]).toEqual([16, true, { hex: "000006", alpha: 1 }])
  })
})

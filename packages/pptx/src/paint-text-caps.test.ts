import { expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"

const title = '<p:ph type="title"/>'
const run = (text: string, format = "") => `<a:r>${format}<a:t>${text}</a:t></a:r>`
const para = (text: string) => `<a:p>${text}</a:p>`
const level = (n: number, text: string) => `<a:lvl${n}pPr>${text}</a:lvl${n}pPr>`
const defaults = (attributes: string) => `<a:defRPr ${attributes}/>`
const titleStyle = (text: string) => `<p:titleStyle>${text}</p:titleStyle>`
const shape = ({ ph = title, list = "", text = para(run("x")) } = {}) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle>${list}</a:lstStyle>${text}</p:txBody></p:sp>`
const rels = (kind: string, target: string) =>
  `<Relationships><Relationship Id="r1" Type="r/${kind}" Target="${target}"/></Relationships>`
const sheet = (kind: string, shapes: string, tail = "") =>
  `<p:${kind}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld>${tail}</p:${kind}>`

function runOf(input: { slide: string; layout?: string; styles?: string }, at = 0) {
  const xmlParts = [
    ["ppt/presentation.xml", "<p:presentation/>"],
    ["ppt/slides/slide1.xml", sheet("sld", input.slide)],
    ["ppt/slideLayouts/layout.xml", sheet("sldLayout", input.layout ?? "")],
    ["ppt/slideMasters/master.xml", sheet("sldMaster", "", `<p:txStyles>${input.styles ?? ""}</p:txStyles>`)],
    ["ppt/slides/_rels/slide1.xml.rels", rels("slideLayout", "../slideLayouts/layout.xml")],
    ["ppt/slideLayouts/_rels/layout.xml.rels", rels("slideMaster", "../slideMasters/master.xml")],
  ] as const
  const parts = new Map(xmlParts.map(([name, xml]) => [name, encodeUtf8(xml)]))
  const text = paintReader(parts)
    .slide("ppt/slides/slide1.xml")
    .elements.find((each) => each.from === "slide")?.text
  const found = text?.paragraphs[0]?.runs[at]
  if (found === undefined) throw new Error("title run missing")
  return found
}

it.each(["all", "small", "none"])("inherits %s capitals and lets a run override them", (cap) => {
  const input = {
    slide: shape({ ph: title, text: para(run("Mixed Case") + run("Keep Case", '<a:rPr cap="none"/>')) }),
    styles: titleStyle(level(1, defaults(`cap="${cap}"`))),
  }
  expect(runOf(input).caps).toBe(cap)
  expect(runOf(input, 1).caps).toBe("none")
  expect(runOf(input).text).toBe("Mixed Case")
})

it("inherits all caps from a title's layout without rewriting its words", () => {
  const input = {
    slide: shape({ ph: title, text: para(run("WFI Pupil Verification / Vignetting Check")) }),
    layout: shape({ ph: title, list: level(1, defaults('sz="4000" b="1" cap="all"')) }),
  }
  expect(runOf(input)).toMatchObject({
    caps: "all",
    size: 40,
    bold: true,
    text: "WFI Pupil Verification / Vignetting Check",
  })
})

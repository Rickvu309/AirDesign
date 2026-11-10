import { describe, expect, it } from "vitest"
import { insertChild, type ChildOf, type OrderedParent } from "./child-order.js"

const schemaOrder = {
  "p:spPr": [
    "a:xfrm",
    "a:custGeom",
    "a:prstGeom",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:ln",
    "a:effectLst",
    "a:effectDag",
    "a:scene3d",
    "a:sp3d",
    "a:extLst",
  ],
  "p:txBody": ["a:bodyPr", "a:lstStyle", "a:p"],
  "a:p": ["a:pPr", "a:r", "a:br", "a:fld", "a:endParaRPr"],
  "a:rPr": [
    "a:ln",
    "a:noFill",
    "a:solidFill",
    "a:gradFill",
    "a:blipFill",
    "a:pattFill",
    "a:grpFill",
    "a:effectLst",
    "a:effectDag",
    "a:highlight",
    "a:uLnTx",
    "a:uLn",
    "a:uFillTx",
    "a:uFill",
    "a:latin",
    "a:ea",
    "a:cs",
    "a:sym",
    "a:hlinkClick",
    "a:hlinkMouseOver",
    "a:rtl",
    "a:extLst",
  ],
} as const satisfies Record<OrderedParent, readonly string[]>

function tagsInOrder(xml: string, tags: readonly string[]): boolean {
  let cursor = 0
  for (const tag of tags) {
    const at = xml.indexOf(`<${tag}`, cursor)
    if (at < 0) return false
    cursor = at + tag.length
  }
  return true
}

describe("insertChild", () => {
  it("puts a run after a:pPr and before a:endParaRPr", () => {
    const paragraph = `<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US"/></a:p>`
    const run = `<a:r><a:t>Tiếng Việt &amp; &lt; &gt; 日本語</a:t></a:r>`
    expect(insertChild("a:p", "a:r", run, paragraph)).toBe(
      `<a:p><a:pPr algn="ctr"/>${run}<a:endParaRPr lang="en-US"/></a:p>`,
    )
  })

  it("puts a:pPr first when a run is already there", () => {
    const paragraph = `<a:p><a:r><a:t>Hi</a:t></a:r><a:endParaRPr/></a:p>`
    expect(insertChild("a:p", "a:pPr", `<a:pPr algn="ctr"/>`, paragraph)).toBe(
      `<a:p><a:pPr algn="ctr"/><a:r><a:t>Hi</a:t></a:r><a:endParaRPr/></a:p>`,
    )
  })

  it("puts another run after the existing run", () => {
    let paragraph = `<a:p></a:p>`
    for (const tag of [...schemaOrder["a:p"]].reverse()) {
      paragraph = insertChild("a:p", tag, `<${tag}/>`, paragraph)
    }
    paragraph = insertChild("a:p", "a:r", `<a:r id="2"/>`, paragraph)
    expect(paragraph.indexOf("<a:r/>")).toBeLessThan(paragraph.indexOf('<a:r id="2"/>'))
    expect(paragraph.indexOf('<a:r id="2"/>')).toBeLessThan(paragraph.indexOf("<a:br"))
  })

  it("puts a:latin before a:ea", () => {
    let xml = "<a:rPr></a:rPr>"
    xml = insertChild("a:rPr", "a:ea", "<a:ea/>", xml)
    xml = insertChild("a:rPr", "a:latin", "<a:latin/>", xml)
    expect(xml.indexOf("<a:latin")).toBeLessThan(xml.indexOf("<a:ea"))
  })

  it("orders every child from the schema when inserts arrive backwards", () => {
    const parents = Object.keys(schemaOrder) as OrderedParent[]
    for (const parent of parents) {
      const tags = schemaOrder[parent]
      let xml = `<${parent}></${parent}>`
      for (let index = tags.length - 1; index >= 0; index -= 1) {
        const tag = tags[index]
        if (tag === undefined) throw new Error(parent)
        xml = insertChild(parent, tag as ChildOf<typeof parent>, `<${tag}/>`, xml)
      }
      expect(tagsInOrder(xml, tags), parent).toBe(true)
    }
  })

  it("rejects an element whose root is not the requested tag", () => {
    expect(() => insertChild("a:p", "a:r", "<a:t/>", "<a:p></a:p>")).toThrow(/a:r/)
  })
})

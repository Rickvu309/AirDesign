import { describe, expect, it } from "vitest"
import { childOrder, insertChild, type OrderedParent } from "./child-order.js"

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
    for (const tag of [...childOrder["a:p"]].reverse()) {
      paragraph = insertChild("a:p", tag, `<${tag}/>`, paragraph)
    }
    paragraph = insertChild("a:p", "a:r", `<a:r id="2"/>`, paragraph)
    const first = paragraph.indexOf("<a:r")
    const second = paragraph.indexOf("<a:r", first + 1)
    const breakAt = paragraph.indexOf("<a:br")
    expect(second).toBeGreaterThan(first)
    expect(second).toBeLessThan(breakAt)
  })

  it("orders every child from the table when inserts arrive backwards", () => {
    const parents = Object.keys(childOrder) as OrderedParent[]
    for (const parent of parents) {
      const tags = childOrder[parent]
      let xml = `<${parent}></${parent}>`
      for (let index = tags.length - 1; index >= 0; index -= 1) {
        const tag = tags[index]
        if (tag === undefined) throw new Error(parent)
        xml = insertChild(parent, tag, `<${tag}/>`, xml)
      }
      expect(tagsInOrder(xml, tags), parent).toBe(true)
    }
  })

  it("rejects an element whose root is not the requested tag", () => {
    expect(() => insertChild("a:p", "a:r", "<a:t/>", "<a:p></a:p>")).toThrow(/a:r/)
  })
})

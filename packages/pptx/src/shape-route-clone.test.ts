import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { cloneShape } from "./shape-route.js"

const shape = (id: number) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>`
const connector = (id: number, start: number, end: number) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="c${id}"/><p:cNvCxnSpPr><a:stCxn id="${start}" idx="0"/><a:endCxn id="${end}" idx="2"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr/></p:cxnSp>`
const grouped = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(11)}${shape(12)}${connector(13, 11, 4)}</p:grpSp>`
const slide = `<p:sld><p:cSld><p:spTree>${shape(4)}${grouped}</p:spTree></p:cSld></p:sld>`

describe("a copied group's shapes", () => {
  it("take the ids the copy names, and a connector inside connects to the copies while one outside stays", () => {
    const ids = new Map([
      ["11", 21],
      ["12", 22],
      ["13", 23],
    ])
    const copied = decodeUtf8(cloneShape(encodeUtf8(slide), "10", 20, ids))
    const copy = copied.slice(copied.lastIndexOf("<p:grpSp>"))
    expect(copy).toContain('<p:cNvPr id="20" name="g"/>')
    for (const id of [21, 22, 23]) expect(copy).toContain(`<p:cNvPr id="${id}"`)
    expect(copy).toContain('<a:stCxn id="21" idx="0"/><a:endCxn id="4" idx="2"/>')
    expect(copied.slice(0, copied.lastIndexOf("<p:grpSp>"))).toBe(`<p:sld><p:cSld><p:spTree>${shape(4)}${grouped}`)
  })
})

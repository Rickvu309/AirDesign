import {describe, expect, it} from "vitest"
import {id} from "../../../deck/src/model.ts"
import {decodeLegacyRunsV2} from "../../../deck/src/text/legacy-v2.ts"
import {expandTextBodyReplacement, materializeTextBody, textBodyNodes} from "../../src/text/body-nodes.ts"
import {allocateTextLifetimeIds, type TextLifetimeInput} from "../../src/text/migration-ids.ts"

function body() { return decodeLegacyRunsV2([{text: "one", font: "Geist", size: 12, color: "black", bold: false}], id("f"), id("p")) }
describe("addressable text nodes", () => {
  it("roundtrips internal nodes without slide Elements", () => {
    expect(materializeTextBody(id("e"), textBodyNodes(id("e"), body()))).toEqual(body())
  })
  it("expands whole-body replacements to protected child properties", () => {
    const before = body(), after = body()
    after.paragraphs[0].alignment = "center"
    const input = {element: id("e"), before, after, historicalUsedIds: [], base: 2, heads: [], adopts: true}
    expect(expandTextBodyReplacement(input).map(patch => [patch.id, patch.keys])).toEqual([[id("p"), ["alignment"]]])
    expect(() => expandTextBodyReplacement({...input, heads: [{target: id("p"), key: "alignment", seq: 3}]})).toThrow("stale-base")
    expect(expandTextBodyReplacement({...input, heads: [{target: id("p"), key: "runs", seq: 3}]})).toHaveLength(1)
  })
  it("keeps distinct paragraph edits independent", () => {
    const before = body(); before.paragraphs.push({...before.paragraphs[0], id: id("q")})
    const after = structuredClone(before); after.paragraphs[1]!.alignment = "right"
    expect(expandTextBodyReplacement({element: id("e"), before, after, historicalUsedIds: [], base: 0, heads: [{target: id("p"), key: "alignment", seq: 5}], adopts: false}).map(patch => patch.id)).toEqual([id("q")])
  })
  it("makes split, reorder, and merge one validated topology delta", () => {
    const before = body(), split = body()
    split.paragraphs.push({...split.paragraphs[0], id: id("q"), runs: []})
    const input = {element: id("e"), before, after: split, historicalUsedIds: [id("f"), id("p")], base: 0, heads: [], adopts: true}
    expect(expandTextBodyReplacement(input).map(patch => patch.keys)).toEqual([["existence"]])
    const reordered = structuredClone(split)
    reordered.paragraphs.reverse()
    expect(expandTextBodyReplacement({...input, before: split, after: reordered}).map(patch => patch.keys)).toEqual([["order"], ["order"]])
    expect(expandTextBodyReplacement({...input, before: split, after: before})[0]?.after).toBeNull()
    expect(() => expandTextBodyReplacement({...input, historicalUsedIds: [id("q")]})).toThrow("node-id-reused")
    const invalid = structuredClone(split); Object.assign(invalid, {paragraphs: []})
    expect(() => expandTextBodyReplacement({...input, after: invalid})).toThrow()
    expect(before.paragraphs).toHaveLength(1)
  })
  it("refuses frame replacement, element shadowing, malformed orders and wrong parents", () => {
    const before = body(), after = body(); after.frame.id = id("g")
    expect(() => expandTextBodyReplacement({element: id("e"), before, after, historicalUsedIds: [], base: 0, heads: [], adopts: true})).toThrow("frame-identity")
    for (const mutate of [(nodes: ReturnType<typeof textBodyNodes>) => { nodes[0]!.parent = id("other") }, (nodes: ReturnType<typeof textBodyNodes>) => { nodes[1]!.order = 0 }]) {
      const nodes = textBodyNodes(id("e"), before); mutate(nodes)
      expect(() => materializeTextBody(id("e"), nodes)).toThrow()
    }
  })
})
describe("deterministic lifetime allocation", () => {
  const initial: TextLifetimeInput = {deck: id("deck"), element: id("e"), lifetime: {kind: "initial"}}
  const later: TextLifetimeInput = {...initial, lifetime: {kind: "contribution", command: "convert-back"}}
  it("is order independent and gives a new lifetime fresh identities", () => {
    const allocated = allocateTextLifetimeIds([initial, later], [])
    expect(allocated).toEqual(allocateTextLifetimeIds([later, initial], []))
    expect(new Set(allocated.flatMap(value => [value.frame, value.paragraph])).size).toBe(4)
  })
  it("reserves historical IDs including inactive/deleted identities and resolves collisions", () => {
    const first = allocateTextLifetimeIds([initial], [])[0]!
    const reserved = [first.frame, first.paragraph, id("inactive"), id("removed")]
    const next = allocateTextLifetimeIds([initial], reserved)[0]!
    expect(reserved).not.toContain(next.frame)
    expect(reserved).not.toContain(next.paragraph)
    expect(allocateTextLifetimeIds([initial], reserved)).toEqual([next])
  })
  it("rejects duplicate lifetime origins", () => {
    expect(() => allocateTextLifetimeIds([initial, initial], [])).toThrow("duplicate-text-lifetime")
  })
})

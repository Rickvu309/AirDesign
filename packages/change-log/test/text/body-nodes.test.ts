import {describe, expect, it} from "vitest"
import {id} from "../../../deck/src/model.ts"
import {decodeLegacyRunsV2} from "../../../deck/src/text/legacy-v2.ts"
import {materializeTextBody, textBodyNodes} from "../../src/text/body-nodes.ts"
import {allocateTextLifetimeIds, type TextLifetimeInput} from "../../src/text/migration-ids.ts"

function body() { return decodeLegacyRunsV2([{text: "one", font: "Geist", size: 12, color: "black", bold: false}], id("f"), id("p")) }
describe("addressable text nodes", () => {
  it("roundtrips internal nodes without slide Elements", () => {
    expect(materializeTextBody(id("e"), textBodyNodes(id("e"), body()))).toEqual(body())
  })
  it("refuses malformed orders and wrong parents", () => {
    const before=body()
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

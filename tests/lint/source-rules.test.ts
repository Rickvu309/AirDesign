import assert from "node:assert/strict"
import { describe, it } from "vitest"
import { commentHits } from "../../scripts/lint/comment-rule.ts"
import { importBoundaryHits } from "../../scripts/lint/import-boundary.ts"
import { responseHeaderHits } from "../../scripts/lint/response-headers.ts"

describe("comment rule", () => {
  it("rejects a line comment and a suppression comment and accepts the same code without them", () => {
    const good = "export const value = 1\n"
    const lineComment = `${good}${"/".repeat(2)} kept by mistake\n`
    const suppression = `${good}${"/"}${"*"} oxlint-disable next-line ${"*".slice(0, 0)}${"*"}${"/"}\n`
    const block = `export const value = 1 ${"/"}${"*"} oxlint-disable ${"*".slice(0)}${"/"}\n`
    assert.equal(commentHits("good.ts", good).length, 0)
    assert.equal(commentHits("bad.ts", lineComment).length, 1)
    assert.ok(commentHits("bad.ts", suppression).length >= 1)
    assert.ok(commentHits("bad.ts", block).length >= 1)
  })

  it("accepts comment markers that live inside a string", () => {
    const source = 'export const url = "https://example.test/a"\n'
    assert.deepEqual(commentHits("url.ts", source), [])
  })

  it("rejects a jsx comment", () => {
    const source = `export function View() {\n  return <div>{${"/"}${"*"} hint ${"*"}${"/"}}</div>\n}\n`
    assert.ok(commentHits("view.tsx", source).length >= 1)
  })
})

describe("import boundaries", () => {
  it("rejects a package that imports an app and accepts a relative import inside the package", () => {
    const root = "/repo"
    const file = "/repo/packages/ui/src/button/button.tsx"
    const bad = 'import { Shell } from "../../apps/studio/src/main"\n'
    const good = 'import { copy } from "../copy/read-copy"\n'
    assert.equal(importBoundaryHits(file, bad, root).length, 1)
    assert.equal(importBoundaryHits(file, good, root).length, 0)
  })

  it("rejects studio importing the access server entry", () => {
    const hits = importBoundaryHits("/repo/apps/studio/src/main.tsx", 'import { start } from "@airdesign/access"\n', "/repo")
    assert.equal(hits[0]?.reason, "studio-imports-access-server")
  })

  it("accepts studio importing the access client", () => {
    const hits = importBoundaryHits("/repo/apps/studio/src/main.tsx", 'import { createAccessClient } from "@airdesign/access/client"\n', "/repo")
    assert.equal(hits.length, 0)
  })
})

describe("response headers", () => {
  it("rejects appending a header after the response is started and accepts cookies on writeHead", () => {
    const call = "." + "append" + "Header"
    const bad = `response.writeHead(200)\nresponse${call}("set-cookie", cookie)\n`
    const good = "response.writeHead(200, { \"set-cookie\": [cookie] })\n"
    assert.equal(responseHeaderHits(bad)[0]?.reason, "append-header-after-send")
    assert.deepEqual(responseHeaderHits(good), [])
  })
})

import { operationSafetyHits } from "../../scripts/lint/operation-safety.ts"
import assert from "node:assert/strict"
import { describe, it } from "vitest"
import { commentHits } from "../../scripts/lint/comment-rule.ts"
import { importBoundaryHits } from "../../scripts/lint/import-boundary.ts"
import { accessSafetyHits } from "../../scripts/lint/access-safety.ts"
import { gateRecordingHits } from "../../scripts/lint/gate-recording.ts"
import { responseHeaderHits } from "../../scripts/lint/response-headers.ts"

describe("comment rule", () => {
  it("accepts escaped slashes in regex literals and still rejects the following comment", () => {
    const expression = "const match = /" + "\\/" + "/.test(value)"
    assert.deepEqual(commentHits("regex.ts", expression), [])
    assert.equal(commentHits("regex.ts", expression + "\n" + "/".repeat(2) + " forbidden").length, 1)
  })

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

describe("access safety", () => {
  it("rejects a hardcoded insecure cookie and accepts a derived secure flag", () => {
    const bad = "advanced: { " + "useSecureCookies:" + " false },\n"
    const good = "advanced: { " + "useSecureCookies:" + " secure },\n"
    assert.equal(accessSafetyHits("packages/access/src/create-access.ts", bad)[0]?.reason, "secure-cookies-hardcoded-off")
    assert.deepEqual(accessSafetyHits("packages/access/src/create-access.ts", good), [])
  })

  it("rejects a bare path decode outside the safe helper and accepts the helper", () => {
    const call = "decodeURI" + "Component(" + "segment)"
    const bad = `const personId = ${call}\n`
    const helper = `export function decodePathSegment(value: string): string | null {\n  try {\n    return ${call}\n  } catch {\n    return null\n  }\n}\n`
    assert.equal(accessSafetyHits("packages/access/src/create-access.ts", bad)[0]?.reason, "unsafe-path-decode")
    assert.deepEqual(accessSafetyHits("packages/access/src/decode-path-segment.ts", helper), [])
  })

  it("rejects dropping a schema outside the disposable helper", () => {
    const statement = "DROP " + "SCHEMA"
    const bad = `await pool.query(\`${statement} IF EXISTS "\${schemaName}" CASCADE\`)\n`
    const helper = `return \`${statement} IF EXISTS "\${schemaName}" CASCADE\`\n`
    assert.equal(accessSafetyHits("packages/access/src/create-access.ts", bad)[0]?.reason, "drop-schema-outside-disposable")
    assert.deepEqual(accessSafetyHits("packages/access/src/disposable-schema.ts", helper), [])
  })

  it("rejects a discarded request promise and accepts a caught handler", () => {
    const bad = "  void " + "serve(access, request, response)\n"
    const good = "  serve(access, request, response).catch((error: unknown) => writeHandlerError(response, error))\n"
    assert.equal(accessSafetyHits("apps/server/src/main.ts", bad)[0]?.reason, "discarded-request")
    assert.deepEqual(accessSafetyHits("apps/server/src/main.ts", good), [])
  })
})

describe("gate recording", () => {
  it("rejects a video recording in a gate test and accepts the evidence script", () => {
    const verb = ["rec", "ord"].join("")
    const action = ["sta", "rt"].join("")
    const extension = ["web", "m"].join("")
    const bad = `await browser(["${verb}", "${action}", "sign-in.${extension}"])\n`
    const good = "await browser([\"reload\"])\n"
    const testFile = "apps/studio/src/access/link-route.browser.test.ts"
    const evidence = "scripts/evidence/record-sign-in.ts"
    assert.equal(gateRecordingHits(testFile, bad)[0]?.reason, "video-recorded-in-gate")
    assert.deepEqual(gateRecordingHits(testFile, good), [])
    assert.deepEqual(gateRecordingHits(evidence, bad), [])
    assert.deepEqual(gateRecordingHits("scripts/verify-access.mjs", bad)[0]?.reason, "video-recorded-in-gate")
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

it("rejects the original unbounded API body collector and accepts the bounded adapter", () => {
  const original = 'request.on("data", (chunk) => chunks.push(chunk))'
  assert.equal(operationSafetyHits("apps/server/src/main.ts",original)[0]?.reason,"unbounded-request-stream-use-readRequestBody")
  assert.deepEqual(operationSafetyHits("apps/server/src/main.ts","const body = await readRequestBody(request)"),[])
})

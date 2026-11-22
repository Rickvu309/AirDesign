import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-http-outside-server": "error" }
const message = "Open a server only in apps/api/src/server.ts"
const source = "apps/api/src/second.ts"
const named = `import { createServer } from "node:http"\nexport const open = () => createServer()\n`

expectRejects("a named import fails", source, named, rule, message)
expectRejects(
  "the verifier's default import of http fails",
  source,
  `import http from "node:http"\nexport const open = () => http.createServer()\n`,
  rule,
  message,
)
expectRejects(
  "the verifier's import without the prefix fails",
  source,
  `import { createServer } from "http"\nexport const open = () => createServer()\n`,
  rule,
  message,
)
expectRejects(
  "the verifier's node:https server fails",
  source,
  `import https from "node:https"\nexport const open = () => https.createServer()\n`,
  rule,
  message,
)
expectRejects("https without the prefix fails", source, `import https from "https"\n`, rule, message)
expectRejects("the verifier's subfolder fails", "apps/api/src/deep/second.ts", named, rule, message)
expectRejects("a server.ts in a subfolder fails", "apps/api/src/deep/server.ts", named, rule, message)
expectRejects(
  "the verifier's second server in a file a route calls fails",
  "apps/api/src/route-extra.ts",
  `import * as http from "node:http"\nexport const extra = () => http.createServer(() => undefined).listen(0)\n`,
  rule,
  message,
)
expectRejects("a re-export fails", source, `export { createServer } from "node:http"\n`, rule, message)
expectRejects("an export all fails", source, `export * from "node:http"\n`, rule, message)
expectRejects("an import equals fails", source, `import http = require("node:http")\n`, rule, message)
expectRejects("a dynamic import fails", source, `export const http = await import("node:http")\n`, rule, message)
expectRejects(
  "a dynamic import of a String(url) fails",
  source,
  `export const load = (url) => import(String(url))\n`,
  rule,
  message,
)
expectRejects("a require fails", source, `export const http = require("http")\n`, rule, message)
expectRejects(
  "a built-in lookup fails",
  source,
  `export const http = process.getBuiltinModule("node:http")\n`,
  rule,
  message,
)
expectRejects(
  "the harness may not open a server",
  "apps/api/src/testing/harness.ts",
  `import { createServer, request } from "node:http"\n`,
  rule,
  message,
)
expectRejects(
  "the harness may not take the whole module",
  "apps/api/src/testing/harness.ts",
  `import http from "http"\n`,
  rule,
  message,
)
expectAccepts("server.ts may open a server", "apps/api/src/server.ts", named, rule)
expectAccepts(
  "the harness may import request",
  "apps/api/src/testing/harness.ts",
  `import { request, type IncomingHttpHeaders, type Server } from "node:http"\n`,
  rule,
)
expectAccepts(
  "import type stays",
  "apps/api/src/mcp/mcp.ts",
  `import type { IncomingMessage } from "node:http"\n`,
  rule,
)
expectAccepts("inline types stay", source, `import { type IncomingMessage } from "node:http"\n`, rule)
expectAccepts(
  "createServer from another module stays",
  "apps/api/src/mcp/mcp.ts",
  `import { createServer } from "@airdesign/mcp"\nexport const open = () => createServer()\n`,
  rule,
)
expectAccepts(
  "node:net stays",
  "apps/api/src/testing/postgres-setup.ts",
  `import { createServer } from "node:net"\nexport const open = () => createServer()\n`,
  rule,
)
expectAccepts("a literal dynamic import stays", source, `export const pg = await import("pg")\n`, rule)
expectAccepts("another package stays out of scope", "apps/web/src/second.ts", named, rule)
expectAccepts("a test file is out of scope", "apps/api/src/second.test.ts", named, rule)

expectAccepts(
  "the agent image fetch may send a request",
  "apps/api/src/platform/image-fetch.ts",
  `import { request } from "node:https"\nexport const get = (url) => request(url)\n`,
  rule,
)
expectRejects(
  "the agent image fetch may not open a server",
  "apps/api/src/platform/image-fetch.ts",
  `import { createServer } from "node:https"\nexport const open = () => createServer()\n`,
  rule,
  message,
)

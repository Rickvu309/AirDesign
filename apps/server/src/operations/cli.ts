import { readFile, writeFile } from "node:fs/promises"
import { requireLocalUpload } from "../../../../packages/files/src/index.ts"
const [command, origin, cookiePath, argument, requestId] = process.argv.slice(2)
if (!origin || !cookiePath || !["submit","status","cancel","artifact"].includes(command ?? "") || !argument) throw new Error("usage: submit|status|cancel|artifact origin cookie-file input-or-id [request-id-or-output]")
const base = new URL(origin)
if (base.pathname !== "/" || base.username || base.password || base.search || base.hash) throw new Error("origin-required")
const cookie = (await readFile(cookiePath,"utf8")).trim()
let body: string | undefined
let route = `/api/operations/${encodeURIComponent(argument)}`
if (command === "submit") {
  const upload = { requestId, base64: (await readFile(argument)).toString("base64") }
  requireLocalUpload(upload)
  body = JSON.stringify(upload)
  route = "/api/operations"
}
if (command === "cancel") { body = "{}"; route += "/cancel" }
if (command === "artifact") route += "/artifact"
const response = await fetch(new URL(route,base), { method: body ? "POST" : "GET", headers: { cookie, origin: base.origin, "content-type": "application/json" }, body, redirect: "error" })
if (command === "artifact" && response.ok) {
  if (!requestId) throw new Error("artifact-output-path-required")
  const bytes = Buffer.from(await response.arrayBuffer())
  await writeFile(requestId,bytes,{ mode: 0o600 })
  process.stdout.write(JSON.stringify({ status: response.status, bytes: bytes.length, output: requestId }) + "\n")
} else process.stdout.write(JSON.stringify({ status: response.status, body: await response.json() }) + "\n")
if (!response.ok) process.exitCode = 1

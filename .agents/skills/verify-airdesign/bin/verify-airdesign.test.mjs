import { execFile, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, it } from "vitest"

const cli = fileURLToPath(new URL("./verify-airdesign.mjs", import.meta.url))
const runCli = promisify(execFile)

it("posts an empty JSON object when api takes a cookie without a body", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "verify-cli-"))
  const catalog = path.join(home, "packages/catalog")
  const scratch = path.join(home, "tmp/verify-airdesign-scratch/test-run")
  const evidence = path.join(home, "tmp/verify-airdesign/test-run")
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    response.end(JSON.stringify({ cookie: request.headers.cookie, body: JSON.parse(Buffer.concat(chunks)) }))
  })
  try {
    for (const dir of [catalog, scratch, evidence]) mkdirSync(dir, { recursive: true })
    writeFileSync(
      path.join(catalog, "package.json"),
      JSON.stringify({ name: "@airdesign/catalog", exports: { ".": { import: "./index.mjs" } } }),
    )
    writeFileSync(path.join(catalog, "index.mjs"), 'export const deckRoutes = { list: { path: "/list" } }')
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    writeFileSync(
      path.join(scratch, "state.json"),
      JSON.stringify({ origin: `http://127.0.0.1:${server.address().port}` }),
    )
    const { stdout } = await runCli(process.execPath, [cli, "api", "test-run", "list", "--cookie", "session=test"], {
      env: { ...process.env, HOME: home, VERIFY_AIRDESIGN_REPO: home },
    })
    const { status, file } = JSON.parse(stdout)
    expect(status).toBe(200)
    expect(JSON.parse(readFileSync(file, "utf8")).json).toEqual({ cookie: "session=test", body: {} })
  } finally {
    server.close()
    rmSync(home, { recursive: true, force: true })
  }
})

it("rejects an unknown command and writes usage to stderr", () => {
  const result = spawnSync(process.execPath, [cli, "unknown"], { encoding: "utf8" })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe("")
  expect(result.stderr).toContain("verify-airdesign launch")
})

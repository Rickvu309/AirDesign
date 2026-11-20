import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import config from "../playwright.config.ts"
import {
  previewOrigin,
  previewPortLine,
  previewPortName,
  previewPortPattern,
  startingPort,
} from "../tests/browser/preview-port.ts"
import { startPreview } from "../tests/browser/preview-server.mjs"

const hold = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => resolve(server))
  })

const release = (server) => new Promise((resolve) => server.close(resolve))

const checkout = path.join(os.tmpdir(), "a-worktree")
const hashed = startingPort(checkout, {})
assert.equal(startingPort(checkout, {}), hashed, "the same checkout starts at the same port")
assert.ok(hashed >= 4400 && hashed < 5000, "the hashed start stays in 4400 to 4999")
assert.notEqual(startingPort(`${checkout}-other`, {}), undefined)
assert.equal(startingPort(checkout, { AIRDESIGN_PORT: "4485" }), 4485, "AIRDESIGN_PORT picks the starting port")
assert.equal(startingPort(checkout, { AIRDESIGN_PORT: "nope" }), hashed, "a bad AIRDESIGN_PORT falls back to the hash")
assert.equal(startingPort(checkout, { AIRDESIGN_PORT: "70000" }), hashed, "a port past 65535 falls back to the hash")

assert.equal(previewOrigin({}), undefined, "no origin before the server reports its port")
assert.equal(previewOrigin({ [previewPortName]: "4490" }), "http://127.0.0.1:4490")
assert.equal(previewPortPattern.exec(previewPortLine(4490)).groups[previewPortName.toLowerCase()], "4490")

const webServer = [config.webServer].flat()[0]
assert.equal(webServer.url, undefined, "the config names no fixed url for the server")
assert.equal(webServer.port, undefined, "the config names no fixed port for the server")
assert.ok(webServer.wait?.stdout instanceof RegExp, "the config waits for the port the server prints")
assert.deepEqual(Object.keys(previewPortPattern.exec(previewPortLine(1)).groups), [previewPortName.toLowerCase()])
assert.equal(
  webServer.wait.stdout.source,
  previewPortPattern.source,
  "the config reads the same line the server prints",
)

const root = mkdtempSync(path.join(os.tmpdir(), "preview-port-"))
mkdirSync(path.join(root, "dist"))
writeFileSync(path.join(root, "dist/index.html"), "<!doctype html><title>held</title>")
const holders = []
const previews = []
try {
  const start = 4800 + Math.floor(Math.random() * 100)
  holders.push(await hold(start))
  const second = await startPreview({ root, start })
  previews.push(second)
  assert.equal(second.port, start + 1, "a held start port moves the server to the next free one")
  assert.equal((await fetch(`http://127.0.0.1:${String(second.port)}/`)).status, 200)

  holders.push(await hold(start + 2))
  const third = await startPreview({ root, start })
  previews.push(third)
  assert.equal(third.port, start + 3, "the walk goes past every held port")

  const same = await Promise.all([startPreview({ root, start: start + 10 }), startPreview({ root, start: start + 10 })])
  previews.push(...same)
  assert.notEqual(same[0].port, same[1].port, "two servers started together never share a port")
  assert.deepEqual(
    [...same.map((preview) => preview.port)].sort(),
    [start + 10, start + 11],
    "two servers started together take the start port and the next one",
  )
} finally {
  await Promise.all(previews.map((preview) => preview.close()))
  await Promise.all(holders.map(release))
  rmSync(root, { recursive: true, force: true })
}

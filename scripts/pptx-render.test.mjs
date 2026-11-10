import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  committedBlobs,
  gitBlobId,
  readMachine,
  readRender,
  renderCache,
  renderCode,
  renderKey,
  renderName,
  renderSettings,
  renderUse,
  toolVersion,
  writeRender,
} from "./pptx-render.mjs"

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-render-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))

const fail = (message) => {
  throw new Error(message)
}
const same = (left, right, message) => {
  if (JSON.stringify(left) !== JSON.stringify(right))
    fail(`${message}: ${JSON.stringify(left)} ${JSON.stringify(right)}`)
}

const deck = Buffer.from("original deck bytes")
const machine = {
  soffice: "LibreOffice 24.2.7.2 420(Build:2)",
  pdftoppm: "pdftoppm version 24.02.0",
  imageOs: "ubuntu24",
  imageVersion: "20261102.1.0",
}
const code = "render code"
const base = { deck, machine, settings: renderSettings, code }
const key = renderKey(base)
const pageA = "a".repeat(64)
const pageB = "b".repeat(64)

const changed = (label, input) => {
  if (renderKey({ ...base, ...input }) === key) fail(`the key ignores ${label}`)
}
changed("the deck bytes", { deck: Buffer.from("original deck bytez") })
changed("the LibreOffice version", { machine: { ...machine, soffice: "LibreOffice 24.2.7.3 420(Build:3)" } })
changed("the pdftoppm version", { machine: { ...machine, pdftoppm: "pdftoppm version 24.02.1" } })
changed("the runner image", { machine: { ...machine, imageOs: "ubuntu22" } })
changed("the runner image version", { machine: { ...machine, imageVersion: "20261109.2.0" } })

const outside = await readMachine({
  soffice: "no-such-soffice",
  pdftoppm: "no-such-pdftoppm",
  env: { ImageOS: "ubuntu24", ImageVersion: "" },
})
same(
  outside,
  { imageOs: "ubuntu24", imageVersion: null, soffice: null, pdftoppm: null },
  "the machine outside a runner",
)
same(
  (await readMachine({ soffice: "no-such-soffice", pdftoppm: "no-such-pdftoppm", env: { ImageVersion: "1" } })).imageOs,
  null,
  "an unset ImageOS is an image",
)
for (const blank of [" ", "\t", "\n"]) {
  const machine = await readMachine({
    soffice: "no-such-soffice",
    pdftoppm: "no-such-pdftoppm",
    env: { ImageOS: blank, ImageVersion: blank },
  })
  same(
    [machine.imageOs, machine.imageVersion],
    [null, null],
    `a blank image identity ${JSON.stringify(blank)} is not an image`,
  )
}
changed("the render code", { code: "render code changed" })
for (const tool of ["soffice", "pdftoppm"]) {
  renderSettings[tool].forEach((_, index) => {
    const args = renderSettings[tool].map((arg, at) => (at === index ? `${arg}x` : arg))
    changed(`${tool} argument ${index}`, { settings: { ...renderSettings, [tool]: args } })
  })
  changed(`an added ${tool} argument`, { settings: { ...renderSettings, [tool]: [...renderSettings[tool], "-f"] } })
}
same(renderKey({ ...base, deck: Buffer.from(deck) }), key, "the key is not stable")

const self = fs.readFileSync(fileURLToPath(new URL("./pptx-render.mjs", import.meta.url)))
same(renderCode(), createHash("sha256").update(self).digest("hex"), "the render code hash is not the module bytes")

same(
  toolVersion("javaldx: no Java\nLibreOffice 24.2.7.2 420(Build:2)\n"),
  "LibreOffice 24.2.7.2 420(Build:2)",
  "soffice",
)
same(toolVersion("pdftoppm version 24.02.0\nCopyright 2005-2024\n"), "pdftoppm version 24.02.0", "pdftoppm")
same(toolVersion("command not found\n"), null, "a missing tool has a version")

const committed = committedBlobs(
  `100644 blob ${gitBlobId(deck)}\tscripts/pptx-fixtures/clean.pptx\n100644 blob ${"0".repeat(40)}\tscripts/pptx-fixtures/text.pptx\n`,
)
same(renderUse({ render: "clean.pptx", bytes: deck, committed }), "cached", "a committed original is not cached")
same(renderUse({ render: "clean.pptx again", bytes: deck, committed }), "fresh", "a second render is cached")
same(renderUse({ render: "text.pptx", bytes: deck, committed }), "fresh", "a changed original is cached")
same(renderUse({ render: "exported-deck.pptx", bytes: deck, committed }), "fresh", "an export is cached")
same(renderUse({ render: "route-1.pptx", bytes: deck, committed }), "fresh", "a route file is cached")

same(renderName("clean.pptx again"), "clean.pptx", "the second render names another deck")

const fakeRender = (hashes) => {
  const calls = []
  return {
    calls,
    render: async (file) => {
      calls.push(file)
      return hashes
    },
  }
}
const cacheWith = (render, input = {}) =>
  renderCache({ folder, machine, settings: renderSettings, code, render, ...input })

const first = fakeRender([pageA, pageB])
const cold = cacheWith(first.render)
same(await cold.pages({ file: "clean.pptx", bytes: deck, use: "cached" }), [pageA, pageB], "a miss lost the render")
same(first.calls.length, 1, "a miss did not render")
same(readRender(folder, key), [pageA, pageB], "a miss did not store the hashes")

const second = fakeRender([pageB])
const warm = cacheWith(second.render)
same(await warm.pages({ file: "clean.pptx", bytes: deck, use: "cached" }), [pageA, pageB], "a hit changed the hashes")
same(second.calls.length, 0, "a hit rendered")
same(warm.tally.hits, 1, "a hit was not counted")

for (const render of ["clean.pptx again", "exported-deck.pptx"]) {
  const again = fakeRender([pageB])
  const guarded = cacheWith(again.render)
  const use = renderUse({ render, bytes: deck, committed })
  same(await guarded.pages({ file: render, bytes: deck, use }), [pageB], `${render} read the cache`)
  same(again.calls.length, 1, `${render} did not render`)
  same(guarded.tally.uncached, 1, `${render} was not counted as uncached`)
}
same(readRender(folder, key), [pageA, pageB], "an uncached render wrote the cache")

const off = fakeRender([pageB])
const versionless = cacheWith(off.render, { machine: { ...machine, pdftoppm: null } })
same(await versionless.pages({ file: "clean.pptx", bytes: deck, use: "cached" }), [pageB], "no version still cached")
same(versionless.tally.uncached, 1, "no version still read the cache")
same(off.calls.length, 1, "no version did not render")
if (!versionless.line().startsWith("render cache off: no pdftoppm version,")) fail(versionless.line())

for (const unset of ["imageOs", "imageVersion"]) {
  const local = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-render-local-"))
  const plain = { ...machine, [unset]: null }
  const planted = path.join(local, `${renderKey({ deck, machine: plain, settings: renderSettings, code })}.json`)
  writeRender(local, path.basename(planted, ".json"), [pageA])
  const before = fs.readdirSync(local).map((name) => [name, fs.readFileSync(path.join(local, name), "utf8")])
  const touched = []
  const spied = ["readFileSync", "writeFileSync", "renameSync", "mkdirSync", "existsSync"].map((name) => [
    name,
    fs[name],
  ])
  for (const [name, original] of spied) {
    fs[name] = (file, ...rest) => {
      if (String(file).startsWith(local)) touched.push(`${name} ${path.basename(String(file))}`)
      return original(file, ...rest)
    }
  }
  const outsideRender = fakeRender([pageB])
  const unimaged = renderCache({
    folder: local,
    machine: plain,
    settings: renderSettings,
    code,
    render: outsideRender.render,
  })
  try {
    same(
      await unimaged.pages({ file: "clean.pptx", bytes: deck, use: "cached" }),
      [pageB],
      `no ${unset} read the cache`,
    )
  } finally {
    for (const [name, original] of spied) fs[name] = original
  }
  same(touched, [], `no ${unset} touched the cache folder`)
  same(outsideRender.calls.length, 1, `no ${unset} did not render`)
  same(unimaged.tally.uncached, 1, `no ${unset} was not counted as uncached`)
  same(
    fs.readdirSync(local).map((name) => [name, fs.readFileSync(path.join(local, name), "utf8")]),
    before,
    `no ${unset} changed the cache folder`,
  )
  if (!unimaged.line().startsWith("render cache off: not a runner image,")) fail(unimaged.line())
  fs.rmSync(local, { recursive: true, force: true })
}

const entry = path.join(folder, `${key}.json`)
for (const [label, text] of [
  ["torn json", '{"key":"'],
  ["another key", JSON.stringify({ key: "0".repeat(64), hashes: [pageA] })],
  ["no hashes", JSON.stringify({ key, hashes: [] })],
  ["a short hash", JSON.stringify({ key, hashes: ["abc"] })],
  ["a number", JSON.stringify({ key, hashes: [7] })],
]) {
  fs.writeFileSync(entry, text)
  const fresh = fakeRender([pageB])
  const torn = cacheWith(fresh.render)
  same(await torn.pages({ file: "clean.pptx", bytes: deck, use: "cached" }), [pageB], `${label} was a hit`)
  same(torn.tally.misses, 1, `${label} was not a miss`)
  same(readRender(folder, key), [pageB], `${label} was not replaced`)
}

writeRender(folder, key, [pageA])
same(
  fs.readdirSync(folder).filter((name) => name !== `${key}.json`),
  [],
  "a write left a temporary file",
)
const writeFile = fs.writeFileSync
const writes = []
fs.writeFileSync = (file, ...rest) => {
  writes.push({ entry: path.resolve(String(file)) === path.join(folder, `${key}.json`), seen: readRender(folder, key) })
  return writeFile(file, ...rest)
}
try {
  writeRender(folder, key, [pageB, pageA])
} finally {
  fs.writeFileSync = writeFile
}
same(writes, [{ entry: false, seen: [pageA] }], "a reader saw the entry while it was written")
same(readRender(folder, key), [pageB, pageA], "the rename did not land the entry")

same(warm.line(), "render cache 1 hits, 0 misses, 0 uncached, rendering 0.0 seconds", "the cache line")

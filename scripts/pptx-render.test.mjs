import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  committedBlobs,
  fontFingerprint,
  gitBlobId,
  readRender,
  renderCache,
  renderCode,
  renderKey,
  renderLocale,
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
  fonts: "f".repeat(64),
  locale: { LANG: "en_US.UTF-8" },
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
changed("the font list", { machine: { ...machine, fonts: "e".repeat(64) } })
changed("the locale", { machine: { ...machine, locale: { LANG: "ja_JP.UTF-8" } } })
changed("an added locale variable", { machine: { ...machine, locale: { ...machine.locale, LC_ALL: "C" } } })

const listing = "/fonts/a.ttf|Liberation Sans|Regular\n/fonts/b.ttc|WenQuanYi Zen Hei|Regular\n"
const stamp = (file) => (file === "/fonts/a.ttf" ? "100|1" : "200|2")
const fonts = fontFingerprint(listing, stamp)
if (fonts === null || !/^[0-9a-f]{64}$/.test(fonts)) fail("the font list has no fingerprint")
same(fontFingerprint(listing.split("\n").reverse().join("\n"), stamp), fonts, "the font order changed the fingerprint")
if (fontFingerprint(listing.replace("Liberation Sans", "Arial"), stamp) === fonts) fail("a font family is ignored")
if (fontFingerprint(`${listing}/fonts/c.ttf|Calibri|Regular\n`, stamp) === fonts) fail("an added font is ignored")
if (fontFingerprint(listing, () => "100|9") === fonts) fail("a font file change is ignored")
same(fontFingerprint("Fontconfig error: no fonts\n"), null, "an empty font list has a fingerprint")
same(
  renderLocale({
    HOME: "/home/a",
    LC_ALL: "C",
    LANG: "en_US.UTF-8",
    SAL_USE_VCLPLUGIN: "gen",
    FONTCONFIG_FILE: "f",
    PATH: "/bin",
  }),
  { FONTCONFIG_FILE: "f", LANG: "en_US.UTF-8", LC_ALL: "C", SAL_USE_VCLPLUGIN: "gen" },
  "the locale variables",
)
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
if (!versionless.line().startsWith("render cache off, no pdftoppm version")) fail(versionless.line())

const fontless = fakeRender([pageB])
const unlisted = cacheWith(fontless.render, { machine: { ...machine, fonts: null } })
same(await unlisted.pages({ file: "clean.pptx", bytes: deck, use: "cached" }), [pageB], "no font list still cached")
same(unlisted.tally.uncached, 1, "no font list still read the cache")
same(fontless.calls.length, 1, "no font list did not render")
if (!unlisted.line().startsWith("render cache off, no font list")) fail(unlisted.line())

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

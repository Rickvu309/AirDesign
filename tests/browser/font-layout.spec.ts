import { readFile, writeFile } from "node:fs/promises"
import { expect, test } from "./deck-test"
import type * as FontExports from "@airdesign/fonts"

async function loadReference() {
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { loadFontLayoutContract }: typeof FontExports = await packageBuild(process.cwd(), "@airdesign/fonts")
  const { fontLayoutRevision } = await loadFontLayoutContract()
  const { loadIcu } = await import("./font-layout/icu.mjs")
  return { fontLayoutRevision, icu: await loadIcu(fontLayoutRevision) }
}

test("native rows include the discretionary hyphen and keep the following letter on its own row", async ({ page }) => {
  const { fixtureBytes, manifest } = await import("./font-layout/fixture-faces.mjs")
  const rows = await page.evaluate(
    async ({ source, geist, weight }) => {
      const { wrapped } = await import(`data:text/javascript;base64,${source}`)
      const face = new FontFace("AD-Geist", `url(data:font/ttf;base64,${geist})`, { weight })
      document.fonts.add(await face.load())
      return wrapped(
        { lang: "en-US", runs: [{ text: "soft\u00ADhy", faces: ["Geist"], size: 44, weight: 400 }] },
        [110],
      )
    },
    {
      source: await readFile("tests/browser/font-layout/chromium.mjs", "base64"),
      geist: (await fixtureBytes(manifest.Geist)).toString("base64"),
      weight: manifest.Geist.weight,
    },
  )
  expect(rows).toEqual([
    [
      { start: 0, end: 5, width: 97.640625 },
      { start: 5, end: 7, width: 47.703125 },
    ],
  ])
})

test("records native faces and compares served shaping at CSS line breaks", async ({ page }, info) => {
  const { fontLayoutRevision, icu } = await loadReference()
  const { compareLayout } = await import("./font-layout/differential.mjs")
  const report = await compareLayout(page, icu, fontLayoutRevision)
  console.log(`Font layout spec external network requests: ${report.externalRequests.length}`)
  const evidence = info.outputPath("font-layout.json")
  await writeFile(evidence, JSON.stringify(report, null, 2))
  await info.attach("font layout differential", {
    path: evidence,
    contentType: "application/json",
  })
  expect(report.failures).toEqual([])
})

test("runs Unicode 16 grapheme, line break and BiDi conformance", async ({}, info) => {
  const { fontLayoutRevision, icu } = await loadReference()
  expect(icu.lines("กำไรเพิ่มขึ้นที่สำคัญ", "th")).toEqual([0, 4, 9, 13, 16, 21])
  expect(icu.lines("ភាសាខ្មែរមានប្រវត្តិយូរអង្វែង", "km")).toEqual([0, 9, 12, 20, 29])
  expect(icu.lines("ພາສາລາວເປັນພາສາທາງການ", "lo")).toEqual([0, 4, 7, 11, 15, 21])
  const breaks: FontExports.FontLayout["breaks"] = ({ text, locale }) => ({
    opportunities: icu.lines(text, locale),
    graphemes: icu.graphemes(text),
  })
  expect(breaks({ text: "a\u0000b c", locale: "en-US" })).toEqual({
    opportunities: [0, 4, 5],
    graphemes: [0, 1, 2, 3, 4, 5],
  })
  const { unicodeResults } = await import("./font-layout/unicode.mjs")
  const report = await unicodeResults(icu, fontLayoutRevision.unicode)
  await info.attach("Unicode conformance", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  })
  expect(report.map(({ name, cases, failures }) => [name, cases, failures])).toEqual([
    ["GraphemeBreakTest", 1093, []],
    ["LineBreakTest", 16672, []],
    ["BidiCharacterTest", 91707, []],
  ])
})

test("an installed CJK face paints Han that served Geist cannot cover", async ({ playwright }, info) => {
  const { measureLocalHan } = await import("./font-layout/local-han.mjs")
  const report = await measureLocalHan(playwright.chromium)
  await info.attach("Local Han fallback", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  })
  expect(report.withoutLocal.localFonts).toEqual([])
  expect(report.withLocal.localFonts).toEqual([
    expect.objectContaining({ familyName: expect.stringMatching(/^Noto Sans JP/), glyphCount: 2 }),
  ])
  expect(Math.abs(report.withoutLocal.width - 389.45)).toBeLessThan(0.5)
  expect(Math.abs(report.withLocal.width - 424.66)).toBeLessThan(0.5)
})

test("the shipped Node and Chromium engines agree on styled glyphs and line offsets", async ({ page }, info) => {
  const { readdir } = await import("node:fs/promises")
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { loadFontLayout, fontRevision, loadFontLayoutContract }: typeof FontExports = await packageBuild(
    process.cwd(),
    "@airdesign/fonts",
  )
  const { fontLayoutRevision } = await loadFontLayoutContract()
  const { createHash } = await import("node:crypto")
  const { gzipSync } = await import("node:zlib")
  const { corpus } = await import("./font-layout/cases.mjs")
  const { fixtureBytes, manifest } = await import("./font-layout/fixture-faces.mjs")
  const { shapeCorpus, exerciseEviction } = await import("./font-layout/shared-layout.mjs")
  const ids = new Set([
    "arabic-joining",
    "arabic-mixed-bidi",
    "latin-ligatures-Garamond",
    "latin-bold-optical",
    "latin-tracked",
    "vietnamese-nfd",
    "hangul-nfd",
    "cjk-punctuation",
    "cjk-variation-selector",
    "han-fallback",
    "thai-dictionary",
    "devanagari",
    "emoji-zwj-Geist",
    "emoji-heart-vs15-Geist",
    "emoji-heart-vs16-Geist",
    "emoji-keycap-no-vs-Geist",
    "mixed-styles",
    "punctuation-glue",
  ])
  const cases = corpus.filter(({ id }) => ids.has(id))
  expect(cases).toHaveLength(ids.size)
  const evictionIds = ["cjk-punctuation", "hangul-nfc", "emoji-zwj-Geist"]
  const evictionCases = evictionIds.map((id, at) => ({
    id,
    lang: ["ja", "ko", "en-US"][at],
    runs: [{ text: ["日本語", "매출 증가", "👩‍💻"][at], faces: [["JP", "KR", "Emoji"][at]], size: 44, weight: 400 }],
  }))
  const budget = 28 * 1024 * 1024
  const names = new Set<string>([...cases, ...evictionCases].flatMap(({ runs }) => runs.flatMap(({ faces }) => faces)))
  const bytes = new Map<string, Buffer>()
  await Promise.all([...names].map(async (name) => bytes.set(name, await fixtureBytes(manifest[name]))))
  const bytesFor = (name: string) => {
    const file = bytes.get(name)
    if (file === undefined) throw new Error(`Missing font fixture ${name}`)
    return file
  }
  const hashes = Object.fromEntries([...names].map((name) => [name, manifest[name].sha256]))
  const dist = "apps/web/dist/assets"
  const assets = await readdir(dist)
  const chunk = assets.find((name) => /^layout-[\w-]{8}\.js$/.test(name))
  expect(chunk).toBeDefined()
  const wasmName = assets.find((name) => /^icu-breaks-.*\.wasm$/.test(name))
  expect(wasmName).toBeDefined()
  const wasm = await readFile(`${dist}/${wasmName}`)
  expect(createHash("sha256").update(wasm).digest("hex")).toBe(fontLayoutRevision.icuBreakerSha256)
  expect(wasm.length).toBeLessThanOrEqual(4_800_000)
  expect(gzipSync(wasm).length).toBeLessThanOrEqual(2_800_000)
  for (const notice of ["HarfBuzz.txt", "ICU.txt", "bidi-js.txt"])
    expect(await readFile(`${dist}/font-layout-licenses/${notice}`)).toEqual(
      await readFile(`packages/fonts/licenses/${notice}`),
    )

  const started = performance.now()
  const node = await loadFontLayout()
  const nodeCold = performance.now() - started
  const prepare = (layout: FontExports.FontLayoutEngine, name: string, axes: Record<string, number>) =>
    layout.prepareFace({ revision: fontRevision, key: name, axes, read: async () => new Uint8Array(bytesFor(name)) })
  const { breakResults } = await import("./font-layout/unicode.mjs")
  expect(
    await breakResults(
      {
        graphemes: (text: string) => node.breaks({ text, locale: "und" }).graphemes,
        lines: (text: string, locale: string) => node.breaks({ text, locale }).opportunities,
      },
      fontLayoutRevision.unicode,
    ),
  ).toEqual([
    { name: "GraphemeBreakTest", cases: 1093, failures: [] },
    { name: "LineBreakTest", cases: 16672, failures: [] },
  ])
  const expected = await shapeCorpus(node, cases, prepare)
  const eviction = await exerciseEviction(await loadFontLayout(budget), evictionCases, prepare)
  let peakBytes = 0
  for (const [at, row] of eviction.entries()) {
    expect(row.line.kind).toBe("shaped")
    expect(row.cache.bytes).toBeLessThanOrEqual(budget)
    peakBytes = Math.max(peakBytes, row.cache.bytes)
    if (at >= 2 && at % 3 !== 1) expect(row.previousWasPending).toBe(true)
  }
  expect(eviction.at(-1)?.cache.evictions).toBe(11)
  for (const row of expected) {
    expect(row.line.kind, row.id).toBe("shaped")
    expect(
      row.ends.every((lines: { end: number }[]) => lines.at(-1)?.end === row.line.range.end),
      row.id,
    ).toBe(true)
  }
  const rowFor = (id: string) => {
    const row = expected.find((row) => row.id === id)
    if (row === undefined) throw new Error(`Missing shaped fixture ${id}`)
    return row
  }
  const joined = rowFor("arabic-joining")
  expect(joined.line.glyphs.some((glyph: { unsafeToBreak: boolean }) => glyph.unsafeToBreak)).toBe(true)
  const textHeart = rowFor("emoji-heart-vs15-Geist")
  expect(textHeart.line.faces.some(({ face }: { face: FontExports.LayoutFace }) => face.presentation === "color")).toBe(
    false,
  )
  const colorHeart = rowFor("emoji-heart-vs16-Geist")
  expect(colorHeart.line.faces.map(({ face }: { face: FontExports.LayoutFace }) => face.sha256)).toContain(hashes.Emoji)
  const fallback = rowFor("han-fallback")
  expect(fallback.line.faces.map(({ face }: { face: FontExports.LayoutFace }) => face.sha256)).toContain(hashes.JP)
  const optical = rowFor("latin-bold-optical")
  expect(optical.line.faces[0].face.axes).toEqual({ wght: 700, opsz: 32 })
  const hyphens = rowFor("punctuation-glue").discretionaryHyphens
  expect(hyphens.length).toBeGreaterThan(0)
  for (const { plain, candidate } of hyphens) expect(candidate.advance).toBeGreaterThan(plain.advance)

  await page.route("**/font-layout-harness", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  )
  await page.route("**/shared-layout.mjs", (route) =>
    route.fulfill({ contentType: "text/javascript", path: "tests/browser/font-layout/shared-layout.mjs" }),
  )
  await page.route("**/layout-fixture/*", (route) =>
    route.fulfill({
      contentType: "font/ttf",
      body: bytesFor(new URL(route.request().url()).pathname.split("/").at(-1) ?? ""),
    }),
  )
  await page.goto("/font-layout-harness")
  const actual = await page.evaluate(
    async ({ chunk, cases, evictionCases, budget, fontRevision, hashes }) => {
      const { shapeCorpus, exerciseEviction, observeWasmMemory } = await import(
        new URL("/shared-layout.mjs", location.href).href
      )
      const stopMemory = observeWasmMemory()
      const started = performance.now()
      const { createFontLayout } = await import(`/assets/${chunk}`)
      const layout = await createFontLayout()
      const chromiumCold = performance.now() - started
      const fixtureCache = new Map<string, Uint8Array<ArrayBuffer>>()
      const read = async (name: string) => {
        let file = fixtureCache.get(name)
        if (file !== undefined) return file
        const response = await fetch(`/layout-fixture/${name}`)
        if (!response.ok) throw new Error(`Unavailable font fixture ${name}`)
        file = new Uint8Array(await response.arrayBuffer())
        fixtureCache.set(name, file)
        return file
      }
      const prepare = async (engine: FontExports.FontLayoutEngine, name: string, axes: Record<string, number>) => {
        const face = await engine.prepareFace({
          revision: fontRevision,
          key: name,
          axes,
          read: () => read(name),
        })
        if (face.sha256 !== hashes[name]) throw new Error(`Wrong face bytes for ${name}`)
        return face
      }
      const eviction = await exerciseEviction(await createFontLayout(budget), evictionCases, prepare)
      const heapBytes = stopMemory()
      return { rows: await shapeCorpus(layout, cases, prepare), eviction, chromiumCold, heapBytes }
    },
    { chunk, cases, evictionCases, budget, fontRevision, hashes },
  )
  expect(actual.rows).toEqual(expected)
  expect(actual.eviction).toEqual(eviction)
  expect(actual.heapBytes).toHaveLength(3)
  expect(Math.max(...actual.heapBytes)).toBeLessThan(64 * 1024 * 1024)
  await info.attach("Shared font engine", {
    body: JSON.stringify({
      cases: expected.length,
      nodeCold,
      chromiumCold: actual.chromiumCold,
      peakBytes,
      heapBytes: actual.heapBytes,
      eviction,
    }),
    contentType: "application/json",
  })
})

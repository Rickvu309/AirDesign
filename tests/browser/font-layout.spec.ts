import { readFile, writeFile } from "node:fs/promises"
import { expect, test } from "./deck-test"
import type * as FontExports from "@airdesign/fonts"

async function loadReference() {
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { fontLayoutRevision }: typeof import("../../packages/fonts/src/layout-contract.js") = await packageBuild(
    process.cwd(),
    "@airdesign/fonts",
    "layout-contract.js",
  )
  const { loadFontLayout }: typeof FontExports = await packageBuild(process.cwd(), "@airdesign/fonts")
  const { loadIcu } = await import("./font-layout/icu.mjs")
  return { fontLayoutRevision, icu: await loadIcu(fontLayoutRevision), loadFontLayout }
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

test("shared lines preserve Chromium's default CJK punctuation spacing", async ({ page }) => {
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { loadFontLayout, fontRevision }: typeof FontExports = await packageBuild(process.cwd(), "@airdesign/fonts")
  const { fixtureBytes, manifest } = await import("./font-layout/fixture-faces.mjs")
  const bytes = await fixtureBytes(manifest.JP)
  const layout = await loadFontLayout()
  const face = await layout.prepareFace({
    revision: fontRevision,
    key: "jp-spacing",
    axes: { wght: 400 },
    read: async () => new Uint8Array(bytes),
  })
  const text = "「東、。」を"
  const range = { start: 0, end: text.length }
  const paragraph = {
    text,
    direction: "ltr",
    locale: "ja",
    sourceOffsetByTextOffset: [],
    runs: [{ range, faces: [face], size: 44, tracking: 0 }],
  } satisfies Parameters<FontExports.FontLayoutEngine["shapeLine"]>[0]["paragraph"]
  const shared = layout.flow({ paragraph, width: Infinity, emergency: false, twoLines: false, missingFace: face })
  const native = await page.evaluate(
    async ({ base64, text }) => {
      const face = await new FontFace("AD-JP", `url(data:font/ttf;base64,${base64})`, { weight: "100 900" }).load()
      document.fonts.add(face)
      const line = document.createElement("span")
      line.lang = "ja"
      line.style.cssText = "white-space:pre;font:44px AD-JP;text-rendering:geometricPrecision"
      line.textContent = text
      document.body.append(line)
      const normal = line.getBoundingClientRect().width
      line.style.setProperty("text-spacing-trim", "space-all")
      return { normal, untrimmed: line.getBoundingClientRect().width }
    },
    { base64: bytes.toString("base64"), text },
  )
  expect(shared).toBeDefined()
  expect(Math.abs((shared?.lines[0]?.advance ?? Infinity) - native.normal)).toBeLessThan(0.5)
  expect(native.untrimmed - native.normal).toBeGreaterThan(20)
})

test("the shipped Node and Chromium engines agree on styled glyphs and line offsets", async ({ page }, info) => {
  const { readdir } = await import("node:fs/promises")
  const { packageBuild } = await import("../../scripts/package-build.mjs")
  const { fontRevision }: typeof FontExports = await packageBuild(process.cwd(), "@airdesign/fonts")
  const { fontLayoutRevision }: typeof import("../../packages/fonts/src/layout-contract.js") = await packageBuild(
    process.cwd(),
    "@airdesign/fonts",
    "layout-contract.js",
  )
  const { createHash } = await import("node:crypto")
  const { gzipSync } = await import("node:zlib")
  const { corpus, paintStyleCases } = await import("./font-layout/cases.mjs")
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
  const cases = [...corpus.filter(({ id }) => ids.has(id)), ...paintStyleCases]
  expect(cases).toHaveLength(ids.size + paintStyleCases.length)
  const evictionCases = [
    { id: "japanese", lang: "ja", text: "日本語", face: "JP", revision: fontRevision },
    { id: "korean", lang: "ko", text: "매출 증가", face: "KR", revision: fontRevision },
    { id: "emoji", lang: "en-US", text: "👩‍💻", face: "Emoji", revision: fontRevision },
    { id: "previous-japanese", lang: "ja", text: "日本語", face: "JP", revision: fontRevision + "-previous" },
  ].map(({ id, lang, text, face, revision }) => ({
    id,
    lang,
    revision,
    runs: [{ text, faces: [face], size: 44, weight: 400 }],
  }))
  const budget = 48 * 1024 * 1024
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
  expect(assets.filter((file) => file.endsWith(".js")).length).toBeLessThanOrEqual(2_037)
  const home = await readFile("apps/web/dist/index.html", "utf8")
  expect([...home.matchAll(/(?:src|href)="\/assets\/([^"]+)-[\w-]{8}\.js"/g)].map(([, name]) => name)).toEqual([
    "index",
    "createLucideIcon",
    "check",
    "circle-check",
    "circle-exclamation-point",
    "info",
    "loader-circle",
    "octagon-x",
    "triangle-exclamation-point",
    "x",
    "usage-load",
  ])
  const chunk = assets.find((name) => /^layout-[\w-]{8}\.js$/.test(name))
  expect(chunk).toBeDefined()
  const wasmName = assets.find((name) => /^icu-breaks-.*\.wasm$/.test(name))
  expect(wasmName).toBeDefined()
  const wasm = await readFile(`${dist}/${wasmName}`)
  expect(createHash("sha256").update(wasm).digest("hex")).toBe(fontLayoutRevision.icuBreakerSha256)
  expect(wasm.length).toBeLessThanOrEqual(2_700_000)
  expect(gzipSync(wasm).length).toBeLessThanOrEqual(1_200_000)
  for (const notice of ["HarfBuzz.txt", "ICU.txt", "bidi-js.txt", "musl.txt"])
    expect(await readFile(`${dist}/font-layout-licenses/${notice}`)).toEqual(
      await readFile(`packages/fonts/licenses/${notice}`),
    )

  const started = performance.now()
  const { createFontLayout }: typeof import("../../packages/fonts/src/layout.js") = await packageBuild(
    process.cwd(),
    "@airdesign/fonts",
    "layout.js",
  )
  const node = await createFontLayout()
  const nodeCold = performance.now() - started
  const prepare = (
    layout: FontExports.FontLayoutEngine,
    name: string,
    axes: Record<string, number>,
    revision = fontRevision,
  ) => layout.prepareFace({ revision, key: name, axes, read: async () => new Uint8Array(bytesFor(name)) })
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
  const { loadIcu } = await import("./font-layout/icu.mjs")
  const reference = await loadIcu(fontLayoutRevision)
  for (const { id, lang: locale, runs } of corpus) {
    const text = runs.map((run) => run.text).join("")
    expect(node.breaks({ text, locale }), id).toEqual({
      graphemes: reference.graphemes(text),
      opportunities: reference.lines(text, locale),
    })
  }
  for (const locale of ["en_US_POSIX", "ja-u-lb-loose", "zh-Hant-u-lb-strict"]) {
    const text = "売上 収益。前年比＋31％"
    expect(node.breaks({ text, locale }).opportunities, locale).toEqual(reference.lines(text, locale))
  }
  const eviction = await exerciseEviction(node, evictionCases, prepare)
  const expected = await shapeCorpus(node, cases, prepare)
  let peakBytes = 0
  for (const row of eviction) {
    expect(row.line.kind).toBe("shaped")
    expect(row.cache.bytes).toBeLessThanOrEqual(budget)
    peakBytes = Math.max(peakBytes, row.cache.bytes)
  }
  expect(eviction.at(-1)?.cache.evictions).toBeGreaterThan(0)
  expect(eviction.some((row) => row.oldestWasPending)).toBe(true)
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
  await page.route("**/chromium.mjs", (route) =>
    route.fulfill({ contentType: "text/javascript", path: "tests/browser/font-layout/chromium.mjs" }),
  )
  await page.route("**/faces/*.ttf", (route) =>
    route.fulfill({
      contentType: "font/ttf",
      body: bytesFor(new URL(route.request().url()).pathname.slice("/faces/".length, -".ttf".length)),
    }),
  )
  await page.goto("/font-layout-harness")
  const actual = await page.evaluate(
    async ({ chunk, cases, evictionCases, fontRevision, hashes, paintStyleCases, paintFaces }) => {
      const { shapeCorpus, exerciseEviction, observeWasmMemory } = await import(
        new URL("/shared-layout.mjs", location.href).href
      )
      const memory = observeWasmMemory()
      const started = performance.now()
      const { createFontLayout } = await import(`/assets/${chunk}`)
      const layout = await createFontLayout()
      const chromiumCold = performance.now() - started
      const fixtureCache = new Map<string, Uint8Array<ArrayBuffer>>()
      const read = async (name: string) => {
        let file = fixtureCache.get(name)
        if (file !== undefined) return file
        const response = await fetch(`/faces/${name}.ttf`)
        if (!response.ok) throw new Error(`Unavailable font fixture ${name}`)
        file = new Uint8Array(await response.arrayBuffer())
        fixtureCache.set(name, file)
        return file
      }
      const prepare = async (
        engine: FontExports.FontLayoutEngine,
        name: string,
        axes: Record<string, number>,
        revision = fontRevision,
      ) => {
        const face = await engine.prepareFace({
          revision,
          key: name,
          axes,
          read: () => read(name),
        })
        if (face.sha256 !== hashes[name]) throw new Error(`Wrong face bytes for ${name}`)
        return face
      }
      const eviction = await exerciseEviction(layout, evictionCases, prepare)
      const warmHeapBytes = memory.bytes()
      await exerciseEviction(layout, evictionCases, prepare)
      const repeatedHeapBytes = memory.bytes()
      const { full, loadNative } = await import(new URL("/chromium.mjs", location.href).href)
      await loadNative(paintFaces)
      const nativeWidths = paintStyleCases.map((item) => full(item))
      const rows = await shapeCorpus(layout, cases, prepare)
      const heapBytes = memory.bytes()
      memory.stop()
      return { rows, eviction, chromiumCold, heapBytes, warmHeapBytes, repeatedHeapBytes, nativeWidths }
    },
    {
      chunk,
      cases,
      evictionCases,
      fontRevision,
      hashes,
      paintStyleCases,
      paintFaces: Object.fromEntries(["Narrow", "NarrowItalic"].map((name) => [name, manifest[name]])),
    },
  )
  expect(actual.rows).toEqual(expected)
  const paintWidths = paintStyleCases.map(({ id }, index) => ({
    id,
    shared: rowFor(id).line.advance,
    native: actual.nativeWidths[index],
  }))
  for (const { id, shared, native } of paintWidths) expect(Math.abs(shared - native), id).toBeLessThan(0.05)
  expect(rowFor("latin-italic").line.faces.map(({ face }: { face: FontExports.LayoutFace }) => face.sha256)).toEqual([
    hashes.Narrow,
    hashes.NarrowItalic,
  ])
  expect(actual.eviction).toEqual(eviction)
  expect(actual.heapBytes).toHaveLength(2)
  expect(actual.repeatedHeapBytes).toEqual(actual.warmHeapBytes)
  expect(Math.max(...actual.heapBytes)).toBeLessThan(72 * 1024 * 1024)
  await info.attach("Shared font engine", {
    body: JSON.stringify({
      cases: expected.length,
      paintWidths,
      nodeCold,
      chromiumCold: actual.chromiumCold,
      peakBytes,
      heapBytes: actual.heapBytes,
      eviction,
    }),
    contentType: "application/json",
  })
})

test("records native faces and compares served shaping at CSS line breaks", async ({ page }, info) => {
  const { fontLayoutRevision, icu, loadFontLayout } = await loadReference()
  const { compareLayout } = await import("./font-layout/differential.mjs")
  const report = await compareLayout(page, icu, fontLayoutRevision, await loadFontLayout())
  console.log(`Font layout spec external network requests: ${report.externalRequests.length}`)
  const evidence = info.outputPath("font-layout.json")
  await writeFile(evidence, JSON.stringify(report, null, 2))
  await info.attach("font layout differential", {
    path: evidence,
    contentType: "application/json",
  })
  expect(report.failures).toEqual([])
})

test("each corpus bake agrees with the canvas within half a slide pixel or is refused", async ({}, info) => {
  const { bakeParity } = await import("./font-layout/bake-parity.mjs")
  const results: readonly {
    id: string
    width: number | null
    difference: number
    savedDifference: number | undefined
    answer: { ok: boolean; reason?: string }
  }[] = await bakeParity()
  await info.attach("Canvas and agent bake parity", { body: JSON.stringify(results), contentType: "application/json" })
  expect(results).toHaveLength(410)
  expect(
    results
      .filter(({ id }) => id === "legacy-soft-hyphens" || id.startsWith("latin-color-kerning"))
      .every(({ answer, savedDifference }) => answer.ok && (savedDifference ?? Infinity) <= 0.5),
  ).toBe(true)
  for (const result of results) {
    const label = `${result.id} at ${String(result.width)}`
    if (result.answer.ok) expect(result.savedDifference, label).toBeLessThanOrEqual(0.5)
    else {
      expect(result.answer.reason, label).toMatch(/^(shaping|coverage)$/)
      expect(result.difference, label).toBeGreaterThan(0.5)
    }
  }
})

test("business titles and Japanese text with isolated punctuation bake in the served fonts", async ({}, info) => {
  const { bakeParity } = await import("./font-layout/bake-parity.mjs")
  const rows: readonly {
    group: string
    id: string
    savedDifference: number | undefined
    answer: { ok: boolean; reason?: string }
  }[] = await bakeParity(true)
  const shares = [...new Set(rows.map(({ group }) => group))].map((group) => {
    const samples = rows.filter((row) => row.group === group)
    return { group, total: samples.length, refused: samples.filter(({ answer }) => !answer.ok).length }
  })
  await info.attach("Refusals by theme", {
    body: JSON.stringify({ shares, rows }, null, 2),
    contentType: "application/json",
  })
  for (const { group, id, answer, savedDifference } of rows) {
    if (group === "japanese-inter" && !answer.ok) {
      expect(answer.reason, id).toMatch(/^coverage$/)
      continue
    }
    expect(answer.ok, `${group}: ${id}`).toBe(true)
    expect(savedDifference, id).toBeLessThanOrEqual(0.5)
  }
})

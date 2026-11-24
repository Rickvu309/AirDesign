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

import {expect, it} from "vitest"
import {chromium} from "playwright"
import {readFile, mkdir} from "node:fs/promises"
import path from "node:path"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {id} from "../../deck/src/model.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {captureDocument} from "../src/capture-document.tsx"

it("lays out native paragraphs and bottom anchored frame in the shared capture renderer", async () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  text.box = {x: 40, y: 40, width: 600, height: 350}
  const first = text.body.paragraphs[0]
  first.endStyle = {...first.endStyle, size: 24, baseline: 0.25, opacity: 0.5, highlight: "#ffff00"}
  first.runs = [{kind: "text", text: "A native paragraph", style: {...first.endStyle, letterSpacing: 2, strike: true, capitalization: "small", kerning: 12}}, {kind: "break", style: first.endStyle}, {kind: "text", text: "Explicit second line", style: {...first.endStyle, italic: true}}]
  first.marker = {kind: "number", format: "decimal", start: 3, color: "#336699"}
  first.spacing.before = {kind: "multiple", value: 0.5}
  text.body.frame.wrap = "none"
  first.spacing.line = {kind: "multiple", value: 1.5}
  text.body.paragraphs.push({...structuredClone(first), id: id("trailing"), marker: {kind: "number", format: "decimal", start: null}, runs: []})
  text.body.frame.anchor = "bottom"
  text.body.frame.insets = {top: 8, right: 12, bottom: 16, left: 20}
  const font = await readFile(new URL("../../ui/fonts/geist-latin-600.woff2", import.meta.url))
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 540}, offline: true})
    await page.route("**/*", route => route.abort())
    await page.setContent(captureDocument(deck, "s0", `@font-face{font-family:Geist;font-weight:600;src:url(data:font/woff2;base64,${font.toString("base64")})}`, {}))
    await page.evaluate(async () => {await document.fonts.ready})
    const geometry = await page.evaluate(() => {
      const frame = document.querySelector("[data-text-frame]")!, paragraphs = [...document.querySelectorAll("[data-paragraph]")]
      const run = getComputedStyle(document.querySelector('[data-paragraph] span:not([data-marker])')!)
      return {style: {letterSpacing: run.letterSpacing, top: run.top, strike: run.textDecorationLine, capitalization: run.fontVariantCaps, kerning: run.fontKerning, paragraphTop: getComputedStyle(paragraphs[0]!).top, opacity: run.opacity, parentOpacity: getComputedStyle(paragraphs[0]!).opacity, highlight: run.backgroundColor, glyph: run.verticalAlign, before: getComputedStyle(paragraphs[0]!).marginTop, wrap: getComputedStyle(document.querySelector("[data-text]")!).whiteSpace, markerColor: getComputedStyle(document.querySelector("[data-marker]")!).color, markerSize: getComputedStyle(document.querySelector("[data-marker]")!).fontSize}, frame: frame.getBoundingClientRect().toJSON(), paragraphs: paragraphs.map(paragraph => ({box: paragraph.getBoundingClientRect().toJSON(), lineHeight: getComputedStyle(paragraph).lineHeight})), markers: [...document.querySelectorAll("[data-marker]")].map(marker => marker.textContent), italic: getComputedStyle(document.querySelector('[data-paragraph] span:last-of-type')!).fontStyle}
    })
    expect(geometry.style).toEqual({letterSpacing: "2px", top: "-6px", strike: "line-through", capitalization: "small-caps", kerning: "normal", paragraphTop: "0px", opacity: "0.5", parentOpacity: "1", highlight: "rgb(255, 255, 0)", glyph: "baseline", before: "18px", wrap: "pre", markerColor: "rgb(51, 102, 153)", markerSize: "24px"})
    expect(geometry.frame).toMatchObject({x: 40, y: 40, width: 600, height: 350})
    expect(geometry.markers).toEqual(["3.", "4."])
    expect(geometry.paragraphs[0]!.lineHeight).toBe("36px")
    expect(geometry.paragraphs[0]!.box.x).toBe(60)
    expect(geometry.paragraphs[0]!.box.height).toBe(72)
    expect(geometry.paragraphs[1]!.box.bottom).toBe(374)
    expect(geometry.italic).toBe("italic")
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {await mkdir(artifacts, {recursive: true}); await page.screenshot({path: path.join(artifacts, "native-render.png")})}
  } finally {await browser.close()}
})


it("renders vertical frame flow and paragraph glyph alignment without changing native identities", async () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  text.body.frame.verticalFlow = "vertical270"
  text.body.frame.compatibilityLineSpacing = true
  text.body.paragraphs[0].marker = {kind: "bullet", character: "•", size: {kind: "multiple", value: 0.75}}
  text.body.paragraphs[0].glyphAlignment = "center"
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({offline: true})
    await page.route("**/*", route => route.abort())
    await page.setContent(captureDocument(deck, "s0", "", {}))
    expect(await page.locator("[data-text-frame]").evaluate(element => getComputedStyle(element).writingMode)).toBe("sideways-lr")
    expect(await page.locator("[data-paragraph] span:not([data-marker])").first().evaluate(element => getComputedStyle(element).verticalAlign)).toBe("middle")
    expect(await page.locator("[data-marker]").evaluate(element => getComputedStyle(element).fontSize)).toBe(`${text.body.paragraphs[0].endStyle.size * 0.75}px`)
    expect(await page.locator("[data-paragraph]").evaluate(element => getComputedStyle(element).lineHeight)).toBe(`${text.body.paragraphs[0].endStyle.size * text.body.paragraphs[0].spacing.line.value}px`)
    expect(await page.locator("[data-text-frame]").getAttribute("data-text-frame")).toBe(text.body.frame.id)
  } finally {await browser.close()}
})

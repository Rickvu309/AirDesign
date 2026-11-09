import {expect, it} from "vitest"
import {chromium} from "playwright"
import {mkdir, readFile, writeFile} from "node:fs/promises"
import {id} from "../../deck/src/model.ts"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {captureDocument} from "../src/capture-document.tsx"
import {importPptx, exportPptx} from "../../pptx/src/index.ts"
import {importedNativeDeck} from "../../pptx/src/import-deck.ts"
import {writeNativeSavedPptx} from "../../pptx/src/export-deck.ts"
import {competingCascadeSource, competingStyles, type CascadeLayer} from "../../pptx/test/text-cascade-fixture.ts"

it("paints original saved autofit and rollover markers in shared Chromium rendering", async () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  const first = text.body.paragraphs[0]
  first.marker = {kind: "number", format: "alphaLower", start: 53}
  first.endStyle = {...first.endStyle, color: "#445566", size: 32, font: "ParagraphAcceptanceMissingFont", bold: false, italic: false}
  first.runs = [{kind: "text", text: "Saved paint", style: first.endStyle}]
  first.spacing.line = {kind: "points", value: 40}
  text.body.paragraphs.push({...structuredClone(first), id: id("trailingEmpty"), runs: [], marker: {kind: "number", format: "alphaLower", start: null}, spacing: {...first.spacing, line: {kind: "multiple", value: 1.5}}})
  text.body.frame.autofit = {kind: "shrink", fontScale: 0.625, lineReduction: 0.2}
  const source = await writeNativeSavedPptx(deck, 0, null, {}), original = await importPptx(source)
  expect(original.parts.get("ppt/slides/slide1.xml")!.toString()).toContain('type="alphaLcPeriod" startAt="53"')
  const reopened = importedNativeDeck(original), browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 720}, offline: true})
    await page.setContent(captureDocument(reopened, reopened.slides[0]!.id, "body{background:white}", {}))
    const receipt = await page.locator("[data-paragraph]").evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element), run = element.querySelector("[data-text-run]")
      return {marker: element.querySelector("[data-marker]")?.textContent, lineHeight: style.lineHeight, fontSize: style.fontSize, color: run ? getComputedStyle(run).color : style.color, bold: style.fontWeight, italic: style.fontStyle, end: !!element.querySelector("[data-paragraph-end]")}
    }))
    expect(receipt).toEqual([{marker: "aaa.", lineHeight: "25px", fontSize: "20px", color: "rgb(68, 85, 102)", bold: "400", italic: "normal", end: false}, {marker: "bbb.", lineHeight: "24px", fontSize: "20px", color: "rgb(68, 85, 102)", bold: "400", italic: "normal", end: true}])
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {
      await mkdir(artifacts, {recursive: true})
      await page.screenshot({path: `${artifacts}/saved-autofit-markers.png`})
      await writeFile(`${artifacts}/browser-paint.json`, JSON.stringify(receipt, null, 2))
    }
  } finally {await browser.close()}
})

it("paints imported competing inheritance layers after selective save in shared Chromium rendering", async () => {
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 720}, offline: true}), receipts = []
    for (const layer of [-1, 0, 1, 2, 3, 4, 5, 6, 7] satisfies CascadeLayer[]) {
      const original = await competingCascadeSource(layer), source = await exportPptx(original), deck = importedNativeDeck(original)
      const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))
      if (text?.kind !== "text") throw new Error("inherited-native-paint-required")
      text.body.paragraphs[0].alignment = "center"
      const saved = importedNativeDeck(await importPptx(await writeNativeSavedPptx(deck, 1, source, {})))
      await page.setContent(captureDocument(saved, saved.slides[0]!.id, "body{background:white}", {}))
      const receipt = await page.getByText("Competing inheritance", {exact: true}).evaluate(element => {
        const run = getComputedStyle(element), end = getComputedStyle(element.parentElement!)
        return {font: run.fontFamily, size: run.fontSize, color: run.color, bold: run.fontWeight, italic: run.fontStyle, endColor: end.color, endSize: end.fontSize}
      })
      const expected = layer === -1 ? {font: "Cascade Theme Major", color: "#010203", size: 32, bold: false, italic: false} : competingStyles[Math.min(layer, 6)]!
      const end = layer === 7 ? competingStyles[7]! : expected
      const rgb = (hex: string) => `rgb(${[1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16)).join(", ")})`
      expect(receipt).toMatchObject({size: `${expected.size}px`, color: rgb(expected.color), bold: expected.bold ? "600" : "400", italic: expected.italic ? "italic" : "normal", endColor: rgb(end.color), endSize: `${end.size}px`})
      expect(receipt.font).toContain(expected.font)
      receipts.push({layer, ...receipt})
    }
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {
      await mkdir(artifacts, {recursive: true})
      await writeFile(`${artifacts}/inheritance-paint.json`, JSON.stringify(receipts, null, 2))
      await page.screenshot({path: `${artifacts}/inheritance-paint.png`})
    }
  } finally {await browser.close()}
})


it("measures saved and omitted autofit without mutating either in loaded-font shared rendering", async () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("autofit-measure-text-required")
  text.box = {x: 20, y: 20, width: 320, height: 240}
  const first = text.body.paragraphs[0]
  first.endStyle = {...first.endStyle, font: "Geist", size: 24, bold: false}
  first.runs = [{kind: "text", text: "Hidden advance", style: {...first.endStyle, color: null}}, {kind: "break", style: {...first.endStyle, size: 30}}, {kind: "text", text: "Visible line", style: first.endStyle}]
  first.marker = {kind: "number", format: "decimal", start: 3}
  text.body.paragraphs.push({...structuredClone(first), id: id("fitBullet"), marker: {kind: "bullet", character: "•"}, runs: [{kind: "text", text: "Bullet", style: first.endStyle}]}, {...structuredClone(first), id: id("fitEmpty"), runs: []})
  const font = await readFile(new URL("../../ui/fonts/geist-latin-400.woff2", import.meta.url))
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 540}, offline: true}), receipts = []
    for (const fontScale of [null, 1, 0.625]) {
      text.body.frame.autofit = {kind: "shrink", fontScale, lineReduction: fontScale === 0.625 ? 0.2 : null}
      const before = structuredClone(text)
      await page.setContent(captureDocument(deck, deck.slides[0]!.id, `@font-face{font-family:Geist;font-weight:400;src:url(data:font/woff2;base64,${font.toString("base64")})}`, {}))
      const geometry = await page.evaluate(async () => {
        await document.fonts.ready
        const frame = document.querySelector("[data-text-frame]")!, paragraphs = [...document.querySelectorAll("[data-paragraph]")]
        const lines = paragraphs.map(paragraph => {
          const range = document.createRange()
          range.selectNodeContents(paragraph)
          return {box: paragraph.getBoundingClientRect().toJSON(), lines: [...range.getClientRects()].map(rect => rect.toJSON())}
        })
        const hidden = document.querySelector("[data-text-run]")!
        return {loaded: document.fonts.check("24px Geist"), frame: frame.getBoundingClientRect().toJSON(), paragraphs: lines, hidden: hidden.getBoundingClientRect().toJSON(), markers: [...document.querySelectorAll("[data-marker]")].map(marker => marker.textContent)}
      })
      expect(geometry.loaded).toBe(true)
      expect(geometry.frame).toMatchObject(text.box)
      expect(geometry.markers).toEqual(["3.", "•", "3."])
      expect(geometry.hidden.width).toBeGreaterThan(0)
      expect(geometry.paragraphs).toHaveLength(3)
      expect(geometry.paragraphs[2]!.box.height).toBeGreaterThan(0)
      expect(text).toEqual(before)
      receipts.push({fontScale, inputFrame: text.box, geometry})
    }
    expect(receipts[0]!.geometry).toEqual(receipts[1]!.geometry)
    expect(receipts[2]!.geometry.paragraphs[0]!.box.height).toBeLessThan(receipts[0]!.geometry.paragraphs[0]!.box.height)
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {
      await mkdir(artifacts, {recursive: true})
      await writeFile(`${artifacts}/autofit-saved-geometry.json`, JSON.stringify(receipts, null, 2))
      await page.screenshot({path: `${artifacts}/autofit-saved-geometry.png`})
    }
  } finally {await browser.close()}
})

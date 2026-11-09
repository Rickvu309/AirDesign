import {expect, it} from "vitest"
import {chromium} from "playwright"
import {mkdir, writeFile} from "node:fs/promises"
import {id} from "../../deck/src/model.ts"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {captureDocument} from "../src/capture-document.tsx"
import type {ParagraphMarker} from "../../deck/src/text/body.ts"

it("paints exact punctuation and honest unsupported markers without losing neighboring text", async () => {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(1, 1)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("text-required")
  text.box = {x: 40, y: 40, width: 800, height: 600}
  const first = text.body.paragraphs[0]
  const markers: ParagraphMarker[] = [
    {kind: "number", format: "decimal", punctuation: "plain", start: 4},
    {kind: "number", format: "alphaLower", punctuation: "right-parenthesis", start: 27},
    {kind: "number", format: "romanUpper", punctuation: "parentheses", start: 4},
    {kind: "number", format: "romanUpper", start: 4000},
    {kind: "source-number", scheme: "thaiAlphaPeriod", start: 1},
  ]
  text.body.paragraphs = [first, ...markers.slice(1).map((_, index) => ({...structuredClone(first), id: id(`paintMarker${index}`)}))]
  text.body.paragraphs.forEach((paragraph, index) => {
    paragraph.marker = markers[index]!
    paragraph.runs = [{kind: "text", text: " Editable neighboring text", style: {...paragraph.endStyle, font: "Arial", size: 24}}]
  })
  const browser = await chromium.launch({args: ["--no-sandbox"]})
  try {
    const page = await browser.newPage({viewport: {width: 960, height: 720}, offline: true})
    await page.setContent(captureDocument(deck, deck.slides[0]!.id, "body{background:white}", {}))
    const labels = await page.locator("[data-marker]").allTextContents()
    expect(labels).toEqual(["4", "aa)", "(IV)", "[numbering unavailable]", "[numbering unavailable]"])
    expect(await page.locator("[data-text-run]").allTextContents()).toEqual(Array(5).fill(" Editable neighboring text"))
    const artifacts = process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
    if (artifacts) {
      await mkdir(artifacts, {recursive: true})
      await page.screenshot({path: `${artifacts}/number-markers.png`})
      await writeFile(`${artifacts}/number-marker-paint.json`, JSON.stringify(labels))
    }
  } finally {await browser.close()}
})

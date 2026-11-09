import {supportedNumberSchemes, retainedNumberSchemes, isRetainedNumberScheme, numberMarkerFromScheme, numberMarkerLabel, numberMarkerScheme} from "../../deck/src/text/number-marker.ts"
import {readTextBody, writeTextBody} from "../src/text/body.ts"
import {parseXml} from "../src/xml.ts"
import {decodeLegacyRunsV2} from "../../deck/src/text/legacy-v2.ts"
import {id} from "../../deck/src/model.ts"
import {expect, it} from "vitest"
import {cascadeSource} from "./text-cascade-fixture.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {commandId} from "../../change-log/src/index.ts"
import {executeNative, initialNativeHistory} from "../../change-log/src/text/native-model.ts"

it.each(["arabicPeriod", "thaiAlphaPeriod"])("preserves a %s shape with invalid startAt without refusing the deck", async scheme => {
  const baseline = importedNativeDeck(await cascadeSource())
  const keptShapes = (value: typeof baseline) => value.slides[0]!.elements.filter(element => element.support.kind === "kept" && element.source.kind === "original" && element.source.objectId.startsWith("sp:"))
  for (const start of ["0", "32768", "foo", "-1", "1.5", ""]) {
    const fragment = `<a:buAutoNum type="${scheme}" startAt="${start}"/>`
    const original = await cascadeSource(`<a:p><a:pPr>${fragment}</a:pPr><a:r><a:t>Preserved invalid marker</a:t></a:r></a:p>`)
    const source = await exportPptx(original), deck = importedNativeDeck(original)
    expect(deck.slides[0]!.elements.some(element => element.kind === "text")).toBe(true)
    expect(deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)).toBeUndefined()
    expect(keptShapes(deck)).toHaveLength(keptShapes(baseline).length + 1)
    const preserved = await importPptx(await writeNativeSavedPptx(deck, 0, source, {}))
    expect(preserved.parts.get("ppt/slides/slide1.xml")).toEqual(original.parts.get("ppt/slides/slide1.xml"))
    expect(preserved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain(fragment)
  }
})

it.each(["arabicPeriod", "thaiAlphaPeriod"])("admits valid %s startAt boundary values", async scheme => {
  for (const start of ["1", "32767", "+01", " 4 "]) {
    const original = await cascadeSource(`<a:p><a:pPr><a:buAutoNum type="${scheme}" startAt="${start}"/></a:pPr><a:r><a:t>Editable boundary</a:t></a:r></a:p>`)
    const deck = importedNativeDeck(original), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
    if (text?.kind !== "text") throw new Error("native-text-required")
    expect(text.body.paragraphs[9]!.marker).toMatchObject({start: Number(start)})
  }
})

it.each([...Object.keys(supportedNumberSchemes), ...retainedNumberSchemes])("keeps %s native through edit, undo, redo and two saved exports", async scheme => {
  const fragment = `<a:buAutoNum type="${scheme}" startAt="4"/>`
  const original = await cascadeSource(`<a:p><a:pPr>${fragment}</a:pPr><a:r><a:t>Editable marker neighbor</a:t></a:r></a:p>`)
  const source = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const paragraph = text.body.paragraphs[9]!
  expect(paragraph.marker.kind).toBe(isRetainedNumberScheme(scheme) ? "source-number" : "number")
  const history = initialNativeHistory(deck)
  const edited = executeNative(history, {id: commandId("marker-edit"), kind: "patch", target: paragraph.id, fields: {runs: paragraph.runs.map(run => run.kind === "text" ? {...run, text: "Changed neighbor"} : run)}, base: 0, run: null})
  expect(edited.receipt.kind).toBe("applied")
  const undone = executeNative(edited.history, {id: commandId("marker-undo"), kind: "undo", target: commandId("marker-edit")})
  expect(undone.receipt.kind).toBe("applied")
  expect(undone.history.deck.slides.map(slide => slide.elements)).toEqual(deck.slides.map(slide => slide.elements))
  const redone = executeNative(undone.history, {id: commandId("marker-redo"), kind: "redo", target: commandId("marker-edit")})
  expect(redone.receipt.kind).toBe("applied")
  expect(redone.history.deck.slides.map(slide => slide.elements)).toEqual(edited.history.deck.slides.map(slide => slide.elements))
  const savedBytes = await writeNativeSavedPptx(edited.history.deck, edited.history.seq, source, {})
  const saved = await importPptx(savedBytes)
  expect(saved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain(fragment)
  expect(saved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain("Changed neighbor")
  const reopened = importedNativeDeck(saved)
  expect(reopened.slides[0]!.elements.find(element => element.id === text.id)).toMatchObject({kind: "text", body: {paragraphs: expect.arrayContaining([expect.objectContaining({id: paragraph.id, marker: paragraph.marker})])}})
  const second = await importPptx(await writeNativeSavedPptx(reopened, edited.history.seq, savedBytes, {}))
  expect(second.parts.get("ppt/slides/slide1.xml")).toEqual(saved.parts.get("ppt/slides/slide1.xml"))
  for (const [part, value] of original.parts) if (!["[Content_Types].xml", "ppt/slides/slide1.xml"].includes(part)) expect(second.parts.get(part), part).toEqual(value)
})


it.each(Object.keys(supportedNumberSchemes))("roundtrips supported %s through the common domain and OOXML codec", scheme => {
  const marker = numberMarkerFromScheme(scheme, 4)
  if (marker.kind !== "number") throw new Error("supported-marker-required")
  expect(numberMarkerScheme(marker)).toBe(scheme)
  const body = decodeLegacyRunsV2([{text: "neighbor", font: "Arial", size: 20, color: "#123456", bold: false}], id("schemeFrame"), id("schemeParagraph"))
  body.paragraphs[0].marker = marker
  const xml = writeTextBody(body), document = parseXml(Buffer.from(xml)), root = document.nodes.find(node => node.local === "txBody")!
  expect(xml).toContain(`type="${scheme}"`)
  expect(readTextBody(document, root, id("schemeImported")).paragraphs[0].marker).toEqual(marker)
  const expected = marker.format === "decimal" ? "4" : marker.format === "alphaLower" ? "d" : marker.format === "alphaUpper" ? "D" : marker.format === "romanLower" ? "iv" : "IV"
  expect(numberMarkerLabel(marker, 4)).toEqual({kind: "supported", text: marker.punctuation === "plain" ? expected : marker.punctuation === "parentheses" ? "(" + expected + ")" : marker.punctuation === "right-parenthesis" ? expected + ")" : expected + "."})
})
it("refuses invented source schemes and unsafe numeral rendering", () => {
  expect(() => numberMarkerFromScheme("inventedPeriod", null)).toThrow("invalid-number-scheme")
  expect(numberMarkerLabel({kind: "number", format: "romanUpper", start: null}, 4000)).toEqual({kind: "unavailable", reason: "counter-range"})
  expect(numberMarkerLabel({kind: "number", format: "alphaLower", start: null}, Number.MAX_SAFE_INTEGER)).toEqual({kind: "unavailable", reason: "counter-range"})
})


it("projects marker edits and restores exact presentation on undo and redo", async () => {
  const original = await cascadeSource('<a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Marker edit</a:t></a:r></a:p>')
  const deck = importedNativeDeck(original), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const paragraph = text.body.paragraphs[9]!
  const changed = executeNative(initialNativeHistory(deck), {id: commandId("presentation-edit"), kind: "patch", target: paragraph.id, fields: {marker: {kind: "number", format: "romanUpper", punctuation: "parentheses", start: 4}}, base: 0, run: null})
  expect(changed.receipt.kind).toBe("applied")
  const current = (value: typeof deck) => {
    const element = value.slides[0]!.elements.find(element => element.id === text.id)
    if (element?.kind !== "text") throw new Error("native-text-required")
    return element.body.paragraphs[9]!
  }
  expect(current(changed.history.deck)).toMatchObject({id: paragraph.id, marker: {kind: "number", format: "romanUpper", punctuation: "parentheses", start: 4}})
  const undone = executeNative(changed.history, {id: commandId("presentation-undo"), kind: "undo", target: commandId("presentation-edit")})
  expect(undone.receipt.kind).toBe("applied")
  expect(current(undone.history.deck)).toEqual(paragraph)
  const redone = executeNative(undone.history, {id: commandId("presentation-redo"), kind: "redo", target: commandId("presentation-edit")})
  expect(redone.receipt.kind).toBe("applied")
  expect(current(redone.history.deck)).toEqual(current(changed.history.deck))
})

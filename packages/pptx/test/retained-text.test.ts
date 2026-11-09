import {readFile} from "node:fs/promises"
import {expect, it} from "vitest"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedDeck, importedNativeDeck} from "../src/import-deck.ts"
import {flatten} from "../../deck/src/elements.ts"

it("admits nested source text without changing the frozen corpus denominator", async () => {
  const source = await importPptx(await readFile(new URL("./corpus/dalrrd.pptx", import.meta.url)))
  const deck = importedNativeDeck(source)
  expect(deck.slides.flatMap(slide => flatten(slide.elements)).filter(element => element.kind === "text" && element.support.kind === "native").length).toBeGreaterThanOrEqual(234)
  expect(deck.slides.some(slide => slide.elements.some(element => element.kind === "group" && element.support.kind === "native"))).toBe(true)
})

import {retainedTextSource} from "./text-cascade-fixture.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {assertNativeSourceTextEdits} from "../src/text/source-edits.ts"
import {nativeHistoryModel} from "../../change-log/src/text/native-model.ts"
import {parseXml} from "../src/xml.ts"

it("edits nested source paragraphs while retaining transforms, fields, symbol metadata and independent end styles", async () => {
  const original = await retainedTextSource(), bytes = await exportPptx(original), deck = importedNativeDeck(original)
  const text = flatten(deck.slides[0]!.elements).find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text" || text.source.kind !== "original") throw new Error("nested-text-required")
  expect(text.body.frame.spacingAtEdges).toBe(true)
  const paragraph = text.body.paragraphs[9]!
  expect(paragraph.tabSize).toBe(48)
  expect(paragraph.runs[0]).toMatchObject({kind: "text", text: "Editable\tinput \uf0e0", style: {symbolFont: "Wingdings"}})
  const edit = nativeHistoryModel.apply(deck, {changes: [{kind: "set", target: paragraph.id, value: {...paragraph, alignment: "center", runs: paragraph.runs.map((run, index) => index === 0 && run.kind === "text" ? {...run, text: "Changed\tinput \uf0e0", style: {...run.style, bold: false}} : run)}}]})
  if (!edit.ok) throw new Error("native-edit-required")
  await expect(writeNativeSavedPptx(edit.deck, 1, null, {})).rejects.toThrow("source-group-archive-required")
  await assertNativeSourceTextEdits(bytes, edit.deck)
  const saved = await importPptx(await writeNativeSavedPptx(edit.deck, 1, bytes, {})), again = await importPptx(await writeNativeSavedPptx(edit.deck, 1, bytes, {}))
  for (const [part, value] of original.parts) if (!["[Content_Types].xml", "ppt/slides/slide1.xml"].includes(part)) expect(saved.parts.get(part), part).toEqual(value)
  for (const [part, value] of saved.parts) expect(again.parts.get(part), part).toEqual(value)
  const xml = saved.parts.get("ppt/slides/slide1.xml")!.toString()
  expect(xml).toContain('<a:sym typeface="Wingdings" pitchFamily="2" charset="2"/>')
  expect(xml).toContain('<a:hlinkClick r:id="retained-link" tooltip="Original"/>')
  expect(xml).toContain('type="slidenum"><a:t>42</a:t>')
  const strip = (value: Buffer) => { const parsed = parseXml(value), body = parsed.nodes.filter(node => node.local === "txBody").at(-1)!; return parsed.xml.slice(0, body.start) + parsed.xml.slice(body.end) }
  expect(strip(saved.parts.get("ppt/slides/slide1.xml")!)).toBe(strip(original.parts.get("ppt/slides/slide1.xml")!))
  const sourceId = text.source.objectId
  const reopened = flatten(importedNativeDeck(saved).slides[0]!.elements).find(element => element.source.kind === "original" && element.source.objectId === sourceId)
  expect(reopened).toMatchObject({body: {frame: {spacingAtEdges: true}, paragraphs: expect.arrayContaining([expect.objectContaining({alignment: "center", tabSize: 48, runs: expect.arrayContaining([expect.objectContaining({text: "Changed\tinput \uf0e0", style: expect.objectContaining({symbolFont: "Wingdings", bold: false})})])})])}})
  const destructive = structuredClone(edit.deck), group = destructive.slides[0]!.elements.find(element => element.kind === "group")
  if (group?.kind !== "group" || !group.coordinateSpace) throw new Error("source-group-required")
  group.coordinateSpace.x++
  await expect(assertNativeSourceTextEdits(bytes, destructive)).rejects.toThrow("source group coordinates or topology")
  const removed = structuredClone(edit.deck)
  removed.slides[0]!.elements = removed.slides[0]!.elements.filter(element => element.kind !== "group")
  await expect(assertNativeSourceTextEdits(bytes, removed, edit.deck)).rejects.toThrow("source topology")
  const font = structuredClone(edit.deck), next = flatten(font.slides[0]!.elements).find(element => element.id === text.id)
  if (next?.kind !== "text") throw new Error("nested-text-required")
  next.body.paragraphs[9]!.runs[0]!.style.symbolFont = "Other"
  await expect(assertNativeSourceTextEdits(bytes, font)).rejects.toThrow("font fallback metadata")
})

import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"

it("retains legacy kept groups through history conversion without inventing child histories", async () => {
  const original = await retainedTextSource(), bytes = await exportPptx(original), legacy = importedDeck(original)
  const migrated = transduceLegacyHistory({version: 2, history: initialHistory(legacy), immutable: {version: 2, events: [], receipts: []}}).history
  const group = migrated.deck.slides[0]!.elements.find(element => element.source.kind === "original" && element.source.objectId.startsWith("grpSp:"))
  expect(group).toMatchObject({kind: "shape", support: {kind: "kept"}})
  const saved = await importPptx(await writeNativeSavedPptx(migrated.deck, migrated.seq, bytes, {}))
  for (const [part, value] of original.parts) if (part !== "[Content_Types].xml") expect(saved.parts.get(part), part).toEqual(value)
})

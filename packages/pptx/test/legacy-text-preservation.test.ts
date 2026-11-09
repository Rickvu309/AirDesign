import {expect, it} from "vitest"
import {commandId} from "../../change-log/src/index.ts"
import {legacyTape} from "../../change-log/test/text/history-fixture.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {executeNative} from "../../change-log/src/text/native-model.ts"
import {parseNativeArchiveV3} from "../../deck/src/text/native-v3.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedDeck, importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {parseXml} from "../src/xml.ts"
import {cascadeSource} from "./text-cascade-fixture.ts"

it("preserves original multiparagraph bytes across retained inactive legacy history, native edits and repeated exports", async () => {
  const original = await cascadeSource(), source = await exportPptx(original), legacy = importedDeck(original)
  const text = legacy.slides[0]!.elements.find(element => element.kind === "text" && element.runs.length === 8)
  if (text?.kind !== "text") throw new Error("legacy-text-required")
  const tape = legacyTape(legacy)
  expect(tape.send({id: commandId("start-agent"), kind: "start-run", run: "agent"}).kind).toBe("applied")
  expect(tape.patch("inactive", text.id, {runs: text.runs.map(run => ({...run, text: run.text + " agent"}))}, "agent").kind).toBe("applied")
  expect(tape.send({id: commandId("undo-agent"), kind: "undo-run", run: "agent"}).kind).toBe("applied")
  const converted = transduceLegacyHistory(tape.archive), history = converted.history
  const bodyText = history.deck.slides[0]!.elements.find(element => element.id === text.id)
  if (bodyText?.kind !== "text") throw new Error("native-text-required")
  expect(bodyText.body.paragraphs).toHaveLength(1)
  expect(bodyText.body.paragraphs[0].runs.filter(run => run.kind === "break")).toHaveLength(7)
  expect(converted.immutable).toEqual(tape.archive.immutable)
  expect(history.events.filter(event => !event.active)).toHaveLength(1)
  const unchanged = await importPptx(await writeNativeSavedPptx(history.deck, history.seq, source, {}))
  for (const [part, bytes] of original.parts) if (part !== "[Content_Types].xml") expect(unchanged.parts.get(part), part).toEqual(bytes)
  expect(bodyText.source).toMatchObject({textVersion: 2})
  const paragraph = bodyText.body.paragraphs[0], runs = paragraph.runs.map(run => run.kind === "text" && run.text === "Level 2" ? {...run, text: "Person changed & retained"} : run)
  const edited = executeNative(history, {id: commandId("person-text"), kind: "patch", base: history.seq, run: null, target: paragraph.id, fields: {runs}})
  expect(edited.receipt.kind).toBe("applied")
  const deck = parseNativeArchiveV3(JSON.parse(JSON.stringify({version: 3, deck: edited.history.deck}))).deck
  deck.slides[0]!.notes = "Changed notes"
  const saved = await writeNativeSavedPptx(deck, edited.history.seq, source, {}), reopened = await importPptx(saved)
  for (const [part, bytes] of original.parts) if (!["[Content_Types].xml", "ppt/slides/slide1.xml", "ppt/notesSlides/notesSlide1.xml"].includes(part)) expect(reopened.parts.get(part), part).toEqual(bytes)
  const before = parseXml(original.parts.get("ppt/slides/slide1.xml")!), after = parseXml(reopened.parts.get("ppt/slides/slide1.xml")!)
  expect(after.xml).toBe(before.xml.replace("Level 2", "Person changed &amp; retained"))
  expect(after.nodes.filter(node => node.local === "r")).toHaveLength(before.nodes.filter(node => node.local === "r").length)
  expect(importedNativeDeck(reopened).slides[0]!.notes).toBe("Changed notes")
  const repeated = await importPptx(await writeNativeSavedPptx(deck, edited.history.seq, source, {}))
  for (const [part, bytes] of reopened.parts) expect(repeated.parts.get(part), part).toEqual(bytes)
  const unsafe = structuredClone(deck), unsafeText = unsafe.slides[0]!.elements.find(element => element.id === text.id)
  if (unsafeText?.kind !== "text") throw new Error("native-text-required")
  unsafeText.body.paragraphs[0].alignment = "right"
  const retained = JSON.stringify(edited.history), immutable = JSON.stringify(converted.immutable)
  await expect(writeNativeSavedPptx(unsafe, edited.history.seq, source, {})).rejects.toThrow("source-text-format-preservation-required")
  expect(JSON.stringify(edited.history)).toBe(retained)
  expect(JSON.stringify(converted.immutable)).toBe(immutable)
  expect(original.parts.get("ppt/slides/slide1.xml")!.toString()).toBe(before.xml)
})

it("retains unrepresented legacy source through cutover and refuses its changed text without rewriting fields", async () => {
  const original = await cascadeSource('<a:p><a:fld id="retained" type="slidenum"><a:t>42</a:t></a:fld></a:p>'), source = await exportPptx(original)
  const legacy = importedDeck(original), text = legacy.slides[0]!.elements.find(element => element.kind === "text" && element.runs.length === 9)
  if (text?.kind !== "text") throw new Error("legacy-field-required")
  const converted = transduceLegacyHistory(legacyTape(legacy).archive), before = JSON.stringify(converted)
  const unchanged = await importPptx(await writeNativeSavedPptx(converted.history.deck, 0, source, {}))
  expect(unchanged.parts.get("ppt/slides/slide1.xml")).toEqual(original.parts.get("ppt/slides/slide1.xml"))
  const candidate = structuredClone(converted.history.deck), native = candidate.slides[0]!.elements.find(element => element.id === text.id)
  if (native?.kind !== "text") throw new Error("native-text-required")
  const run = native.body.paragraphs[0].runs.find(run => run.kind === "text")
  if (run?.kind !== "text") throw new Error("run-required")
  run.text = "Changed"
  await expect(writeNativeSavedPptx(candidate, 1, source, {})).rejects.toThrow("source-text-format-preservation-required")
  expect(JSON.stringify(converted)).toBe(before)
})

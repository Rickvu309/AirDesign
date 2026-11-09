import {expect, it} from "vitest"
import {readFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import manifest from "./manifest.json"
import {importPptx} from "../../src/index.ts"
import {importedNativeDeck} from "../../src/import-deck.ts"
import {writeNativeSavedPptx} from "../../src/export-deck.ts"
import {nativeHistoryModel} from "../../../change-log/src/text/native-model.ts"

it("freezes production baseline provenance and original corpus mapping", async () => {
  expect(createHash("sha256").update(await readFile(new URL("./manifest.json", import.meta.url))).digest("hex")).toBe("3b651badafecdfdafb58e698529c761a42251fd5b4997a5f9126a475ea78cad2")
  expect(manifest.baselineCommit).toBe("fb80111f04c4401b5101fb4e6449094f8e4443e2")
  expect(manifest.decks.map(deck => [deck.id, deck.boxes.length, deck.baselineNative.length])).toEqual([["dalrrd", 236, 197], ["cogta", 75, 73], ["performance", 257, 184], ["vssut", 142, 132], ["liberia", 320, 248], ["cfsg", 72, 54], ["governance", 136, 136]])
})

it.each(manifest.decks)("preserves original OPC bytes and saves a canonical editable paragraph in $id", async entry => {
  const bytes = await readFile(new URL(`./${entry.id}.pptx`, import.meta.url))
  expect(bytes.length).toBe(entry.bytes)
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256)
  const original = await importPptx(bytes), deck = importedNativeDeck(original)
  const removals = (source: typeof original) => source.report.removals.map(({provenance, ...removal}) => {void provenance; return removal})
  const metadata = ["[Content_Types].xml", "airdesign/security-removals.json"]
  const unchanged = await importPptx(await writeNativeSavedPptx(deck, 0, bytes, {}))
  for (const [part, value] of original.parts) if (!metadata.includes(part)) expect(unchanged.parts.get(part), part).toEqual(value)
  expect(removals(unchanged)).toEqual(removals(original))
  const slide = deck.slides.find(slide => slide.elements.some(element => element.kind === "text" && element.support.kind === "native"))
  const text = slide?.elements.find(element => element.kind === "text" && element.support.kind === "native")
  if (!slide || text?.kind !== "text" || text.source.kind !== "original") throw new Error("corpus-editable-text-required")
  const paragraph = text.body.paragraphs[0], alignment = paragraph.alignment === "left" ? "center" : "left"
  const edit = nativeHistoryModel.apply(deck, {changes: [{kind: "set", target: paragraph.id, value: {...paragraph, alignment}}]})
  if (!edit.ok) throw new Error("corpus-native-edit-refused")
  const savedBytes = await writeNativeSavedPptx(edit.deck, 1, bytes, {}), saved = await importPptx(savedBytes)
  const reopened = importedNativeDeck(saved).slides.find(candidate => candidate.id === slide.id)?.elements.find(candidate => candidate.id === text.id)
  expect(reopened).toMatchObject({kind: "text", body: {paragraphs: expect.arrayContaining([expect.objectContaining({id: paragraph.id, alignment})])}})
  for (const [part, value] of original.parts) if (![...metadata, text.source.part].includes(part)) expect(saved.parts.get(part), part).toEqual(value)
  expect(removals(saved)).toEqual(removals(original))
  const repeated = await importPptx(await writeNativeSavedPptx(edit.deck, 1, bytes, {}))
  for (const [part, value] of saved.parts) expect(repeated.parts.get(part), part).toEqual(value)
}, 30000)

import {expect, it} from "vitest"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {id} from "../../deck/src/model.ts"
import {initialHistory} from "../../change-log/src/index.ts"
import {transduceLegacyHistory} from "../../change-log/src/text/history-transducer.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {parseXml} from "../src/xml.ts"
import {readTextBody, writeTextBody} from "../src/text/body.ts"

function fixture() {
  const deck = transduceLegacyHistory({version: 2, history: initialHistory(fixtureDeck(2, 2)), immutable: {version: 2, events: [], receipts: []}}).history.deck
  const text = deck.slides[0]!.elements[0]!
  if (text.kind !== "text") throw new Error("fixture-text")
  const paragraph = text.body.paragraphs[0]
  paragraph.runs = [{kind: "text", text: "First & styled", style: {...paragraph.endStyle, italic: true, underline: true}}, {kind: "break", style: paragraph.endStyle}, {kind: "text", text: "Explicit break", style: paragraph.endStyle}]
  paragraph.alignment = "right"; paragraph.level = 2
  paragraph.indentation = {left: 24, right: 8, firstLine: -12}
  paragraph.marker = {kind: "number", format: "romanUpper", start: 4}
  paragraph.spacing = {before: 8, after: 12, line: {kind: "points", value: 32}}
  text.body.paragraphs.push({...structuredClone(paragraph), id: id("continuation"), marker: {kind: "number", format: "romanUpper", start: null}, runs: []})
  text.body.paragraphs.push({...structuredClone(paragraph), id: id("bullet"), marker: {kind: "bullet", character: "•"}, alignment: "justify", runs: [], endStyle: {...paragraph.endStyle, size: 24}})
  text.body.frame.anchor = "bottom"
  text.body.frame.insets = {top: 4, right: 8, bottom: 12, left: 16}
  text.body.frame.autofit = {kind: "shrink", fontScale: 0.8, lineReduction: 0.1}
  return {deck, text}
}
it("saves and reimports native paragraphs, explicit breaks, empty end styles and text frames", async () => {
  const {deck, text} = fixture()
  const presentation = await importPptx(await writeNativeSavedPptx(deck, 7, null, {}))
  const reopened = importedNativeDeck(presentation), actual = reopened.slides[0]!.elements.find(element => element.kind === "text")
  if (actual?.kind !== "text") throw new Error("text-required")
  expect(actual.body.frame).toMatchObject({...text.body.frame, id: actual.body.frame.id})
  expect(actual.body.paragraphs).toHaveLength(3)
  actual.body.paragraphs.forEach((paragraph, index) => expect(paragraph).toMatchObject({...text.body.paragraphs[index], id: paragraph.id}))
  expect(JSON.parse(presentation.parts.get("airdesign/saved-version.json")!.toString())).toMatchObject({version: 3, seq: 7, deck})
})
it("changes only the original text body and preserves every sibling OPC part", async () => {
  const {deck} = fixture(), source = await writeNativeSavedPptx(deck, 0, null, {}), original = await importPptx(source), imported = importedNativeDeck(original)
  const text = imported.slides[0]!.elements.find(element => element.kind === "text")
  if (text?.kind !== "text") throw new Error("text-required")
  const unchanged = await importPptx(await writeNativeSavedPptx(imported, 0, source, {}))
  for (const [part, bytes] of original.parts) if (part !== "airdesign/saved-version.json") expect(unchanged.parts.get(part), part).toEqual(bytes)
  text.body.paragraphs[0].alignment = "center"
  text.body.paragraphs[1]!.runs = [{kind: "text", text: "Later saved text", style: text.body.paragraphs[1]!.endStyle}]
  const changed = await importPptx(await writeNativeSavedPptx(imported, 1, source, {}))
  for (const [part, bytes] of original.parts) if (!["airdesign/saved-version.json", "ppt/slides/slide1.xml"].includes(part)) expect(changed.parts.get(part), part).toEqual(bytes)
  const before = parseXml(original.parts.get("ppt/slides/slide1.xml")!), after = parseXml(changed.parts.get("ppt/slides/slide1.xml")!)
  const withoutBody = (parsed: ReturnType<typeof parseXml>) => {const body = parsed.nodes.find(node => node.local === "txBody")!; return parsed.xml.slice(0, body.start) + parsed.xml.slice(body.end)}
  expect(withoutBody(after)).toBe(withoutBody(before))
  expect(importedNativeDeck(changed).slides[0]!.elements[0]).toMatchObject({body: {paragraphs: [{alignment: "center"}, {runs: [{text: "Later saved text"}]}, {}]}})
})
it("inherits trailing empty insertion styles and visibly refuses unknown source formatting changes", async () => {
  const {text, deck} = fixture(), xml = writeTextBody(text.body).replace(/<a:endParaRPr[^>]*>[\s\S]*?<\/a:endParaRPr>/g, ""), parsed = parseXml(Buffer.from(xml))
  const body = readTextBody(parsed, parsed.nodes[0]!, id("inherit"))
  expect(body.paragraphs[1]!.endStyle).toEqual(body.paragraphs[0].endStyle)
  const original = await importPptx(await writeNativeSavedPptx(deck, 0, null, {})), parts = new Map(original.parts)
  parts.set("ppt/slides/slide1.xml", Buffer.from(parts.get("ppt/slides/slide1.xml")!.toString().replace('<a:bodyPr ', '<a:bodyPr vert="vert" ')))
  expect(parseXml(parts.get("ppt/slides/slide1.xml")!).nodes.find(node => node.local === "bodyPr")?.attributes.vert).toBe("vert")
  const source = await exportPptx({...original, parts}), imported = importedNativeDeck(await importPptx(source)), element = imported.slides[0]!.elements[0]!
  expect(element.support.kind).toBe("kept")
  const unchanged = await importPptx(await writeNativeSavedPptx(imported, 0, source, {}))
  for (const [part, bytes] of parts) if (part !== "airdesign/saved-version.json") expect(unchanged.parts.get(part), part).toEqual(bytes)
  element.box.width += 1
  await expect(writeNativeSavedPptx(imported, 1, source, {})).rejects.toThrow("source-object-change-requires-fix")
})

it("keeps original text body identities when earlier edits change the number of XML runs", async () => {
  const {deck, text} = fixture()
  const second = structuredClone(text)
  second.id = id("second")
  second.body.frame.id = id("secondFrame")
  second.body.paragraphs.forEach((paragraph, index) => {paragraph.id = id(`secondP${index}`)})
  deck.slides[0]!.elements.push(second)
  const source = await writeNativeSavedPptx(deck, 0, null, {}), imported = importedNativeDeck(await importPptx(source))
  const texts = imported.slides[0]!.elements.filter(element => element.kind === "text")
  const first = texts[0]!, later = texts[1]!
  first.body.paragraphs[0].runs = []
  later.body.paragraphs[0].runs = [{kind: "text", text: "Second body changed", style: later.body.paragraphs[0].endStyle}]
  const reopened = importedNativeDeck(await importPptx(await writeNativeSavedPptx(imported, 1, source, {})))
  const actual = reopened.slides[0]!.elements.filter(element => element.kind === "text")
  expect(actual[0]!.body.paragraphs[0].runs).toEqual([])
  expect(actual[1]!.body.paragraphs[0].runs).toMatchObject([{text: "Second body changed"}])
})

import {expect, it} from "vitest"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {paragraphNumbers} from "../../deck/src/text/numbering.ts"
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


it.each(["<a:normAutofit/>", '<a:normAutofit fontScale="100000"/>', '<a:normAutofit fontScale="62500" lnSpcReduction="12345"/>', '<a:normAutofit fontScale="+62500" lnSpcReduction="+12345"/>', '<a:normAutofit fontScale=" 62500 " lnSpcReduction=" 12345 "/>', '<a:normAutofit fontScale="62.5%" lnSpcReduction="12.345%"/>'])("retains saved autofit source exactly across unrelated edits and repeated saves: %s", async fit => {
  const {deck} = fixture(), initial = await importPptx(await writeNativeSavedPptx(deck, 0, null, {})), parts = new Map(initial.parts), part = "ppt/slides/slide1.xml"
  parts.set(part, Buffer.from(parts.get(part)!.toString().replace(/<a:normAutofit[^>]*\/>/, fit)))
  let source = await exportPptx({...initial, parts})
  for (const seq of [1, 2]) {
    const original = await importPptx(source), current = importedNativeDeck(original), text = current.slides[0]!.elements.find(element => element.kind === "text")
    if (text?.kind !== "text") throw new Error("native-saved-autofit-required")
    expect(text.body.frame.autofit).toEqual(fit.includes("62500") || fit.includes("62.5%") ? {kind: "shrink", fontScale: 0.625, lineReduction: 0.12345} : {kind: "shrink", fontScale: fit.includes("100000") ? 1 : null, lineReduction: null})
    text.body.paragraphs[0].alignment = seq === 1 ? "center" : "left"
    source = await writeNativeSavedPptx(current, seq, source, {})
    const saved = await importPptx(source)
    expect(saved.parts.get(part)!.toString()).toContain(fit)
    for (const [name, bytes] of original.parts) if (![part, "airdesign/saved-version.json"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
  }
})

it("separates numeric state from period scheme XML for empty, restart and interrupted paragraphs", () => {
  const {text} = fixture(), first = text.body.paragraphs[0]
  first.marker = {kind: "number", format: "alphaLower", start: 26}
  first.level = 0
  first.runs = []
  text.body.paragraphs = [first]
  const add = (level: number, start: number | null) => text.body.paragraphs.push({...structuredClone(first), id: id(`counter${text.body.paragraphs.length}`), level, marker: {kind: "number", format: "alphaLower", start}})
  add(0, null); add(0, 26); add(0, 31); add(1, null); add(0, null)
  text.body.paragraphs.push({...structuredClone(first), id: id("interruption"), marker: {kind: "none"}})
  add(0, null)
  const xml = writeTextBody(text.body), document = parseXml(Buffer.from(xml)), reopened = readTextBody(document, document.nodes[0]!, id("counters"))
  expect(paragraphNumbers(reopened.paragraphs)).toEqual([26, 27, 26, 31, 1, 32, null, 1])
  expect(document.nodes.filter(node => node.local === "buAutoNum").map(node => node.attributes)).toEqual([26, null, 26, 31, null, null, null].map(start => ({type: "alphaLcPeriod", ...(start === null ? {} : {startAt: String(start)})})))
})


it.each(["%", "  %", "NaN", "0.125", "12%%"])("refuses malformed autofit percentage lexemes: %s", value => {
  const {text} = fixture(), xml = writeTextBody(text.body).replace(/lnSpcReduction="[^"]*"/, `lnSpcReduction="${value}"`), document = parseXml(Buffer.from(xml))
  expect(document.nodes.find(node => node.local === "normAutofit")?.attributes.lnSpcReduction).toBe(value)
  expect(() => readTextBody(document, document.nodes[0]!, id("invalidFit"))).toThrow()
})


it("roundtrips every positive thousandth-percent autofit scale without double rounding", () => {
  const {text} = fixture(), paragraph = text.body.paragraphs[0]
  paragraph.runs = []
  text.body.paragraphs = [paragraph]
  const changed: number[] = []
  for (let integer = 1; integer <= 100000; integer++) {
    const value = integer / 100000
    text.body.frame.autofit = {kind: "shrink", fontScale: value, lineReduction: value === 1 ? 0 : value}
    const document = parseXml(Buffer.from(writeTextBody(text.body)))
    const fit = readTextBody(document, document.nodes[0]!, id("grid")).frame.autofit
    if (fit.kind !== "shrink" || fit.fontScale !== value || fit.lineReduction !== (value === 1 ? 0 : value)) changed.push(integer)
  }
  expect({count: changed.length, first: changed.slice(0, 10)}).toEqual({count: 0, first: []})
}, 60000)

it.each([Number.MIN_VALUE, 1e-310, 1e-10, 1e-7, 0.00007, 0.00009, 0.62512345, 0.12345678901234566, 0.9999999999999999, 1])("roundtrips exact autofit doubles including exponent boundaries: %s", value => {
  const {text} = fixture()
  text.body.frame.autofit = {kind: "shrink", fontScale: value, lineReduction: value === 1 ? 0 : value}
  const document = parseXml(Buffer.from(writeTextBody(text.body)))
  expect(readTextBody(document, document.nodes[0]!, id("precision")).frame.autofit).toEqual(text.body.frame.autofit)
})

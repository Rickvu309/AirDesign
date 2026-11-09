import {expect, it} from "vitest"
import {cascadeSource} from "./text-cascade-fixture.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {parseXml} from "../src/xml.ts"
import {resolvedColor, emptyContext} from "../src/text/cascade.ts"
import {commandId} from "../../change-log/src/index.ts"
import {executeNative, initialNativeHistory} from "../../change-log/src/text/native-model.ts"
import {parseNativeArchiveV3} from "../../deck/src/text/native-v3.ts"

const payload = '<a:p><a:pPr fontAlgn="ctr"><a:spcBef><a:spcPct val="50000"/></a:spcBef><a:spcAft><a:spcPts val="300"/></a:spcAft><a:buClr><a:srgbClr val="336699"><a:lumMod val="50000"/><a:lumOff val="20000"/></a:srgbClr></a:buClr><a:buSzPct val="75000"/><a:buChar char="•"/></a:pPr><a:r><a:rPr><a:solidFill><a:srgbClr val="336699"><a:lumMod val="50000"/><a:alpha val="50000"/></a:srgbClr></a:solidFill><a:highlight><a:srgbClr val="ffff00"/></a:highlight><a:hlinkClick r:id="retained-link" tooltip="Keep me"/></a:rPr><a:t>Editable metrics</a:t></a:r><a:endParaRPr sz="2400"/></a:p>'

it("edits native compatibility metrics, percentage spacing, glyphs and bullet presentation through saved history", async () => {
  const source = await cascadeSource(payload), parts = new Map(source.parts), part = "ppt/slides/slide1.xml"
  parts.set(part, Buffer.from(parts.get(part)!.toString().replace('<a:bodyPr rIns="47625"/>', '<a:bodyPr rIns="47625" compatLnSpc="1" vert="vert270" wrap="none"/>')))
  const original = await importPptx(await exportPptx({...source, parts})), bytes = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-metrics-required")
  expect(text.body.frame).toMatchObject({compatibilityLineSpacing: true, verticalFlow: "vertical270", wrap: "none"})
  const paragraph = text.body.paragraphs[9]!
  expect(paragraph).toMatchObject({glyphAlignment: "center", spacing: {before: {kind: "multiple", value: 0.5}, after: 4}, marker: {kind: "bullet", color: "#336699", size: {kind: "multiple", value: 0.75}}, runs: [{style: {color: "#1a334d", opacity: 0.5, highlight: "#ffff00"}}]})
  if (paragraph.marker.kind !== "bullet") throw new Error("bullet-required")
  const history = initialNativeHistory(deck), result = executeNative(history, {id: commandId("metrics"), run: null, kind: "edit", base: 0, changes: {changes: [{kind: "set", target: paragraph.id, value: {...paragraph, alignment: "center", marker: {...paragraph.marker, size: {kind: "points", value: 18}}, runs: paragraph.runs.map(run => run.kind === "text" ? {...run, text: "Edited metrics", style: {...run.style, bold: true}} : run)}}]}}, {kind: "person"})
  expect(result.receipt.kind).toBe("applied")
  const reopened = parseNativeArchiveV3({version: 3, deck: result.history.deck}).deck
  const exported = await importPptx(await writeNativeSavedPptx(reopened, 1, bytes, {})), xml = exported.parts.get(part)!.toString()
  expect(xml).toContain('<a:lumMod val="50000"/><a:alpha val="50000"/>')
  expect(xml).toContain('<a:hlinkClick r:id="retained-link" tooltip="Keep me"/>')
  expect(xml).toContain('val="1350"')
  const imported = importedNativeDeck(exported), edited = imported.slides[0]!.elements.find(element => element.id === text.id)
  expect(edited).toMatchObject({kind: "text", body: {frame: text.body.frame, paragraphs: expect.arrayContaining([expect.objectContaining({glyphAlignment: "center", alignment: "center", marker: {kind: "bullet", character: "•", color: "#336699", size: {kind: "points", value: 18}}, endStyle: expect.objectContaining(paragraph.endStyle), runs: [expect.objectContaining({text: "Edited metrics", style: expect.objectContaining({opacity: 0.5, highlight: "#ffff00", bold: true})})]})])}})
  for (const [name, value] of original.parts) if (name !== part && !["[Content_Types].xml", "airdesign/security-removals.json"].includes(name)) expect(exported.parts.get(name), name).toEqual(value)
  const repeated = await importPptx(await writeNativeSavedPptx(reopened, 1, bytes, {}))
  expect(repeated.parts.get(part)).toEqual(exported.parts.get(part))
})

it("evaluates ordered luminance and alpha without weakening transform guards", () => {
  const color = (transforms: string) => {
    const document = parseXml(Buffer.from(`<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:srgbClr val="336699">${transforms}</a:srgbClr></a:solidFill>`))
    return resolvedColor(document, document.nodes[0]!, emptyContext())
  }
  expect(color('<a:lumMod val="50000"/><a:lumOff val="20000"/>')).toBe("#336699")
  expect(color('<a:lumOff val="20000"/><a:lumMod val="50000"/>')).toBe("#264d73")
  expect(() => color('<a:lumMod val="-1"/>')).toThrow("color transform")
  expect(() => color('<a:alpha val="100001"/>')).toThrow("color transform")
  expect(() => color('<a:unknown val="50000"/>')).toThrow("color transform")
})

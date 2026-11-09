import {readFile, mkdir, writeFile} from "node:fs/promises"
import {expect, it} from "vitest"
import {flatten} from "../../deck/src/elements.ts"
import {nativeHistoryModel} from "../../change-log/src/text/native-model.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {assertNativeSourceTextEdits} from "../src/text/source-edits.ts"
import {readTextBody, writeTextBody} from "../src/text/body.ts"
import {parseXml} from "../src/xml.ts"
import {affineTextShadowXml, shadowTextSource} from "./text-cascade-fixture.ts"

it("preserves nested affine source shadows and independent end styles through native edits and repeat export", async () => {
  const source = await shadowTextSource(), bytes = await exportPptx(source), deck = importedNativeDeck(source)
  const text = flatten(deck.slides[0]!.elements).find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("shadow-text-required")
  const paragraph = text.body.paragraphs[9]!, shadow = paragraph.runs[0]!.style.outerShadow
  expect(shadow).toEqual({kind: "outer", blur: 60007 / 9525, distance: 310007 / 9525, direction: 128, scale: {x: 1, y: 0.3}, skew: {x: 21.67, y: 0}, alignment: "ctr", rotateWithShape: false, color: "#000000", opacity: 0.32})
  const value = {...paragraph, runs: paragraph.runs.map((run, index) => index === 0 && run.kind === "text" ? {...run, text: "Changed\tinput \uf0e0", style: {...run.style, bold: !run.style.bold}} : {...run, style: {...run.style, italic: !run.style.italic}})}
  const applied = nativeHistoryModel.apply(deck, {changes: [{kind: "set", target: paragraph.id, value}]})
  if (!applied.ok) throw new Error("shadow-edit-required")
  await assertNativeSourceTextEdits(bytes, applied.deck)
  const saved = await importPptx(await writeNativeSavedPptx(applied.deck, 1, bytes, {})), repeated = await importPptx(await writeNativeSavedPptx(applied.deck, 1, bytes, {}))
  const xml = saved.parts.get("ppt/slides/slide1.xml")!.toString()
  expect(xml.split(affineTextShadowXml).length).toBe(3)
  expect(xml).toContain('<a:sym typeface="Wingdings" pitchFamily="2" charset="2"/>')
  expect(xml).toContain('<a:hlinkClick r:id="retained-link" tooltip="Original"/>')
  for (const [part, original] of source.parts) if (!["[Content_Types].xml", "ppt/slides/slide1.xml"].includes(part)) expect(saved.parts.get(part)?.equals(original), part).toBe(true)
  for (const [part, original] of saved.parts) expect(repeated.parts.get(part)?.equals(original), part).toBe(true)
  const reopened = flatten(importedNativeDeck(saved).slides[0]!.elements).find(element => element.id === text.id)
  expect(reopened).toMatchObject({body: {paragraphs: expect.arrayContaining([expect.objectContaining({endStyle: {...paragraph.endStyle, italic: paragraph.endStyle.italic ?? false, underline: paragraph.endStyle.underline ?? false, strike: paragraph.endStyle.strike ?? false, letterSpacing: paragraph.endStyle.letterSpacing ?? 0, baseline: paragraph.endStyle.baseline ?? 0, capitalization: paragraph.endStyle.capitalization ?? "none"}, runs: expect.arrayContaining([expect.objectContaining({text: "Changed\tinput \uf0e0", style: expect.objectContaining({outerShadow: shadow})})])})])}})
  const destructive = structuredClone(applied.deck), next = flatten(destructive.slides[0]!.elements).find(element => element.id === text.id)
  if (next?.kind !== "text" || !next.body.paragraphs[9]!.runs[0]!.style.outerShadow) throw new Error("shadow-required")
  next.body.paragraphs[9]!.runs[0]!.style.outerShadow.distance++
  await expect(assertNativeSourceTextEdits(bytes, destructive)).rejects.toThrow("source text shadow is source controlled")
})

it.each([{name: "dalrrd", slideNumber: 3, identity: "7"}, {name: "dalrrd", slideNumber: 22, identity: "2"}, {name: "performance", slideNumber: 1, identity: "4"}])("edits the original $name slide $slideNumber shadow identity $identity without changing source effects or siblings", async ({name, slideNumber, identity}) => {
  const bytes = await readFile(new URL(`./corpus/${name}.pptx`, import.meta.url)), source = await importPptx(bytes), deck = importedNativeDeck(source)
  const part = `ppt/slides/slide${slideNumber}.xml`, slide = deck.slides.find(slide => slide.source.kind === "original" && slide.source.part === part)!
  const document = parseXml(source.parts.get(part)!), shape = document.nodes.find(node => node.local === "sp" && document.nodes.some(child => child.local === "cNvPr" && child.attributes.id === identity && child.start > node.start && child.end < node.end))!
  const texts = document.nodes.filter(node => node.local === "t" && node.uri.endsWith("/drawingml/2006/main")), spans = texts.filter(node => node.start > shape.start && node.end < shape.end)
  const objectId = `text:${spans.map(node => texts.indexOf(node)).join(",")}`, text = flatten(slide.elements).find(element => element.source.kind === "original" && element.source.objectId === objectId)
  if (text?.kind !== "text") throw new Error(`native-shadow-required:${name}:${part}#${identity}`)
  const paragraph = text.body.paragraphs.at(-1)!, applied = nativeHistoryModel.apply(deck, {changes: [{kind: "set", target: paragraph.id, value: {...paragraph, alignment: paragraph.alignment === "left" ? "center" : "left", runs: paragraph.runs.map(run => ({...run, style: {...run.style, bold: !run.style.bold}}))}}]})
  if (!applied.ok) throw new Error("native-shadow-edit-required")
  await assertNativeSourceTextEdits(bytes, applied.deck)
  const exported = await writeNativeSavedPptx(applied.deck, 1, bytes, {}), saved = await importPptx(exported), repeated = await importPptx(await writeNativeSavedPptx(importedNativeDeck(saved), 1, exported, {}))
  const effects = (value: Buffer) => { const doc = parseXml(value); return doc.nodes.filter(node => node.local === "effectLst").map(node => doc.xml.slice(node.start, node.end)) }
  expect(effects(saved.parts.get(part)!)).toEqual(effects(source.parts.get(part)!))
  const bodyIndex = document.nodes.filter(node => node.local === "txBody").findIndex(node => node.start > shape.start && node.end < shape.end)
  const strip = (value: Buffer) => {const doc = parseXml(value), body = doc.nodes.filter(node => node.local === "txBody")[bodyIndex]!; return doc.xml.slice(0, body.start) + doc.xml.slice(body.end)}
  expect(strip(saved.parts.get(part)!)).toEqual(strip(source.parts.get(part)!))
  for (const [name, value] of source.parts) if (!["[Content_Types].xml", "airdesign/security-removals.json", part].includes(name)) expect(saved.parts.get(name)?.equals(value), name).toBe(true)
  expect(JSON.parse(saved.parts.get("airdesign/security-removals.json")!.toString())).toEqual(JSON.parse(source.parts.get("airdesign/security-removals.json")!.toString()).map((value: object) => ({...value, provenance: "source-reported"})))
  for (const [name, value] of saved.parts) if(name!=="airdesign/saved-version.json") expect(repeated.parts.get(name)?.equals(value), name).toBe(true)
  expect(JSON.parse(saved.parts.get("airdesign/saved-version.json")!.toString()).deck).toEqual(applied.deck)
  expect(JSON.parse(repeated.parts.get("airdesign/saved-version.json")!.toString()).deck).toEqual(importedNativeDeck(saved))
  const artifacts=process.env.AIRDESIGN_PARAGRAPH_ARTIFACTS
  if(artifacts){await mkdir(artifacts,{recursive:true});await writeFile(`${artifacts}/${name}-slide${slideNumber}-shape${identity}-edited.pptx`,exported);await writeFile(`${artifacts}/${name}-slide${slideNumber}-shape${identity}.json`,JSON.stringify({part,identity,objectId,id:text.id,shapeXml:document.xml.slice(shape.start,shape.end),before:text,after:flatten(importedNativeDeck(saved).slides.find(slide=>slide.source.kind==="original"&&slide.source.part===part)!.elements).find(element=>element.id===text.id),effects:effects(saved.parts.get(part)!)},null,2))}
  const reopened = flatten(importedNativeDeck(saved).slides.find(slide => slide.source.kind === "original" && slide.source.part === part)!.elements).find(element => element.id === text.id)
  expect(reopened).toMatchObject({kind: "text", body: {paragraphs: expect.arrayContaining([expect.objectContaining({alignment: paragraph.alignment === "left" ? "center" : "left"})])}})
}, 120000)

it("writes the strict shared shadow contract into new DrawingML and reads it back", async () => {
  const source = await shadowTextSource(), text = flatten(importedNativeDeck(source).slides[0]!.elements).find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("shadow-text-required")
  const document = parseXml(Buffer.from(writeTextBody(text.body))), body = document.nodes.find(node => node.local === "txBody")!
  const read=readTextBody(document, body, text.id)
  const shadows=(value:typeof read)=>value.paragraphs.flatMap(paragraph=>[paragraph.endStyle.outerShadow,...paragraph.runs.map(run=>run.style.outerShadow)])
  expect(shadows(read)).toEqual(shadows(text.body))
  const repeated=parseXml(Buffer.from(writeTextBody(read)))
  expect(readTextBody(repeated,repeated.nodes.find(node=>node.local==="txBody")!,text.id)).toEqual(read)
})

it.each([affineTextShadowXml.replace('sy="30000"', 'sy="30000" unsupported="1"'), affineTextShadowXml.replace("</a:effectLst>", "<a:innerShdw/></a:effectLst>"), affineTextShadowXml.replace('kx="1300200"', 'kx="5400000"')])("keeps unsupported or invalid shadow semantics guarded", async effect => {
  const source = await shadowTextSource(), parts = new Map(source.parts)
  parts.set("ppt/slides/slide1.xml", Buffer.from(parts.get("ppt/slides/slide1.xml")!.toString().replaceAll(affineTextShadowXml, effect)))
  const deck = importedNativeDeck(await importPptx(await exportPptx({...source, parts})))
  expect(flatten(deck.slides[0]!.elements).some(element => element.kind === "text" && element.body.paragraphs.length === 10)).toBe(false)
})

it("does not project a rotated source shadow as an axis-aligned text effect", async () => {
  const source = await shadowTextSource(), parts = new Map(source.parts)
  parts.set("ppt/slides/slide1.xml", Buffer.from(parts.get("ppt/slides/slide1.xml")!.toString().replace('<p:spPr><a:xfrm><a:off x="47625"', '<p:spPr><a:xfrm rot="5400000"><a:off x="47625"')))
  expect(parts.get("ppt/slides/slide1.xml")!.toString()).toContain('rot="5400000"')
  const deck = importedNativeDeck(await importPptx(await exportPptx({...source, parts})))
  expect(flatten(deck.slides[0]!.elements).some(element => element.kind === "text" && element.body.paragraphs.length === 10)).toBe(false)
})

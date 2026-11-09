import {flatten} from "../../deck/src/elements.ts"
import {expect, it} from "vitest"
import {shadowTextSource, pairwiseCascadeSource, pairwiseLayers, cascadeSource, competingCascadeSource, competingStyles, type CascadeLayer} from "./text-cascade-fixture.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {parseXml} from "../src/xml.ts"

it("resolves nine list levels through master, matching layout, shape and explicit styles", async () => {
  const original = await cascadeSource(), deck = importedNativeDeck(original), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)!
  if (text.kind !== "text") throw new Error("inherited-text-required")
  expect(text).toMatchObject({kind: "text", support: {kind: "native"}})
  expect(text.body.frame).toMatchObject({anchor: "bottom", insets: {left: 2, top: 3, right: 5}})
  for (const [index, paragraph] of text.body.paragraphs.entries()) {
    expect(paragraph.level).toBe(index)
    expect(paragraph.indentation).toEqual({left: index + 1, right: index === 1 ? 4 : 0, firstLine: -1})
    expect(paragraph.alignment).toBe(index === 1 ? "center" : "right")
    expect(paragraph.marker).toEqual({kind: "number", format: "decimal", start: null})
    expect(paragraph.endStyle).toMatchObject({font: "Theme Minor", size: index === 1 ? 40 : 24 + index, color: index === 1 ? "#123456" : "#204060", bold: index !== 1})
  }
  expect(text.body.paragraphs[1]!.endStyle.italic).toBe(true)
  expect(text.body.paragraphs[1]!.spacing).toMatchObject({before: 3, after: 2})
  expect(text.body.paragraphs[8]!.runs).toEqual([])
  const source = await exportPptx(original), unchanged = await importPptx(await writeNativeSavedPptx(deck, 0, source, {}))
  for (const [part, bytes] of original.parts) if (part !== "[Content_Types].xml") expect(unchanged.parts.get(part), part).toEqual(bytes)
  text.body.paragraphs[8]!.alignment = "justify"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {}))
  const reopened = importedNativeDeck(saved).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)!
  expect(reopened).toMatchObject({body: {paragraphs: text.body.paragraphs.map(paragraph => ({...paragraph, id: expect.any(String)}))}})
  const before = parseXml(original.parts.get("ppt/slides/slide1.xml")!), after = parseXml(saved.parts.get("ppt/slides/slide1.xml")!)
  const strip = (parsed: ReturnType<typeof parseXml>) => {const body = parsed.nodes.filter(node => node.local === "txBody").at(-1)!; return parsed.xml.slice(0, body.start) + parsed.xml.slice(body.end)}
  expect(strip(after)).toBe(strip(before))
})
it.each(['<a:r><a:rPr u="dbl"/><a:t>Underline</a:t></a:r>', '<a:tab/>'])("keeps unrepresented source text noneditable and byte exact: %s", async payload => {
  const original = await cascadeSource(`<a:p>${payload}</a:p>`), deck = importedNativeDeck(original)
  expect(deck.slides[0]!.elements.filter(element => element.kind === "text")).toHaveLength(1)
  expect(deck.slides[0]!.elements.at(-1)!.support.kind).toBe("kept")
  const saved = await importPptx(await writeNativeSavedPptx(deck, 0, await exportPptx(original), {}))
  for (const [part, bytes] of original.parts) if (part !== "[Content_Types].xml") expect(saved.parts.get(part), part).toEqual(bytes)
})

it("resolves title/major fonts, placeholder paragraph defaults and slide color-map precedence", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts)
  const master = parts.get("ppt/slideMasters/slideMaster1.xml")!.toString().replaceAll('type="body"', 'type="title"').replaceAll("bodyStyle", "titleStyle").replaceAll("+mn-lt", "+mj-lt")
  parts.set("ppt/slideMasters/slideMaster1.xml", Buffer.from(master))
  parts.set("ppt/slideLayouts/slideLayout1.xml", Buffer.from(parts.get("ppt/slideLayouts/slideLayout1.xml")!.toString().replaceAll('type="body"', 'type="title"').replace('<a:p/>', '<a:p><a:pPr lvl="0" marL="95250"><a:defRPr u="sng"/></a:pPr></a:p>')))
  parts.set("ppt/theme/theme1.xml", Buffer.from(parts.get("ppt/theme/theme1.xml")!.toString().replace(/(<a:majorFont>\s*<a:latin typeface=")[^"]*/, '$1Theme Major')))
  parts.set("ppt/slides/slide1.xml", Buffer.from(parts.get("ppt/slides/slide1.xml")!.toString().replaceAll('type="body"', 'type="title"').replace('<a:masterClrMapping/>', '<a:overrideClrMapping tx1="dk1"/>')))
  const source = await importPptx(await exportPptx({...original, parts})), deck = importedNativeDeck(source)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
  if (text?.kind !== "text") throw new Error("title-required")
  expect(text.body.paragraphs[0]).toMatchObject({indentation: {left: 10}, endStyle: {font: "Theme Major", color: "#000000", underline: true}})
  const saved = await importPptx(await writeNativeSavedPptx(deck, 0, await exportPptx(source), {}))
  expect(saved.parts.get("ppt/slides/slide1.xml")).toEqual(source.parts.get("ppt/slides/slide1.xml"))
})

it("retains nested source groups while changing supported text outside the group", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts), part = "ppt/slides/slide1.xml"
  const document = parseXml(parts.get(part)!), shape = document.nodes.filter(node => node.local === "sp").at(-1)!
  const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="100" name="Retained group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:grpSp><p:nvGrpSpPr><p:cNvPr id="101" name="Nested"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${document.xml.slice(shape.start, shape.end)}</p:grpSp></p:grpSp>`
  parts.set(part, Buffer.from(document.xml.slice(0, shape.start) + group + document.xml.slice(shape.end)))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source))
  expect(deck.slides[0]!.elements.at(-1)!.support.kind).toBe("kept")
  const text = deck.slides[0]!.elements.find(element => element.kind === "text")
  if (text?.kind !== "text") throw new Error("native-text-required")
  text.body.paragraphs[0].runs = [{kind: "text", text: "Changed sibling", style: text.body.paragraphs[0].endStyle}]
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {})), after = parseXml(saved.parts.get(part)!)
  const kept = after.nodes.find(node => node.local === "grpSp")!
  expect(after.xml.slice(kept.start, kept.end)).toBe(group)
  for (const [name, bytes] of parts) if (![part, "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
})

it.each(['<a:defRPr u="dbl"/>'])("keeps unsupported inherited properties instead of materializing a lossy body: %s", async formatting => {
  const original = await cascadeSource(), parts = new Map(original.parts)
  const name = "ppt/slideLayouts/slideLayout1.xml"
  parts.set(name, Buffer.from(parts.get(name)!.toString().replace('<a:lstStyle>', `<a:lstStyle><a:lvl1pPr>${formatting}</a:lvl1pPr>`)))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source))
  expect(deck.slides[0]!.elements.at(-1)!.support.kind).toBe("kept")
  const saved = await importPptx(await writeNativeSavedPptx(deck, 0, source, {}))
  for (const [part, bytes] of parts) if (part !== "[Content_Types].xml") expect(saved.parts.get(part), part).toEqual(bytes)
})

it("resolves every empty list level and explicit insertion overrides without fabricating text spans", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts), part = "ppt/slides/slide1.xml", document = parseXml(parts.get(part)!)
  const body = document.nodes.filter(node => node.local === "txBody").at(-1)!, first = document.nodes.find(node => node.local === "p" && node.start > body.start && node.end < body.end)!
  const paragraphs = Array.from({length: 9}, (_, level) => `<a:p><a:pPr lvl="${level}"/><a:endParaRPr i="1"${level === 0 ? ' sz="3600" b="0" u="sng"' : ""}/></a:p>`).join("")
  parts.set(part, Buffer.from(document.xml.slice(0, first.start) + paragraphs + document.xml.slice(body.closeStart)))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source)), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
  if (text?.kind !== "text") throw new Error("empty-text-required")
  expect(text.source).toMatchObject({objectId: expect.stringMatching(/^body:/)})
  for (const [level, paragraph] of text.body.paragraphs.entries()) {
    expect(paragraph.runs).toEqual([])
    expect(paragraph.endStyle).toMatchObject({font: "Theme Minor", italic: true, color: "#204060", size: level === 0 ? 48 : level === 1 ? 40 : 24 + level, bold: level !== 0})
  }
  expect(text.body.paragraphs[0].endStyle.underline).toBe(true)
  text.body.paragraphs[0].endStyle.color = "#aabbcc"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {})), reopened = importedNativeDeck(saved)
  expect(reopened.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)).toMatchObject({body: {paragraphs: text.body.paragraphs.map(paragraph => ({...paragraph, id: expect.any(String)}))}})
})

it("keeps theme-override text instead of resolving it against the wrong theme", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts), relationships = "ppt/slides/_rels/slide1.xml.rels"
  parts.set(relationships, Buffer.from(parts.get(relationships)!.toString().replace("</Relationships>", '<Relationship Id="overrideTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/themeOverride" Target="../theme/themeOverride1.xml"/></Relationships>')))
  parts.set("ppt/theme/themeOverride1.xml", Buffer.from('<a:themeOverride xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fontScheme name="Override"><a:majorFont><a:latin typeface="Override"/></a:majorFont><a:minorFont><a:latin typeface="Override"/></a:minorFont></a:fontScheme></a:themeOverride>'))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source))
  expect(deck.slides[0]!.elements.filter(element => element.kind === "text")).toHaveLength(0)
  const saved = await importPptx(await writeNativeSavedPptx(deck, 0, source, {}))
  for (const [part, bytes] of parts) if (part !== "[Content_Types].xml") expect(saved.parts.get(part), part).toEqual(bytes)
})

it("keeps inherited vertical frame text instead of discarding its direction", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts), name = "ppt/slideLayouts/slideLayout1.xml"
  parts.set(name, Buffer.from(parts.get(name)!.toString().replace('<a:bodyPr ', '<a:bodyPr vert="vert" ')))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source))
  expect(deck.slides[0]!.elements.at(-1)!.support.kind).toBe("kept")
  const saved = await importPptx(await writeNativeSavedPptx(deck, 0, source, {}))
  for (const [part, bytes] of parts) if (part !== "[Content_Types].xml") expect(saved.parts.get(part), part).toEqual(bytes)
})

it.each([false, true])("honors pairwise local list/paragraph/run values and explicit false with run=%s", async explicitRun => {
  const list = '<a:lvl1pPr><a:defRPr sz="1500" b="1" i="1"><a:solidFill><a:srgbClr val="112233"/></a:solidFill><a:latin typeface="List Family"/></a:defRPr></a:lvl1pPr>'
  const paragraph = '<a:pPr><a:defRPr sz="2250" b="0" i="0"><a:solidFill><a:srgbClr val="445566"/></a:solidFill><a:latin typeface="Paragraph Family"/></a:defRPr></a:pPr>'
  const run = '<a:rPr sz="3000" b="1" i="1"><a:solidFill><a:srgbClr val="778899"/></a:solidFill><a:latin typeface="Run Family"/></a:rPr>'
  const original = await cascadeSource(`<a:p>${paragraph}<a:r>${explicitRun ? run : ""}<a:t>Pairwise</a:t></a:r><a:endParaRPr b="0"/></a:p>`), parts = new Map(original.parts), part = "ppt/slides/slide1.xml"
  parts.set(part, Buffer.from(parts.get(part)!.toString().replace('<a:lstStyle><a:lvl2pPr>', `<a:lstStyle>${list}<a:lvl2pPr>`)))
  const source = await exportPptx({...original, parts}), imported = await importPptx(source), deck = importedNativeDeck(imported), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("pairwise-native-required")
  const selected = text.body.paragraphs[9]!, expected = explicitRun ? {font: "Run Family", size: 40, color: "#778899", bold: true, italic: true} : {font: "Paragraph Family", size: 30, color: "#445566", bold: false, italic: false}
  expect(selected.runs[0]!.style).toMatchObject(expected)
  expect(selected.endStyle).toMatchObject({...expected, bold: false})
  selected.alignment = "center"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {})), reopened = importedNativeDeck(saved).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  expect(reopened).toMatchObject({body: {paragraphs: expect.arrayContaining([expect.objectContaining({runs: [expect.objectContaining({style: expect.objectContaining(expected)})]})])}})
  for (const [name, bytes] of imported.parts) if (![part, "airdesign/saved-version.json", "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
})

it.each([-1, 0, 1, 2, 3, 4, 5, 6, 7] satisfies CascadeLayer[])("characterizes distinct competing inheritance values through layer %s and selective save", async layer => {
  const original = await competingCascadeSource(layer), source = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))
  if (text?.kind !== "text") throw new Error("competing-native-text-required")
  const paragraph = text.body.paragraphs[0], expected = layer === -1 ? {font: "Cascade Theme Major", color: "#010203", size: 32, bold: false} : competingStyles[Math.min(layer, 6)]!
  expect(paragraph.runs[0]!.style).toMatchObject(expected)
  expect(paragraph.endStyle).toMatchObject(layer === 7 ? competingStyles[7]! : expected)
  paragraph.alignment = "center"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {})), reopened = importedNativeDeck(saved).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))
  expect(reopened).toMatchObject({body: {paragraphs: [expect.objectContaining({alignment: "center", runs: [expect.objectContaining({style: expect.objectContaining(expected)})], endStyle: expect.objectContaining(layer === 7 ? competingStyles[7]! : expected)})]}})
  const fragments = (bytes: Uint8Array) => {
    const document = parseXml(Buffer.from(bytes))
    return document.nodes.filter(node => ["r", "endParaRPr", "lstStyle", "fontRef"].includes(node.local)).map(node => document.xml.slice(node.start, node.end))
  }
  expect(fragments(saved.parts.get("ppt/slides/slide1.xml")!)).toEqual(fragments(original.parts.get("ppt/slides/slide1.xml")!))
  for (const [name, bytes] of original.parts) if (!["ppt/slides/slide1.xml", "airdesign/saved-version.json", "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
})

it.each([
  {options: {missingLocalLevel: true}, expected: 3},
  {options: {slideIndex: "9"}, expected: 2},
  {options: {slideTypeAbsent: true}, expected: 3}
])("resolves missing levels and placeholder matching: %j", async ({options, expected}) => {
  const source = await competingCascadeSource(options.missingLocalLevel ? 4 : 3, options), deck = importedNativeDeck(source)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))
  expect(text).toMatchObject({body: {paragraphs: [expect.objectContaining({runs: [expect.objectContaining({style: expect.objectContaining(competingStyles[expected]!)})]})]}})
})

it("imports explicit no-fill as editable paint and preserves neighboring runs", async () => {
  const source = await competingCascadeSource(6, {invisibleRun: true}), bytes = await exportPptx(source), deck = importedNativeDeck(source)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))!
  expect(text).toMatchObject({kind: "text", support: {kind: "native"}})
  if (text.kind !== "text") throw new Error("editable-no-fill-required")
  expect(text.body.paragraphs[0].runs[0]!.style.color).toBe(null)
  text.body.paragraphs[0].alignment = "center"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, bytes, {}))
  expect(importedNativeDeck(saved).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Competing inheritance"))).toMatchObject({kind: "text", support: {kind: "native"}, body: {paragraphs: [expect.objectContaining({runs: [expect.objectContaining({style: expect.objectContaining({color: null})})]})]}})
  for (const [name, original] of source.parts) if (!["ppt/slides/slide1.xml", "airdesign/saved-version.json", "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(original)
})

it("inherits the actual autofit choice when local body properties contain only an unwarped preset", async () => {
  const original = await cascadeSource(), parts = new Map(original.parts), layout = "ppt/slideLayouts/slideLayout1.xml", slide = "ppt/slides/slide1.xml"
  const warp = '<a:prstTxWarp prst="textNoShape"><a:avLst/></a:prstTxWarp>'
  parts.set(layout, Buffer.from(parts.get(layout)!.toString().replace('<a:bodyPr tIns="28575"/>', '<a:bodyPr tIns="28575"><a:normAutofit fontScale="80000" lnSpcReduction="10000"/></a:bodyPr>')))
  parts.set(slide, Buffer.from(parts.get(slide)!.toString().replace('<a:bodyPr rIns="47625"/>', `<a:bodyPr rIns="47625">${warp}</a:bodyPr>`)))
  const source = await exportPptx({...original, parts}), deck = importedNativeDeck(await importPptx(source)), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
  if (text?.kind !== "text") throw new Error("inherited-autofit-text-required")
  expect(text.body.frame.autofit).toEqual({kind: "shrink", fontScale: 0.8, lineReduction: 0.1})
  text.body.paragraphs[0].alignment = "left"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {}))
  expect(saved.parts.get(slide)!.toString()).toContain(warp)
  for (const [name, bytes] of parts) if (![slide, "airdesign/saved-version.json", "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
})

it.each(pairwiseLayers.flatMap((lower, index) => pairwiseLayers.slice(index + 1).map((upper, offset) => ({lower, upper, low: index, high: index + offset + 1}))))("resolves pairwise $lower < $upper including explicit false", async ({low, high}) => {
  const source = await pairwiseCascadeSource(low, high), deck = importedNativeDeck(source), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Pairwise"))!
  if (text.kind !== "text") throw new Error("pairwise-native-required")
  const paragraph = text.body.paragraphs[0], winner = {font: "Winner", size: 40, bold: false, italic: false, underline: false, color: "#224466"}
  expect(paragraph.endStyle).toMatchObject(winner)
  expect(paragraph.runs[0]!.style).toMatchObject(high === 9 ? {font: "Loser", size: 20, bold: true, italic: true, underline: true, color: "#aa5500"} : winner)
})
it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])("inherits explicit no-fill at layer %s and allows a later solid fill", async layer => {
  const source = await pairwiseCascadeSource(layer - 1, layer, true), deck = importedNativeDeck(source), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Pairwise"))!
  expect(text).toMatchObject({kind: "text", support: {kind: "native"}})
  if (text?.kind !== "text") throw new Error("native-no-fill-required")
  expect(text.body.paragraphs[0].runs[0]!.style.color).toBe(null)
  const later = await pairwiseCascadeSource(layer, layer === 8 ? 9 : 8, true, layer), reopened = importedNativeDeck(later).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs[0].runs.some(run => run.kind === "text" && run.text === "Pairwise"))!
  expect(reopened).toMatchObject({body: {paragraphs: [expect.objectContaining({runs: [expect.objectContaining({style: expect.objectContaining({color: layer === 8 ? null : "#224466"})})], endStyle: expect.objectContaining({color: "#224466"})})]}})
})

it.each([false, true])("selectively persists no-fill and restores solid paint with source effects=%s", async effects => {
  const original = effects ? await shadowTextSource() : await cascadeSource(), source = await exportPptx(original), deck = importedNativeDeck(original)
  const text = flatten(deck.slides[0]!.elements).find(element => element.kind === "text" && element.body.paragraphs.length === 9 + Number(effects))!
  if (text.kind !== "text") throw new Error("editable-source-required")
  const paragraph = text.body.paragraphs[effects ? 9 : 0]!, before = structuredClone(paragraph), run = paragraph.runs[0]!
  run.style.color = null
  paragraph.endStyle.color = null
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {})), reopened = importedNativeDeck(saved)
  const edited = flatten(reopened.slides[0]!.elements).find(element => element.id === text.id)!
  if (edited.kind !== "text") throw new Error("no-fill-reopen-required")
  expect(edited.body.paragraphs[effects ? 9 : 0]!.runs[0]!.style).toMatchObject(run.style)
  expect(edited.body.paragraphs[effects ? 9 : 0]!.endStyle.color).toBe(null)
  const part = "ppt/slides/slide1.xml", document = parseXml(saved.parts.get(part)!)
  expect(document.nodes.filter(node => node.local === "noFill").length).toBeGreaterThanOrEqual(2)
  expect(edited.body.paragraphs[1]).toEqual(text.body.paragraphs[1])
  const retained = (bytes: Uint8Array) => {
    const document = parseXml(Buffer.from(bytes))
    return document.nodes.filter(node => ["graphicFrame", "effectLst", "hlinkClick", "sym", "fld"].includes(node.local)).map(node => document.xml.slice(node.start, node.end))
  }
  expect(retained(saved.parts.get(part)!)).toEqual(retained(original.parts.get(part)!))
  for (const [name, bytes] of original.parts) if (![part, "airdesign/saved-version.json", "[Content_Types].xml"].includes(name)) expect(saved.parts.get(name), name).toEqual(bytes)
  edited.body.paragraphs[effects ? 9 : 0] = before
  const restored = await importPptx(await writeNativeSavedPptx(reopened, 2, await exportPptx(saved), {}))
  expect(flatten(importedNativeDeck(restored).slides[0]!.elements).find(element => element.id === text.id)).toMatchObject({body: {paragraphs: expect.arrayContaining([expect.objectContaining({...before, runs: before.runs.map(run => expect.objectContaining({...run, style: expect.objectContaining(run.style)})), endStyle: expect.objectContaining(before.endStyle)})])}})
})

it("keeps neighboring runs editable when one run explicitly suppresses inherited paint", async () => {
  const original = await cascadeSource('<a:p><a:r><a:rPr><a:noFill/></a:rPr><a:t>Hidden</a:t></a:r><a:r><a:t>Visible inherited</a:t></a:r><a:r><a:rPr><a:solidFill><a:srgbClr val="456789"/></a:solidFill></a:rPr><a:t>Visible solid</a:t></a:r><a:endParaRPr><a:noFill/></a:endParaRPr></a:p>'), source = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)!
  expect(text).toMatchObject({kind: "text", support: {kind: "native"}})
  if (text?.kind !== "text") throw new Error("neighbor-runs-required")
  const paragraph = text.body.paragraphs[9]!
  expect(paragraph.runs.map(run => run.style.color)).toEqual([null, "#204060", "#456789"])
  expect(paragraph.endStyle.color).toBe(null)
  const neighbor = paragraph.runs[1]!
  if (neighbor.kind !== "text") throw new Error("text-neighbor-required")
  neighbor.text = "Edited neighbor"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, source, {}))
  expect(saved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain("Edited neighbor")
  const reopened = importedNativeDeck(saved).slides[0]!.elements.find(element => element.id === text.id)!
  if (reopened.kind !== "text") throw new Error("reopened-neighbor-required")
  expect(reopened.body.paragraphs[9]!.runs.map(run => run.style.color)).toEqual([null, "#204060", "#456789"])
})

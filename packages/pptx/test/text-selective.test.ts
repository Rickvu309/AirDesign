import {expect, it} from "vitest"
import {cascadeSource} from "./text-cascade-fixture.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {commandId} from "../../change-log/src/index.ts"
import {executeNative, initialNativeHistory} from "../../change-log/src/text/native-model.ts"
import {parseNativeArchiveV3} from "../../deck/src/text/native-v3.ts"
import {parseXml} from "../src/xml.ts"

const metadata = '<a:latin typeface="Arial" panose="020B0604020202020204" charset="0"/><a:ea typeface="MS Gothic"/><a:cs typeface="Arial"/>'
const field = '<a:fld id="retained" type="slidenum"><a:t>42</a:t></a:fld>'
const hyperlink = '<a:hlinkClick r:id="retained-link" tooltip="Original tooltip"/>'
const payload = `<a:p><a:pPr><a:spcBef><a:spcPct val="0"/></a:spcBef><a:tabLst><a:tab pos="91440" algn="l"/></a:tabLst><a:buFont typeface="Wingdings"/><a:buChar char="•"/></a:pPr><a:r><a:rPr spc="150" baseline="25000" strike="sngStrike" cap="small" kern="900" smtClean="0">${metadata}${hyperlink}</a:rPr><a:t>Editable Latin</a:t></a:r>${field}<a:endParaRPr spc="0" baseline="0"/></a:p>`

it("keeps rare source properties editable through canonical history and selective saved export", async () => {
  const original = await cascadeSource(payload), bytes = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const paragraph = text.body.paragraphs[9]!, run = paragraph.runs[0]!
  expect(paragraph.marker).toEqual({kind: "bullet", character: "•", font: "Wingdings"})
  expect(run.style).toMatchObject({letterSpacing: 2, baseline: 0.25, strike: true, capitalization: "small", kerning: 12})
  const history = initialNativeHistory(deck)
  const result = executeNative(history, {id: commandId("selective-person"), kind: "patch", target: paragraph.id, fields: {alignment: "center", runs: paragraph.runs.map((run, index) => index === 0 && run.kind === "text" ? {...run, text: "Changed Latin", style: {...run.style, letterSpacing: 3}} : run)}, base: 0, run: null})
  expect(result.receipt.kind).toBe("applied")
  const reopened = parseNativeArchiveV3(JSON.parse(JSON.stringify({version: 3, deck: result.history.deck}))).deck
  const savedBytes = await writeNativeSavedPptx(reopened, result.history.seq, bytes, {}), saved = await importPptx(savedBytes)
  const xml = saved.parts.get("ppt/slides/slide1.xml")!.toString()
  for (const retained of [metadata, field, hyperlink, '<a:tabLst><a:tab pos="91440" algn="l"/></a:tabLst>']) expect(xml).toContain(retained)
  expect(xml).toContain('spc="225"')
  expect(xml).toContain("Changed Latin")
  for (const [part, value] of original.parts) if (!["[Content_Types].xml", "ppt/slides/slide1.xml"].includes(part)) expect(saved.parts.get(part), part).toEqual(value)
  const reimported = importedNativeDeck(saved).slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  expect(reimported).toMatchObject({body: {paragraphs: expect.arrayContaining([expect.objectContaining({alignment: "center", marker: paragraph.marker, runs: expect.arrayContaining([expect.objectContaining({text: "Changed Latin", style: expect.objectContaining({letterSpacing: 3, baseline: 0.25})})])})])}})
  const repeated = await importPptx(await writeNativeSavedPptx(reopened, result.history.seq, bytes, {}))
  for (const [part, value] of saved.parts) expect(repeated.parts.get(part), part).toEqual(value)
})

it.each(["field", "font", "script", "topology"])("refuses export of incompatible %s candidates without mutating input", async kind => {
  const original = await cascadeSource(payload), bytes = await exportPptx(original), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const before = JSON.stringify(deck), candidate = structuredClone(deck), target = candidate.slides[0]!.elements.find(element => element.id === text.id)
  if (target?.kind !== "text") throw new Error("native-text-required")
  const paragraph = target.body.paragraphs[9]!, run = paragraph.runs[kind === "field" ? 1 : 0]!
  if (kind === "font") run.style.font = "Different"
  else if (kind === "topology") paragraph.runs.push({...run})
  else if (run.kind === "text") run.text = kind === "script" ? "漢字" : "Changed field"
  await expect(writeNativeSavedPptx(candidate, 1, bytes, {})).rejects.toThrow("source-text-format-preservation-required")
  expect(JSON.stringify(deck)).toBe(before)
  expect(await exportPptx(original)).toEqual(bytes)
})

it("inserts properties in schema order and preserves original namespace prefixes", async () => {
  const source = await cascadeSource(), parts = new Map(source.parts), part = "ppt/slides/slide1.xml"
  parts.set(part, Buffer.from(parts.get(part)!.toString().replaceAll("xmlns:a=", "xmlns:d=").replaceAll("<a:", "<d:").replaceAll("</a:", "</d:")))
  const original = await importPptx(await exportPptx({...source, parts})), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const run = text.body.paragraphs[0].runs[0]!
  run.style.italic = true
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, await exportPptx(original), {})), parsed = parseXml(saved.parts.get(part)!)
  const properties = parsed.nodes.find(node => node.local === "rPr" && node.attributes.i === "1")!
  expect(properties.uri).toBe("http://schemas.openxmlformats.org/drawingml/2006/main")
  expect(parsed.xml.slice(properties.end)).toMatch(/^<d:t>/)
})

it("inserts changed color before retained font and hyperlink properties", async () => {
  const original = await cascadeSource(payload), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  text.body.paragraphs[9]!.runs[0]!.style.color = "#abcdef"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, await exportPptx(original), {}))
  const document = parseXml(saved.parts.get("ppt/slides/slide1.xml")!)
  const properties = document.nodes.find(node => node.local === "rPr" && node.attributes.spc === "150")!
  const locals = document.nodes.filter(node => node.start > properties.start && node.end < properties.end).map(node => node.local)
  expect(locals.indexOf("solidFill")).toBeLessThan(locals.indexOf("latin"))
  expect(locals.indexOf("latin")).toBeLessThan(locals.indexOf("hlinkClick"))
  expect(document.xml).toContain(hyperlink)
})

it.each([["tint", "25000", "#bfbfbf"], ["shade", "25000", "#000000"], ["tint", "100000", "#000000"], ["tint", "0", "#ffffff"]])("resolves and retains %s color modification %s", async (kind, value, color) => {
  const fill = `<a:solidFill><a:prstClr val="black"><a:${kind} val="${value}"/></a:prstClr></a:solidFill>`
  const original = await cascadeSource(`<a:p><a:r><a:rPr>${fill}</a:rPr><a:t>Color</a:t></a:r></a:p>`), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  expect(text.body.paragraphs[9]!.runs[0]!.style.color).toBe(color)
  text.body.paragraphs[9]!.alignment = "center"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, await exportPptx(original), {}))
  expect(saved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain(fill)
})

it("retains neutral outline and underline defaults without admitting visible outlines or warps", async () => {
  const defaults = '<a:ln><a:noFill/></a:ln><a:uLnTx/><a:uFillTx/>'
  const original = await cascadeSource(`<a:p><a:r><a:rPr u="sng">${defaults}</a:rPr><a:t>Underlined</a:t></a:r></a:p>`), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 10)
  if (text?.kind !== "text") throw new Error("native-text-required")
  expect(text.body.paragraphs[9]!.runs[0]!.style.underline).toBe(true)
  text.body.paragraphs[9]!.alignment = "center"
  const saved = await importPptx(await writeNativeSavedPptx(deck, 1, await exportPptx(original), {}))
  expect(saved.parts.get("ppt/slides/slide1.xml")!.toString()).toContain(defaults)
  for (const unsupported of ['<a:ln><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>', '<a:ln/>', '<a:noFill/>']) {
    const source = await cascadeSource(`<a:p><a:r><a:rPr>${unsupported}</a:rPr><a:t>Guarded</a:t></a:r></a:p>`)
    expect(importedNativeDeck(source).slides[0]!.elements.some(element => element.kind === "text" && element.body.paragraphs.length === 10)).toBe(false)
  }
})


it("preserves only the neutral no-shape text warp", async () => {
  for (const [warp, native] of [["textNoShape", true], ["textArchUp", false]]) {
    const source = await cascadeSource(), parts = new Map(source.parts), part = "ppt/slides/slide1.xml"
    parts.set(part, Buffer.from(parts.get(part)!.toString().replace('<a:bodyPr rIns="47625"/>', `<a:bodyPr rIns="47625"><a:prstTxWarp prst="${warp}"><a:avLst/></a:prstTxWarp></a:bodyPr>`)))
    const original = await importPptx(await exportPptx({...source, parts})), deck = importedNativeDeck(original)
    const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
    expect(text?.kind === "text").toBe(native)
    if (text?.kind === "text") {
      text.body.paragraphs[0].alignment = "center"
      const saved = await importPptx(await writeNativeSavedPptx(deck, 1, await exportPptx(original), {}))
      expect(saved.parts.get(part)!.toString()).toContain('<a:prstTxWarp prst="textNoShape"><a:avLst/></a:prstTxWarp>')
    }
  }
})


it("saves explicit run and paragraph end formatting together", async () => {
  const original = await cascadeSource(), deck = importedNativeDeck(original)
  const text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)
  if (text?.kind !== "text") throw new Error("native-text-required")
  const paragraph = text.body.paragraphs[0]
  paragraph.runs[0]!.style = {...paragraph.runs[0]!.style, italic: false, underline: false, letterSpacing: 2, baseline: 0.1, strike: true, capitalization: "small", kerning: 12}
  const bytes = await exportPptx(original)
  await expect(writeNativeSavedPptx(deck, 1, bytes, {})).rejects.toThrow("selective edit projection differs")
  paragraph.endStyle = {...paragraph.runs[0]!.style}
  const saved = importedNativeDeck(await importPptx(await writeNativeSavedPptx(deck, 1, bytes, {})))
  const reopened = saved.slides[0]!.elements.find(element => element.id === text.id)
  expect(reopened).toMatchObject({kind: "text", body: {paragraphs: expect.arrayContaining([expect.objectContaining({runs: paragraph.runs, endStyle: paragraph.endStyle})])}})
})

import {expect, it} from "vitest"
import {cascadeSource} from "./text-cascade-fixture.ts"
import {importPptx, exportPptx} from "../src/index.ts"
import {importedNativeDeck} from "../src/import-deck.ts"
import {writeNativeSavedPptx} from "../src/export-deck.ts"
import {parseXml} from "../src/xml.ts"

it("resolves nine list levels through master, matching layout, shape and explicit styles", async () => {
  const original = await cascadeSource(), deck = importedNativeDeck(original), text = deck.slides[0]!.elements.find(element => element.kind === "text" && element.body.paragraphs.length === 9)!
  if (text.kind !== "text") throw new Error("inherited-text-required")
  expect(text.support.kind).toBe("native")
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
it.each(['<a:r><a:rPr u="dbl"/><a:t>Underline</a:t></a:r>', '<a:tab/>', '<a:r><a:t>literal\ttab</a:t></a:r>'])("keeps unrepresented source text noneditable and byte exact: %s", async payload => {
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

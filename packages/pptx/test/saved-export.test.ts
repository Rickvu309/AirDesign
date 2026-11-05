import { it,expect } from "vitest"
import { createNativePresentation } from "../src/native.ts"
import { importedDeck } from "../src/import-deck.ts"
import { writeSavedPptx } from "../src/export-deck.ts"
import { importPptx,exportPptx } from "../src/index.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"

it("writes the exact saved native slides, order, notes and version",async()=>{
  const fixture=fixtureDeck(3,3),deck={...fixture,slides:[fixture.slides[2]!,fixture.slides[0]!]}
  const bytes=await writeSavedPptx(deck,7,null,{seq:999,deck:"report-deck-id"}),result=await importPptx(bytes)
  expect(JSON.parse(result.parts.get("airdesign/saved-version.json")!.toString()).deck).toEqual(deck)
  expect(JSON.parse(result.parts.get("airdesign/saved-version.json")!.toString()).seq).toBe(7)
  expect(result.parts.get("ppt/slides/slide1.xml")?.toString()).toContain(deck.slides[0]!.elements.find(element=>element.kind==="text")!.runs[0]!.text)
  expect(importedDeck(result).slides).toHaveLength(2)
  expect(result.parts.get("ppt/notesSlides/notesSlide1.xml")?.toString()).toContain(deck.slides[0]!.notes)
})
it("keeps original OPC payload bytes and unsupported objects while patching only changed text",async()=>{
  const original=await createNativePresentation([{title:"Original title",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]},notes:"Speaker note"}])
  const deck=importedDeck(original),slide=deck.slides[0]!,title=slide.elements.find(element=>element.kind==="text")
  if(!title||title.kind!=="text")throw new Error("title-required")
  expect(title.runs[0]!.font).not.toBe("Geist");expect(slide.notes).toContain("Speaker note")
  expect(slide.elements.some(element=>element.support.kind==="kept")).toBe(true)
  const source=await exportPptx(original)
  const unchanged=await importPptx(await writeSavedPptx(deck,0,source,{}))
  for(const [name,bytes] of original.parts)if(!["[Content_Types].xml","ppt/presentation.xml","ppt/_rels/presentation.xml.rels"].includes(name))expect(unchanged.parts.get(name),name).toEqual(bytes)
  title.runs[0]!.text="Changed saved title"
  const changed=await importPptx(await writeSavedPptx(deck,1,source,{}))
  expect(changed.parts.get("ppt/slides/slide1.xml")?.toString()).toContain("Changed saved title")
  for(const [name,bytes] of original.parts)if(!["[Content_Types].xml","ppt/presentation.xml","ppt/_rels/presentation.xml.rels","ppt/slides/slide1.xml"].includes(name))expect(changed.parts.get(name),name).toEqual(bytes)
})

it("adds notes to an original slide with a reciprocal relationship to that slide",async()=>{
  const original=await createNativePresentation([{title:"Original",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]},notes:""}])
  const rels=original.parts.get("ppt/slides/_rels/slide1.xml.rels")!
  const parts=new Map(original.parts)
  parts.set("ppt/slides/_rels/slide1.xml.rels",Buffer.from(rels.toString().replace(/<Relationship[^>]*Type="[^"]*\/notesSlide"[^>]*\/>/,"")))
  const source=await importPptx(await exportPptx({...original,parts})),deck=importedDeck(source)
  deck.slides[0]!.notes="New saved notes"
  const result=await importPptx(await writeSavedPptx(deck,1,await exportPptx(source),{}))
  const note=result.report.relationships.find(rel=>rel.part==="ppt/slides/slide1.xml" && rel.type.endsWith("/notesSlide"))
  expect(note).toBeDefined()
  expect(result.parts.get(note!.target)?.toString()).toContain("New saved notes")
  expect(result.report.relationships.find(rel=>rel.part===note!.target && rel.type.endsWith("/slide"))?.target).toBe("ppt/slides/slide1.xml")
})

import { it,expect } from "vitest"
import { createNativePresentation } from "../src/native.ts"
import { importedDeck } from "../src/import-deck.ts"
import { writeSavedPptx } from "../src/export-deck.ts"
import { importPptx,exportPptx } from "../src/index.ts"
import { id,parseDeck } from "../../deck/src/index.ts"

it("imports rich title runs as one shape and keeps table text only in its container",async()=>{
  const source=await createNativePresentation([{title:"Rich title",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]},notes:""}])
  const parts=new Map(source.parts)
  const bytes=parts.get("ppt/slides/slide1.xml")!
  parts.set("ppt/slides/slide1.xml",Buffer.from(bytes.toString().replace("Rich title</a:t>","Rich</a:t></a:r><a:r><a:rPr/><a:t> title</a:t>")))
  const slide=importedDeck(await importPptx(await exportPptx({...source,parts}))).slides[0]!
  const text=slide.elements.filter(element=>element.kind==="text")
  expect(text).toHaveLength(1)
  expect(text[0]?.runs.map(run=>run.text).join("")).toBe("Rich title / preserved sibling")
  expect(text[0]?.box.height).toBeGreaterThan(40)
  expect(text[0]?.runs).toHaveLength(3)
  expect(slide.elements.filter(element=>element.support.kind==="kept")).toHaveLength(3)
})
it("refuses unsupported native additions and removals on original slides instead of lying in the manifest",async()=>{
  const source=await createNativePresentation([{title:"Original",notes:"",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]}}]),bytes=await exportPptx(source),deck=importedDeck(source),slide=deck.slides[0]!,original=slide.elements[0]!
  slide.elements.push({...original,id:id("added")})
  await expect(writeSavedPptx(deck,1,bytes,{})).rejects.toThrow("source-slide-structure-change-requires-fix")
  slide.elements=[]
  await expect(writeSavedPptx(deck,2,bytes,{})).rejects.toThrow("source-slide-structure-change-requires-fix")
})

it("exports a replaced rich text shape without restoring removed sibling text",async()=>{
  const source=await createNativePresentation([{title:"Original",notes:"",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]}}]),deck=importedDeck(source)
  const title=deck.slides[0]!.elements.find(element=>element.kind==="text")!
  if(title.kind!=="text")throw new Error("title-required")
  title.runs=[{...title.runs[0],text:"Replaced title"}]
  const exported=importedDeck(await importPptx(await writeSavedPptx(deck,1,await exportPptx(source),{})))
  const text=exported.slides[0]!.elements.find(element=>element.kind==="text")!
  expect(text.kind==="text" && text.runs.map(run=>run.text).join("")).toBe("Replaced title")
})


it("exports edited text after database JSON property reordering",async()=>{
  const source=await createNativePresentation([{title:"Before",table:{headers:["Year"],rows:[["2026"]]},chart:{name:"Value",labels:["A"],values:[3]},notes:""}]),bytes=await exportPptx(source),deck=importedDeck(source)
  const title=deck.slides[0]!.elements.find(element=>element.kind==="text")!
  if(title.kind!=="text")throw new Error("title-required")
  title.runs=[{...title.runs[0],text:"After"}]
  const saved=parseDeck(JSON.parse(JSON.stringify(deck,(_key,value:unknown)=>value && typeof value==="object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).toSorted(([a],[b])=>a.localeCompare(b))) : value)))
  const exported=importedDeck(await importPptx(await writeSavedPptx(saved,2,bytes,{})))
  expect(exported.slides[0]!.elements.find(element=>element.kind==="text")?.runs[0].text).toBe("After")
})

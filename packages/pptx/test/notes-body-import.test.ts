import {it,expect} from "vitest"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {writeSavedPptx} from "../src/export-deck.ts"
import {importPptx,exportPptx} from "../src/index.ts"
import {importedDeck} from "../src/import-deck.ts"

const deck=fixtureDeck(2,2),source=await importPptx(await writeSavedPptx(deck,0,null,{}))
const presentationUri="http://schemas.openxmlformats.org/presentationml/2006/main"
const drawingUri="http://schemas.openxmlformats.org/drawingml/2006/main"
const shape=(kind:string,paragraphs:string)=>`<n:sp><n:nvSpPr><n:cNvPr id="1" name="note"/><n:cNvSpPr/><n:nvPr><n:ph type="${kind}"/></n:nvPr></n:nvSpPr><n:txBody><d:bodyPr/><d:lstStyle/>${paragraphs}</n:txBody></n:sp>`
const paragraph=(text:string)=>`<d:p><d:r><d:t>${text}</d:t></d:r></d:p>`
const decorations=["sldNum","hdr","ftr","dt","sldImg"].map(kind=>shape(kind,paragraph("Excluded "+kind+" 1"))).join("")
const notes=(shapes:string,presentation=presentationUri,drawing=drawingUri)=>`<n:notes xmlns:n="${presentation}" xmlns:d="${drawing}" xmlns:foreign="urn:foreign"><n:cSld><n:spTree>${shapes}</n:spTree></n:cSld></n:notes>`
async function importedNotes(xml:string){
  const parts=new Map(source.parts)
  parts.set("ppt/notesSlides/notesSlide1.xml",Buffer.from(xml))
  const imported=importedDeck(await importPptx(await exportPptx({...source,parts})))
  return imported.slides[0]?.notes
}
it("reimports the exact exported speaker-note body without the slide number",()=>{
  expect(importedDeck(source).slides[0]?.notes).toBe(deck.slides[0]?.notes)
})
it.each([
  {name:"adjacent runs, fields, breaks and empty paragraphs",body:shape("body",'<d:p><d:r><d:t>Line </d:t></d:r><d:r><d:t>1</d:t></d:r><d:br/><d:fld id="field" type="custom"><d:t>field</d:t></d:fld></d:p><d:p/><d:p><d:r><d:t xml:space="preserve"> Plan A &amp; B &#50;1</d:t></d:r></d:p><d:p/>'),expected:"Line 1\nfield\n\n Plan A & B 21\n"},
  {name:"legitimate numeric-only body",body:shape("body",paragraph("1")),expected:"1"},
  {name:"empty body",body:shape("body","<d:p/>"),expected:""},
  {name:"missing body",body:"",expected:""},
  {name:"separate body shapes in document order",body:shape("body",paragraph("First1"))+shape("body",paragraph("Second2")),expected:"First1\nSecond2"},
  {name:"foreign namespace body marker",body:'<n:sp><n:nvSpPr><n:nvPr><foreign:ph type="body"/></n:nvPr></n:nvSpPr><n:txBody>'+paragraph("Not notes")+'</n:txBody></n:sp>',expected:""}
])("owns only semantic body text: $name",async({body,expected})=>{
  expect(await importedNotes(notes(decorations+body+shape("",paragraph("Unmarked shape 3"))))).toBe(expected)
})
it("honors namespace URIs with alternate and default prefixes, excluding foreign text",async()=>{
  const xml=notes(shape("body",'<d:p><d:r><d:t>Real</d:t></d:r><foreign:r><d:t>Foreign run</d:t></foreign:r><d:r><foreign:t>Foreign text</foreign:t></d:r><d:r><d:t> 1</d:t></d:r></d:p>')+decorations).replaceAll("n:","").replace('xmlns:n=',"xmlns=")
  expect(await importedNotes(xml)).toBe("Real 1")
})
it("reads the strict notes namespaces supported by the XML parser",async()=>{
  expect(await importedNotes(notes(shape("body",paragraph("Strict 21"))+decorations,"http://purl.oclc.org/ooxml/presentationml/main","http://purl.oclc.org/ooxml/drawingml/main"))).toBe("Strict 21")
})
it("returns empty notes without a notes relationship",async()=>{
  const parts=new Map(source.parts),path="ppt/slides/_rels/slide1.xml.rels",rels=parts.get(path)
  if(!rels)throw new Error("slide-relationships-required")
  parts.set(path,Buffer.from(rels.toString().replace(/<Relationship[^>]*Type="[^"]*\/notesSlide"[^>]*\/>/,"")))
  expect(importedDeck(await importPptx(await exportPptx({...source,parts}))).slides[0]?.notes).toBe("")
})
it("follows a normalized relative notes relationship target",async()=>{
  const parts=new Map(source.parts),path="ppt/slides/_rels/slide1.xml.rels",rels=parts.get(path)
  if(!rels)throw new Error("slide-relationships-required")
  parts.set(path,Buffer.from(rels.toString().replace("../notesSlides/notesSlide1.xml","../notesSlides/./notesSlide1.xml")))
  expect(importedDeck(await importPptx(await exportPptx({...source,parts}))).slides[0]?.notes).toBe(deck.slides[0]?.notes)
})

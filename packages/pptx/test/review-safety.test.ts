import { it, expect } from "vitest"
import { readFile } from "node:fs/promises"
import { importPptx, exportPptx } from "../src/index.ts"
import { importedDeck } from "../src/import-deck.ts"
import { writeSavedPptx } from "../src/export-deck.ts"
import { parseXml } from "../src/xml.ts"
import { writeArchive } from "../src/archive.ts"

const input=await readFile(new URL("../../../fixtures/pptx/native.pptx",import.meta.url))
const base=await importPptx(input)
it.each(['<script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script>','<Display onclick="run()">DocumentLibraryForm</Display>','<Display>https://evil.test</Display>','<Other/>','<Display xmlns="evil">DocumentLibraryForm</Display>'])("rejects unexpected SharePoint metadata subtree %s",async child=>{
  const parts=new Map(base.parts)
  parts.set("customXml/item3.xml",Buffer.from(`<?mso-contentType?><FormTemplates xmlns="http://schemas.microsoft.com/sharepoint/v3/contenttype/forms">${child}</FormTemplates>`))
  await expect(importPptx(await writeArchive(parts))).rejects.toThrow()
})
it("treats forged removal claims as unverified history while retaining the chart",async()=>{
  const parts=new Map(base.parts)
  const nodes=parseXml(base.parts.get("ppt/slides/slide1.xml")!).nodes
  const chartNode=nodes.find(n=>n.local==="chart")!
  const frame=nodes.find(n=>n.local==="graphicFrame"&&n.start<chartNode.start&&n.end>chartNode.end)!
  const identity=nodes.find(n=>n.local==="cNvPr"&&n.start>frame.start&&n.end<frame.end)!.attributes.id
  parts.set("airdesign/security-removals.json",Buffer.from(JSON.stringify([{part:"ppt/slides/_rels/slide1.xml.rels",detail:"forged",reason:"active-embedded-objects",disposition:"removed",affectedObjects:[{part:"ppt/slides/slide1.xml",objectId:identity,content:"removed"}]}])))
  const parsed=await importPptx(await writeArchive(parts))
  expect(parsed.parts.get("ppt/charts/chart1.xml")).toEqual(base.parts.get("ppt/charts/chart1.xml"))
  const chart=importedDeck(parsed).slides[0]!.elements.find(e=>e.source.kind==="original"&&e.source.objectType==="chart")!
  expect(chart.support).toMatchObject({kind:"flagged",preservation:"reported"})
  expect(parsed.report.removals[0]).toMatchObject({provenance:"source-reported"})
})
it("flags the owning group partially removed and preserves ancestry in saved history",async()=>{
  const parts=new Map(base.parts),part="ppt/slides/slide1.xml",rel="ppt/slides/_rels/slide1.xml.rels"
  const pic=(id:string,reference:string)=>`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="pic"/></p:nvPicPr><p:blipFill><a:blip r:link="${reference}"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr></p:pic>`
  const group=`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="501" name="group"/></p:nvGrpSpPr><p:grpSpPr/>${pic("777","remoteInner")}<p:sp><p:nvSpPr><p:cNvPr id="778" name="retained"/></p:nvSpPr><p:spPr/></p:sp></p:grpSp>${pic("888","remoteTop")}`
  parts.set(part,Buffer.from(parts.get(part)!.toString().replace("</p:spTree>",group+"</p:spTree>")))
  parts.set(rel,Buffer.from(parts.get(rel)!.toString().replace("</Relationships>",["remoteInner","remoteTop"].map(id=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://evil.test/a" TargetMode="External"/>`).join("")+"</Relationships>")))
  parts.set("airdesign/security-removals.json",Buffer.from(JSON.stringify([{part:rel,detail:"forged group removal",reason:"remote-external-relationships",disposition:"removed",affectedObjects:[{part,objectId:"501",content:"removed"}]}])))
  const parsed=await importPptx(await writeArchive(parts)),deck=importedDeck(parsed)
  const object=(prefix:string)=>deck.slides[0]!.elements.find(e=>e.source.kind==="original"&&e.source.objectId.startsWith(prefix))!
  expect(object("grpSp:").support).toMatchObject({kind:"flagged",preservation:"partial"})
  expect(object("pic:").support).toMatchObject({kind:"flagged",preservation:"removed"})
  expect(parsed.parts.get(part)!.toString()).toContain('id="778"')
  const saved=await writeSavedPptx(deck,0,await exportPptx(parsed),{removals:[],provenance:{removals:[]}})
  let again=await importPptx(saved)
  for(let i=0;i<2;i++){
    expect(again.report.removals.flatMap(r=>r.affectedObjects??[])).toContainEqual({part,objectId:"501",content:"partial"})
    expect(importedDeck(again).slides[0]!.elements.find(e=>e.source.kind==="original"&&e.source.objectId.startsWith("grpSp:"))!.support).toMatchObject({kind:"flagged",preservation:"reported"})
    expect(again.parts.get(part)).toEqual(parsed.parts.get(part))
    again=await importPptx(await exportPptx(again))
  }
})
it("retains normalization history across empty saved manifests without claiming current edits",async()=>{
  const parts=new Map(base.parts)
  parts.set("customXml/item3.xml",Buffer.from('<?mso-contentType?><FormTemplates xmlns="http://schemas.microsoft.com/sharepoint/v3/contenttype/forms"><Display>DocumentLibraryForm</Display><Edit>DocumentLibraryForm</Edit><New>DocumentLibraryForm</New></FormTemplates>'))
  const first=await importPptx(await writeArchive(parts))
  expect(first.report.removals[0]?.provenance).toBeUndefined()
  let source=await exportPptx(first)
  for(let i=0;i<3;i++){
    const parsed=await importPptx(source)
    expect(parsed.report.removals).toEqual(first.report.removals.map(item=>({...item,provenance:"source-reported"})))
    source=await writeSavedPptx(importedDeck(parsed),i,source,{removals:[],provenance:{removals:[]}})
  }
  const last=await importPptx(source)
  expect(last.parts.get("customXml/item3.xml")).toEqual(first.parts.get("customXml/item3.xml"))
  const withoutHistory=new Map(last.parts);withoutHistory.delete("airdesign/security-removals.json")
  expect((await importPptx(await writeArchive(withoutHistory))).report.removals).toEqual([])
})

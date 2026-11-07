import { attachTemplateLayouts } from "./template-layouts.ts"
import {patchTextColor} from "./edit/text-color.ts"
import {patchSlideBackground} from "./edit/slide-background.ts"
import PptxGenJS from "pptxgenjs"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { shapeGeometry,flatten,type Deck,type Element } from "../../deck/src/index.ts"
import { importPptx,patchText } from "./index.ts"
import { readArchive,writeArchive } from "./archive.ts"
import { importedDeck } from "./import-deck.ts"
import { appendCreatedPictures } from "./append-pictures.ts"
import { parseXml,escapeXml } from "./xml.ts"

const presentationType="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
function addElement(slide:PptxGenJS.Slide,element:Element,assets:Record<string,string>,offset={x:0,y:0}) {
  if(element.support.kind!=="native")return
  const box={x:(element.box.x+offset.x)/96,y:(element.box.y+offset.y)/96,w:element.box.width/96,h:element.box.height/96}
  if(element.kind==="group"){for(const child of element.children)addElement(slide,child,assets,{x:element.box.x+offset.x,y:element.box.y+offset.y});return}
  if(element.kind==="text"){slide.addText(element.runs.map(run=>({text:run.text,options:{bold:run.bold,italic:run.italic ?? false,underline:{style:run.underline ? "sng" : "none"},fontFace:run.font,fontSize:run.size*.75,color:run.color.slice(1)}})),{...box,margin:0,valign:"top"});return}
  if(element.kind==="image"){const data=assets[element.image.asset];if(!data)throw new Error("asset-not-found");slide.addImage({...box,data,objectName:element.id,altText:element.image.alt,rounding:element.image.mask==="ellipse"});return}
  const shape=shapeGeometry[element.geometry].preset
  slide.addShape(shape,{...box,...(element.geometry==="downTriangle" ? {rotate:180} : {}),fill:{color:element.fill.slice(1)},line:{color:element.fill.slice(1),transparency:100}})
}
async function generated(deck:Deck,assets:Record<string,string>) {
  const first=deck.slides[0];if(!first)throw new Error("empty-export")
  if(deck.slides.some(slide=>slide.size.width!==first.size.width||slide.size.height!==first.size.height))throw new Error("mixed-slide-sizes-require-fix")
  const pptx=new PptxGenJS()
  pptx.defineLayout({name:"saved",width:first.size.width/96,height:first.size.height/96});pptx.layout="saved"
  pptx.author="AirDesign";pptx.subject="Saved deck; PowerPoint compatibility pending P09"
  for(const theme of deck.themes)pptx.defineSlideMaster({title:theme.id,background:{color:theme.background.slice(1)},objects:[]})
  for(const source of deck.slides){const slide=pptx.addSlide(source.theme===null ? undefined : {masterName:source.theme});slide.background={color:(source.background ?? deck.themes.find(theme=>theme.id===source.theme)?.background ?? "#ffffff").slice(1)};for(const element of source.elements)addElement(slide,element,assets);slide.addNotes(source.notes)}
  const bytes=await pptx.write({outputType:"nodebuffer"});if(!(bytes instanceof Uint8Array))throw new Error("pptx-output-type")
  const parts=await readArchive(Buffer.from(bytes))
  for(const [name,bytes] of parts)if(/^ppt\/slides\/slide\d+\.xml$/.test(name)){const parsed=parseXml(bytes);let xml=parsed.xml;const nodes=parsed.nodes.filter(node=>node.local==="cNvPr");for(const [index,node] of [...nodes.entries()].reverse())xml=xml.slice(0,node.start)+parsed.xml.slice(node.start,node.openEnd).replace(/\bid="[^"]*"/,`id="${index+1}"`)+xml.slice(node.openEnd);parts.set(name,Buffer.from(xml))}
  for(const [index,source] of deck.slides.entries()){
    const part=`ppt/slides/slide${index+1}.xml`,bytes=parts.get(part)
    if(!bytes)throw new Error("slide-part-required")
    const parsed=parseXml(bytes),pictures=parsed.nodes.filter(node=>node.local==="pic")
    let xml=parsed.xml
    for(const picture of [...pictures].reverse()){
      const properties=parsed.nodes.find(node=>node.local==="cNvPr" && node.start>picture.start && node.end<picture.end)
      const element=flatten(source.elements).find(element=>element.kind==="image" && element.id===properties?.attributes.name)
      if(element?.kind!=="image")continue
      const crop=element.image.crop,rect=`<a:srcRect l="${Math.round(crop.x*100000)}" t="${Math.round(crop.y*100000)}" r="${Math.round((1-crop.x-crop.width)*100000)}" b="${Math.round((1-crop.y-crop.height)*100000)}"/>`
      let fragment=parsed.xml.slice(picture.start,picture.end)
      fragment=fragment.replace(/<a:srcRect[^>]*\/>/,"").replace(/(<a:stretch>)/,rect+"$1")
      xml=xml.slice(0,picture.start)+fragment+xml.slice(picture.end)
    }
    parts.set(part,Buffer.from(xml))
  }
  return parts
}
function replaceRelationships(bytes:Buffer,slides:{id:string;target:string}[]) {
  const parsed=parseXml(bytes)
  let xml=parsed.xml
  for(const node of parsed.nodes.filter(node=>node.local==="Relationship" && node.attributes.Type===presentationType).sort((a,b)=>b.start-a.start))xml=xml.slice(0,node.start)+xml.slice(node.end)
  return Buffer.from(xml.replace("</Relationships>",slides.map(slide=>`<Relationship Id="${slide.id}" Type="${presentationType}" Target="${escapeXml(slide.target)}"/>`).join("")+"</Relationships>"))
}
export async function writeSavedPptx(deck:Deck,seq:number,source:Buffer|null,manifest:Record<string,unknown>,assets:Record<string,string>={},templates:Record<string,string>={}):Promise<Buffer> {
  const native=await generated(deck,assets)
  await attachTemplateLayouts(native,deck,templates)
  let parts=native
  if(source){
    let original=await importPptx(source)
    const baseline=importedDeck(original)
    for(const slide of deck.slides)if(slide.source.kind==="original"){
      if(slide.background)original=patchSlideBackground(original,slide.source.part,slide.background)
      const source=slide.source,old=baseline.slides.find(candidate=>candidate.source.kind==="original"&&candidate.source.part===source.part)
      if(!old || !isDeepStrictEqual(old.size,slide.size) || old.elements.length!==slide.elements.filter(element=>element.source.kind==="original").length)throw new Error("source-slide-structure-change-requires-fix")
      for(const [index,element] of slide.elements.filter(element=>element.source.kind==="original").entries()){
        const previous=old.elements[index]
        if(!previous)throw new Error("source-slide-structure-change-requires-fix")
        const withoutText=(value:Element)=>value.kind==="text" ? {...value,runs:[]} : value
        if(!isDeepStrictEqual(withoutText(element),withoutText(previous)))throw new Error("source-object-change-requires-fix")
        if(element.kind==="text" && previous.kind==="text" && element.source.kind==="original"){
          const indices=element.source.objectId.slice(5).split(",").map(Number)
          const style=(run:typeof element.runs[number])=>({...run,text:"",color:""})
          const collapsed=element.runs.length===1 && isDeepStrictEqual(style(element.runs[0]),style(previous.runs[0]))
          if(indices.length!==previous.runs.length || (!collapsed && (element.runs.length!==previous.runs.length || element.runs.some((run,index)=>!isDeepStrictEqual(style(run),style(previous.runs[index]!))))))throw new Error("source-text-structure-change-requires-fix")
          for(const [runIndex,previousRun] of previous.runs.entries()){
            const currentRun=collapsed ? element.runs[0] : element.runs[runIndex]!
            const color=collapsed && currentRun.color===previous.runs[0]!.color ? previousRun.color : currentRun.color
            if(color!==previousRun.color){if(element.support.kind!=="native")throw new Error("kept-object-change-requires-fix");original=patchTextColor(original,source.part,indices[runIndex]!,color)}
            const text=collapsed ? runIndex===0 ? element.runs[0].text : "" : element.runs[runIndex]!.text
            if(text!==previousRun.text){
              if(element.support.kind!=="native")throw new Error("kept-object-change-requires-fix")
              original=patchText(original,source.part,indices[runIndex]!,text)
            }
          }
        }
      }
    }
    parts=new Map(original.parts)
    const prefix="airdesign-generated/"
    for(const [name,bytes] of native){if(name==="[Content_Types].xml"||name==="_rels/.rels")continue
      let payload=bytes
      if(name.endsWith(".rels")){const parsed=parseXml(bytes);let xml=parsed.xml;for(const node of parsed.nodes.filter(node=>node.local==="Relationship" && node.attributes.Target?.startsWith("/")).sort((a,b)=>b.start-a.start)){const replacement=xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="/${prefix}${escapeXml(node.attributes.Target?.slice(1) ?? "")}"`);xml=xml.slice(0,node.start)+replacement+xml.slice(node.end)}payload=Buffer.from(xml)}
      parts.set(prefix+name,payload)
    }
    for(const [index,slide] of deck.slides.entries())if(slide.source.kind==="original"){
      appendCreatedPictures(parts,native,slide,index,prefix)
    }
    const targets=deck.slides.map((slide,index)=>({id:`ad${index+1}`,target:slide.source.kind==="original" ? path.posix.relative("ppt",slide.source.part) : `../${prefix}ppt/slides/slide${index+1}.xml`}))
    parts.set("ppt/_rels/presentation.xml.rels",replaceRelationships(parts.get("ppt/_rels/presentation.xml.rels") ?? Buffer.alloc(0),targets))
    const nativeRels=parseXml(native.get("ppt/_rels/presentation.xml.rels") ?? Buffer.alloc(0))
    const rels=parseXml(parts.get("ppt/_rels/presentation.xml.rels")!),relationships=rels.nodes.filter(node=>node.local==="Relationship")
    const relationshipIds=new Set(relationships.map(node=>node.attributes.Id)),masterType="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"
    const masters=nativeRels.nodes.filter(node=>node.local==="Relationship"&&node.attributes.Type===masterType).map((node,index)=>{
      const target=path.posix.normalize(prefix+"ppt/"+(node.attributes.Target ?? ""))
      const existing=relationships.find(rel=>rel.attributes.Type===masterType&&path.posix.resolve("/ppt",rel.attributes.Target ?? "")===`/${target}`)
      let id=existing?.attributes.Id ?? `adMaster${index}`
      if(!existing)while(relationshipIds.has(id))id+="_"
      relationshipIds.add(id)
      return {id,target,existing:existing!==undefined}
    })
    parts.set("ppt/_rels/presentation.xml.rels",Buffer.from(rels.xml.replace("</Relationships>",masters.filter(master=>!master.existing).map(master=>`<Relationship Id="${master.id}" Type="${masterType}" Target="/${escapeXml(master.target)}"/>`).join("")+"</Relationships>")))
    const presentation=parseXml(parts.get("ppt/presentation.xml")!),masterList=presentation.nodes.find(node=>node.local==="sldMasterIdLst")
    const registered=presentation.nodes.filter(node=>node.local==="sldMasterId"),oldIds=registered.map(node=>Number(node.attributes.id))
    const firstId=Math.max(2147483647,...oldIds)+1
    const added=masters.filter(master=>!registered.some(node=>node.attributes["r:id"]===master.id)).map((master,index)=>`<p:sldMasterId id="${firstId+index}" r:id="${master.id}"/>`).join("")
    const presentationXml=masterList ? presentation.xml.slice(0,masterList.closeStart)+added+presentation.xml.slice(masterList.closeStart) : presentation.xml.replace(/(<p:sldIdLst)/,`<p:sldMasterIdLst>${added}</p:sldMasterIdLst>$1`)
    parts.set("ppt/presentation.xml",Buffer.from(presentationXml))
    const main=parseXml(parts.get("ppt/presentation.xml") ?? Buffer.alloc(0)),list=main.nodes.find(node=>node.local==="sldIdLst")
    if(!list)throw new Error("slide-list-required")
    parts.set("ppt/presentation.xml",Buffer.from(main.xml.slice(0,list.start)+`<p:sldIdLst>${targets.map((target,index)=>`<p:sldId id="${256+index}" r:id="${target.id}"/>`).join("")}</p:sldIdLst>`+main.xml.slice(list.end)))
    const types=parts.get("[Content_Types].xml")?.toString(),nativeTypes=parseXml(native.get("[Content_Types].xml") ?? Buffer.alloc(0))
    if(!types)throw new Error("content-types-required")
    const overrides=nativeTypes.nodes.filter(node=>node.local==="Override").map(node=>`<Override PartName="/${prefix}${escapeXml(node.attributes.PartName?.slice(1) ?? "")}" ContentType="${escapeXml(node.attributes.ContentType ?? "")}"/>`).join("")
    const existingDefaults=new Set(parseXml(Buffer.from(types)).nodes.filter(node=>node.local==="Default").map(node=>node.attributes.Extension))
    const defaults=nativeTypes.nodes.filter(node=>node.local==="Default" && !existingDefaults.has(node.attributes.Extension)).map(node=>nativeTypes.xml.slice(node.start,node.end)).join("")
    parts.set("[Content_Types].xml",Buffer.from(types.replace("</Types>",overrides+defaults+"</Types>")))
    for(const [slideIndex,slide] of deck.slides.entries())if(slide.source.kind==="original"){
      if(baseline.slides.find(old=>old.source.kind==="original" && slide.source.kind==="original" && old.source.part===slide.source.part)?.notes===slide.notes)continue
      const source=slide.source
      const rel=original.report.relationships.find(rel=>rel.part===source.part && rel.type.endsWith("/notesSlide"))
      if(rel){const bytes=parts.get(rel.target);if(bytes){const parsed=parseXml(bytes),texts=parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main"));let xml=parsed.xml;for(const [index,node] of [...texts.entries()].reverse()){xml=xml.slice(0,node.openEnd)+(index===0 ? escapeXml(slide.notes) : "")+xml.slice(node.closeStart)}parts.set(rel.target,Buffer.from(xml))}}
      else if(slide.notes){
        const notesPart=`${prefix}ppt/notesSlides/notesSlide${slideIndex+1}.xml`,notesRel=`${prefix}ppt/notesSlides/_rels/notesSlide${slideIndex+1}.xml.rels`
        const notes=parseXml(parts.get(notesRel) ?? Buffer.alloc(0));let xml=notes.xml
        for(const node of notes.nodes.filter(node=>node.local==="Relationship" && node.attributes.Type===presentationType).sort((a,b)=>b.start-a.start))xml=xml.slice(0,node.start)+notes.xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="${escapeXml(path.posix.relative(path.posix.dirname(notesPart),source.part))}"`)+xml.slice(node.end)
        parts.set(notesRel,Buffer.from(xml))
        const slideRel=path.posix.join(path.posix.dirname(source.part),"_rels",path.posix.basename(source.part)+".rels"),existing=parts.get(slideRel)?.toString() ?? '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
        parts.set(slideRel,Buffer.from(existing.replace("</Relationships>",`<Relationship Id="adNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="${path.posix.relative(path.posix.dirname(source.part),`${prefix}ppt/notesSlides/notesSlide${slideIndex+1}.xml`)}"/></Relationships>`)))
      }
    }
  }
  parts.set("airdesign/saved-version.json",Buffer.from(JSON.stringify({...manifest,deck,seq})))
  const types=parts.get("[Content_Types].xml")?.toString();if(!types)throw new Error("content-types-required")
  parts.set("[Content_Types].xml",Buffer.from(types.replace("</Types>",'<Override PartName="/airdesign/saved-version.json" ContentType="application/json"/></Types>')))
  const output=await writeArchive(parts)
  await importPptx(output)
  return output
}

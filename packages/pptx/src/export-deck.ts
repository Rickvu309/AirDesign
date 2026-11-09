import type {NativeDeck, NativeElement} from "../../deck/src/text/native-v3.ts"
import {flatten} from "../../deck/src/elements.ts"
import {writeTextBody, replaceTextBody} from "./text/body.ts"
import type {TextBody} from "../../deck/src/text/body.ts"
import { attachTemplateLayouts } from "./template-layouts.ts"
import {patchTextColor} from "./edit/text-color.ts"
import {patchSlideBackground} from "./edit/slide-background.ts"
import PptxGenJS from "pptxgenjs"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { shapeGeometry,type Deck,type Element } from "../../deck/src/index.ts"
import { importPptx,patchText } from "./index.ts"
import { readArchive,writeArchive } from "./archive.ts"
import { importedDeck, importedNativeDeck } from "./import-deck.ts"
import { appendCreatedPictures } from "./append-pictures.ts"
import { parseXml,escapeXml } from "./xml.ts"

const presentationType="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
function bodyFormatting(body: TextBody) {
  return {frame: {...body.frame, id: undefined}, paragraphs: body.paragraphs.map(paragraph => ({...paragraph, id: undefined}))}
}
function addElement(slide:PptxGenJS.Slide,element:Element | NativeElement,assets:Record<string,string>,offset={x:0,y:0}) {
  if(element.support.kind!=="native")return
  const box={x:(element.box.x+offset.x)/96,y:(element.box.y+offset.y)/96,w:element.box.width/96,h:element.box.height/96}
  if(element.kind==="group"){for(const child of element.children)addElement(slide,child,assets,{x:element.box.x+offset.x,y:element.box.y+offset.y});return}
  if(element.kind==="text" && "body" in element){slide.addText(" ",{...box,objectName:element.id});return}
  if(element.kind==="text"){slide.addText(element.runs.map(run=>({text:run.text,options:{bold:run.bold,italic:run.italic ?? false,underline:{style:run.underline ? "sng" : "none"},fontFace:run.font,fontSize:run.size*.75,color:run.color.slice(1)}})),{...box,margin:0,valign:"top"});return}
  if(element.kind==="image"){const data=assets[element.image.asset];if(!data)throw new Error("asset-not-found");slide.addImage({...box,data,objectName:element.id,altText:element.image.alt,rounding:element.image.mask==="ellipse"});return}
  const shape=shapeGeometry[element.geometry].preset
  slide.addShape(shape,{...box,...(element.geometry==="downTriangle" ? {rotate:180} : {}),fill:{color:element.fill.slice(1)},line:{color:element.fill.slice(1),transparency:100}})
}
async function generated(deck:Deck | NativeDeck,assets:Record<string,string>) {
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
    let bodyDocument = parseXml(bytes)
    for (const element of flatten(source.elements)) if (element.kind === "text" && "body" in element) {
      const properties = bodyDocument.nodes.find(node => node.local === "cNvPr" && node.attributes.name === element.id)
      const shape = properties && bodyDocument.nodes.find(node => node.local === "sp" && node.start < properties.start && node.end > properties.end)
      const body = shape && bodyDocument.nodes.find(node => node.local === "txBody" && node.start > shape.start && node.end < shape.end)
      if (!body) throw new Error("generated-text-body-required")
      parts.set(part, Buffer.from(bodyDocument.xml.slice(0, body.start) + writeTextBody(element.body) + bodyDocument.xml.slice(body.end)))
      bodyDocument = parseXml(parts.get(part)!)
    }
    const parsed=bodyDocument,pictures=parsed.nodes.filter(node=>node.local==="pic")
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
function registerContentTypes(parts:Map<string,Buffer>,additions:{part:string;type:string}[],defaults:{extension:string;type:string}[]=[]) {
  const bytes=parts.get("[Content_Types].xml")
  if(!bytes)throw new Error("content-types-required")
  const parsed=parseXml(bytes),root=parsed.nodes.find(node=>node.local==="Types")
  if(!root)throw new Error("content-types-required")
  const prefix=root.name.includes(":") ? root.name.split(":")[0]+":" : ""
  const overrides=new Set(parsed.nodes.filter(node=>node.local==="Override").map(node=>node.attributes.PartName))
  const extensions=new Set(parsed.nodes.filter(node=>node.local==="Default").map(node=>node.attributes.Extension))
  const entries=additions.filter(entry=>!overrides.has("/"+entry.part)).map(entry=>`<${prefix}Override PartName="/${escapeXml(entry.part)}" ContentType="${escapeXml(entry.type)}"/>`).join("")+defaults.filter(entry=>!extensions.has(entry.extension)).map(entry=>`<${prefix}Default Extension="${escapeXml(entry.extension)}" ContentType="${escapeXml(entry.type)}"/>`).join("")
  if(entries)parts.set("[Content_Types].xml",Buffer.from(parsed.xml.slice(0,root.closeStart)+entries+parsed.xml.slice(root.closeStart)))
}
function relationshipPart(part:string) {
  return path.posix.join(path.posix.dirname(part),"_rels",path.posix.basename(part)+".rels")
}
function resolveTarget(part:string,target:string) {
  return target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(part),target))
}
function copyGeneratedDependencies(parts:Map<string,Buffer>,native:Map<string,Buffer>,prefix:string) {
  const pending:string[]=[]
  for(const [name,bytes] of parts)if(name.endsWith(".rels")){
    const owner=name.replace(/\/_rels\/([^/]+)\.rels$/,"/$1")
    for(const node of parseXml(bytes).nodes.filter(node=>node.local==="Relationship" && node.attributes.TargetMode!=="External")){
      const target=resolveTarget(owner,node.attributes.Target ?? "")
      if(target.startsWith(prefix) && !parts.has(target))pending.push(target.slice(prefix.length))
    }
  }
  const copied=new Set<string>()
  while(pending.length){
    const name=pending.pop()!
    if(copied.has(name))continue
    copied.add(name)
    const bytes=parts.get(prefix+name) ?? native.get(name)
    if(!bytes)throw new Error("generated-dependency-required")
    if(!parts.has(prefix+name))parts.set(prefix+name,bytes)
    const relName=relationshipPart(name),rels=parts.get(prefix+relName) ?? native.get(relName)
    if(!rels)continue
    const parsed=parseXml(rels);let xml=parsed.xml
    for(const node of parsed.nodes.filter(node=>node.local==="Relationship" && node.attributes.TargetMode!=="External").sort((a,b)=>b.start-a.start)){
      const target=node.attributes.Target ?? "",resolved=resolveTarget(name,target)
      if(parts.has(prefix+relName)){
        const savedTarget=resolveTarget(prefix+name,target)
        if(savedTarget.startsWith(prefix))pending.push(savedTarget.slice(prefix.length))
      }else{
        pending.push(resolved)
        if(target.startsWith("/"))xml=xml.slice(0,node.start)+parsed.xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="/${prefix}${escapeXml(resolved)}"`)+xml.slice(node.end)
      }
    }
    parts.set(prefix+relName,Buffer.from(xml))
  }
  const types=parseXml(native.get("[Content_Types].xml")!)
  registerContentTypes(parts,types.nodes.filter(node=>node.local==="Override" && copied.has(node.attributes.PartName!.slice(1))).map(node=>({part:prefix+node.attributes.PartName!.slice(1),type:node.attributes.ContentType!})),types.nodes.filter(node=>node.local==="Default" && [...copied].some(name=>name.endsWith("."+node.attributes.Extension))).map(node=>({extension:node.attributes.Extension!,type:node.attributes.ContentType!})))
  const masters=types.nodes.filter(node=>node.local==="Override" && node.attributes.ContentType?.endsWith(".slideMaster+xml") && copied.has(node.attributes.PartName!.slice(1)))
  if(masters.length){
    const relPart="ppt/_rels/presentation.xml.rels",rels=parseXml(parts.get(relPart)!),main=parseXml(parts.get("ppt/presentation.xml")!),list=main.nodes.find(node=>node.local==="sldMasterIdLst")
    const ids=new Set(rels.nodes.map(node=>node.attributes.Id)),registered=main.nodes.filter(node=>node.local==="sldMasterId")
    let next=1,ordinal=Math.max(2147483647,...registered.map(node=>Number(node.attributes.id))),relationships="",entries=""
    for(const master of masters){
      while(ids.has(`adMaster${next}`))next++
      const id=`adMaster${next++}`;ids.add(id)
      relationships+=`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="${escapeXml(path.posix.relative("ppt",prefix+master.attributes.PartName!.slice(1)))}"/>`
      entries+=`<p:sldMasterId id="${++ordinal}" r:id="${id}"/>`
    }
    parts.set(relPart,Buffer.from(rels.xml.replace("</Relationships>",relationships+"</Relationships>")))
    const replacement=list ? list.openEnd===list.end ? `<${list.name}>${entries}</${list.name}>` : main.xml.slice(list.start,list.closeStart)+entries+main.xml.slice(list.closeStart,list.end) : `<p:sldMasterIdLst>${entries}</p:sldMasterIdLst>`
    const start=list?.start ?? main.nodes.find(node=>node.local==="presentation")!.openEnd,end=list?.end ?? start
    parts.set("ppt/presentation.xml",Buffer.from(main.xml.slice(0,start)+replacement+main.xml.slice(end)))
  }
}
async function writeSaved(deck:Deck | NativeDeck,seq:number,source:Buffer|null,manifest:Record<string,unknown>,assets:Record<string,string>={},templates:Record<string,string>={},version:2|3=2):Promise<Buffer> {
  const native=await generated(deck,assets)
  await attachTemplateLayouts(native,deck,templates)
  let parts=native
  if(source){
    let original=await importPptx(source)
    const baseline=version === 3 ? importedNativeDeck(original) : importedDeck(original)
    for(const slide of deck.slides)if(slide.source.kind==="original"){
      if(slide.background)original=patchSlideBackground(original,slide.source.part,slide.background)
      const source=slide.source,old=baseline.slides.find(candidate=>candidate.source.kind==="original"&&candidate.source.part===source.part)
      if(!old || !isDeepStrictEqual(old.size,slide.size) || old.elements.length!==slide.elements.filter(element=>element.source.kind==="original").length)throw new Error("source-slide-structure-change-requires-fix")
      const retained = parseXml(original.parts.get(source.part)!), bodies = retained.nodes.filter(node => node.local === "txBody")
      for(const [index,element] of slide.elements.filter(element=>element.source.kind==="original").entries()){
        const previous=old.elements[index]
        if(!previous)throw new Error("source-slide-structure-change-requires-fix")
        const withoutText=(value:Element | NativeElement)=>({...value,support:undefined,...(value.kind==="text" ? "body" in value ? {body:undefined} : {runs:undefined} : {}),source:value.source.kind==="original" ? {...value.source,objectType:undefined} : value.source})
        if(!isDeepStrictEqual(withoutText(element),withoutText(previous)))throw new Error("source-object-change-requires-fix")
        if (element.kind === "text" && "body" in element && previous.kind === "text" && "body" in previous) {
          if (!isDeepStrictEqual(bodyFormatting(element.body), bodyFormatting(previous.body))) {
            if (element.support.kind !== "native") throw new Error("kept-object-change-requires-fix")
            const identity = element.source
            if (identity.kind !== "original") throw new Error("source-text-body-required")
            const ordinal = identity.objectId.startsWith("body:") ? Number(identity.objectId.split(":")[1]) : bodies.findIndex(node => retained.nodes.filter(node => node.local === "t" && node.uri.endsWith("/drawingml/2006/main")).some((span, index) => index === Number(identity.objectId.split(":")[1]?.split(",")[0]) && span.start > node.start && span.end < node.end))
            const parsed = parseXml(original.parts.get(source.part)!), body = parsed.nodes.filter(node => node.local === "txBody")[ordinal]
            if (!body) throw new Error("source-text-body-required")
            original = {...original, parts: new Map(original.parts).set(source.part, Buffer.from(replaceTextBody(parsed, body, element.body)))}
          }
        }
        if(element.kind==="text" && !("body" in element) && previous.kind==="text" && !("body" in previous) && element.source.kind==="original"){
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
    let generation=0,prefix="airdesign-generated/"
    while([...parts.keys()].some(name=>name.startsWith(prefix)))prefix=`airdesign-generated-${++generation}/`
    for(const [index,slide] of deck.slides.entries())if(slide.source.kind==="original" && (slide.layout || flatten(slide.elements).some(element=>element.source.kind==="created"))){
      appendCreatedPictures(parts,native,slide,index,prefix)
    }
    const main=parseXml(parts.get("ppt/presentation.xml")!),list=main.nodes.find(node=>node.local==="sldIdLst")
    if(!list)throw new Error("slide-list-required")
    const oldSlides=main.nodes.filter(node=>node.local==="sldId"),rels=parseXml(parts.get("ppt/_rels/presentation.xml.rels")!)
    const ids=new Set(rels.nodes.map(node=>node.attributes.Id))
    let next=1
    const targets=deck.slides.map((slide,index)=>{
      if(slide.source.kind==="original"){
        const part=slide.source.part,rel=original.report.relationships.find(rel=>rel.part==="ppt/presentation.xml" && rel.type===presentationType && rel.target===part)
        const node=oldSlides.find(node=>node.attributes["r:id"]===rel?.id)
        if(!rel || !node)throw new Error("slide-relationship-required")
        return {id:rel.id,xml:main.xml.slice(node.start,node.end),relationship:""}
      }
      while(ids.has(`ad${next}`))next++
      const id=`ad${next++}`;ids.add(id)
      return {id,xml:`<p:sldId id="${Math.max(255,...oldSlides.map(node=>Number(node.attributes.id)))+index+1}" r:id="${id}"/>`,relationship:`<Relationship Id="${id}" Type="${presentationType}" Target="../${prefix}ppt/slides/slide${index+1}.xml"/>`}
    })
    if(!isDeepStrictEqual(targets.map(target=>target.id),oldSlides.map(node=>node.attributes["r:id"]))){
      const content=targets.map(target=>target.xml).join("")
      const replacement=list.openEnd===list.end ? `<${list.name}>${content}</${list.name}>` : main.xml.slice(list.start,list.openEnd)+content+main.xml.slice(list.closeStart,list.end)
      parts.set("ppt/presentation.xml",Buffer.from(main.xml.slice(0,list.start)+replacement+main.xml.slice(list.end)))
      const additions=targets.map(target=>target.relationship).join("")
      if(additions)parts.set("ppt/_rels/presentation.xml.rels",Buffer.from(rels.xml.replace("</Relationships>",additions+"</Relationships>")))
    }
    for(const [slideIndex,slide] of deck.slides.entries())if(slide.source.kind==="original"){
      if(baseline.slides.find(old=>old.source.kind==="original" && slide.source.kind==="original" && old.source.part===slide.source.part)?.notes===slide.notes)continue
      const source=slide.source
      const rel=original.report.relationships.find(rel=>rel.part===source.part && rel.type.endsWith("/notesSlide"))
      if(rel){const bytes=parts.get(rel.target);if(bytes){const texts=parseXml(bytes).nodes.filter(node=>node.local==="t" && node.uri==="http://schemas.openxmlformats.org/drawingml/2006/main");for(let index=texts.length-1;index>=0;index--)parts.set(rel.target,patchText({...original,parts},rel.target,index,index===0 ? slide.notes : "").parts.get(rel.target)!)}}
      else if(slide.notes){
        const notesPart=`${prefix}ppt/notesSlides/notesSlide${slideIndex+1}.xml`,notesRel=`${prefix}ppt/notesSlides/_rels/notesSlide${slideIndex+1}.xml.rels`
        const notes=parseXml(native.get(`ppt/notesSlides/_rels/notesSlide${slideIndex+1}.xml.rels`) ?? Buffer.alloc(0));let xml=notes.xml
        for(const node of notes.nodes.filter(node=>node.local==="Relationship" && node.attributes.Type===presentationType).sort((a,b)=>b.start-a.start))xml=xml.slice(0,node.start)+notes.xml.slice(node.start,node.end).replace(/Target="[^"]*"/,`Target="${escapeXml(path.posix.relative(path.posix.dirname(notesPart),source.part))}"`)+xml.slice(node.end)
        parts.set(notesRel,Buffer.from(xml))
        const slideRel=path.posix.join(path.posix.dirname(source.part),"_rels",path.posix.basename(source.part)+".rels"),existing=parts.get(slideRel)?.toString() ?? '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
        parts.set(slideRel,Buffer.from(existing.replace("</Relationships>",`<Relationship Id="adNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="${path.posix.relative(path.posix.dirname(source.part),`${prefix}ppt/notesSlides/notesSlide${slideIndex+1}.xml`)}"/></Relationships>`)))
      }
    }
    copyGeneratedDependencies(parts,native,prefix)
  }
  parts.set("airdesign/saved-version.json",Buffer.from(JSON.stringify({...manifest,version,deck,seq})))
  registerContentTypes(parts,[{part:"airdesign/saved-version.json",type:"application/json"}])
  const output=await writeArchive(parts)
  await importPptx(output)
  return output
}

export function writeSavedPptx(deck: Deck, seq: number, source: Buffer | null, manifest: Record<string, unknown>, assets: Record<string, string> = {}, templates: Record<string, string> = {}): Promise<Buffer> {
  return writeSaved(deck, seq, source, manifest, assets, templates, 2)
}
export function writeNativeSavedPptx(deck: NativeDeck, seq: number, source: Buffer | null, manifest: Record<string, unknown>, assets: Record<string, string> = {}, templates: Record<string, string> = {}): Promise<Buffer> {
  return writeSaved(deck, seq, source, manifest, assets, templates, 3)
}

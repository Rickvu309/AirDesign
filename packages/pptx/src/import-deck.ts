import {textContext, UnsupportedTextFormat} from "./text/cascade.ts"
import {readTextBody} from "./text/body.ts"
import {isNativeElement, isNativeSlide, parseNativeArchiveV3, type NativeDeck, type NativeElement, type NativeText} from "../../deck/src/text/native-v3.ts"
import { SaxesParser } from "saxes"
import { id,isSlide,parseDeck,type Deck,type Element,type Source } from "../../deck/src/index.ts"
import { hash,type Presentation } from "./index.ts"
import { parseXml,type XmlNode } from "./xml.ts"

function content(xml:string) {
  let value=""
  const parser=new SaxesParser({xmlns:true})
  parser.on("text",text=>{value+=text});parser.on("cdata",text=>{value+=text});parser.write(`<root>${xml}</root>`).close()
  return value
}
function within(parent:XmlNode,child:XmlNode) {return child.start>parent.start && child.end<parent.end}
function notesBody(bytes:Buffer):string {
  const {xml,nodes}=parseXml(bytes),root=nodes[0]
  const drawingByPresentation=new Map([["http://schemas.openxmlformats.org/presentationml/2006/main","http://schemas.openxmlformats.org/drawingml/2006/main"],["http://purl.oclc.org/ooxml/presentationml/main","http://purl.oclc.org/ooxml/drawingml/main"]])
  const drawing=root && drawingByPresentation.get(root.uri)
  if(!root || root.local!=="notes" || !drawing)return ""
  const children=new Map<XmlNode,XmlNode[]>(),stack:XmlNode[]=[]
  for(const node of nodes){
    let parent=stack.at(-1)
    while(parent && !within(parent,node)){stack.pop();parent=stack.at(-1)}
    if(parent){const siblings=children.get(parent) ?? [];siblings.push(node);children.set(parent,siblings)}
    stack.push(node)
  }
  const elements=(parent:XmlNode,uri:string,local:string)=>(children.get(parent) ?? []).filter(node=>node.uri===uri && node.local===local)
  const presentation=root.uri
  const shapes=elements(root,presentation,"cSld").flatMap(slide=>elements(slide,presentation,"spTree")).flatMap(tree=>elements(tree,presentation,"sp"))
  const bodies=shapes.filter(shape=>elements(shape,presentation,"nvSpPr").flatMap(properties=>elements(properties,presentation,"nvPr")).flatMap(properties=>elements(properties,presentation,"ph")).some(placeholder=>placeholder.attributes.type==="body"))
  return bodies.flatMap(shape=>elements(shape,presentation,"txBody")).flatMap(body=>elements(body,drawing,"p")).map(paragraph=>(children.get(paragraph) ?? []).map(run=>{
    if(run.uri!==drawing)return ""
    if(run.local==="br")return "\n"
    if(run.local!=="r" && run.local!=="fld")return ""
    return elements(run,drawing,"t").map(text=>content(xml.slice(text.openEnd,text.closeStart))).join("")
  }).join("")).join("\n")
}
type TextElement = Extract<Element, {kind: "text"}>
type TextFactory<T extends TextElement | NativeText> = (base: Omit<TextElement, "runs">, parsed: ReturnType<typeof parseXml>, shape: XmlNode, spans: XmlNode[]) => T | undefined
function importedSlides<T extends TextElement | NativeText>(presentation:Presentation, textElement: TextFactory<T>, validSlide: (slide: unknown) => boolean, progress?:(value:{completed:number;total:number})=>void, nativeGroups = false) {
  const main=presentation.parts.get("ppt/presentation.xml");if(!main)throw new Error("presentation-required")
  const document=parseXml(main),size=document.nodes.find(node=>node.local==="sldSz")
  const width=Number(size?.attributes.cx ?? 12192000)/9525,height=Number(size?.attributes.cy ?? 6858000)/9525
  const ordered=document.nodes.filter(node=>node.local==="sldId").map(node=>{
    const rel=presentation.report.relationships.find(rel=>rel.part==="ppt/presentation.xml" && rel.id===node.attributes["r:id"])
    const part=rel?.target,bytes=part ? presentation.parts.get(part) : null
    if(!part || !bytes)throw new Error("slide-relationship-required")
    return {part,bytes}
  })
  progress?.({completed:0,total:ordered.length})
  const slides=ordered.map(({part,bytes},index)=>{
    const source={kind:"original",part,sha256:hash(bytes),objectId:"slide",dependencies:presentation.report.relationships.filter(rel=>rel.part===part).map(rel=>rel.target)} satisfies Source
    const parsed=parseXml(bytes),texts=parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main"))
    const containers=["graphicFrame","pic","cxnSp","grpSp"]
    const objects=parsed.nodes.filter(node=>containers.includes(node.local) && !parsed.nodes.some(parent=>containers.includes(parent.local)&&within(parent,node)))
    const shapes=parsed.nodes.filter(node=>node.local==="sp"&&!objects.some(parent=>within(parent,node)))
    const elements:(Element | NativeElement)[]=[]
    function box(node:XmlNode) {
      const children=parsed.nodes.filter(child=>within(node,child)),offset=children.find(child=>child.local==="off"),extent=children.find(child=>child.local==="ext")
      return {x:Number(offset?.attributes.x ?? 0)/9525,y:Number(offset?.attributes.y ?? 0)/9525,width:Number(extent?.attributes.cx ?? width*9525)/9525,height:Number(extent?.attributes.cy ?? height*9525)/9525}
    }
    for(const [shapeIndex,shape] of shapes.entries()){
      const spans=texts.filter(node=>within(shape,node))
      const capable=spans.every(node=>presentation.report.capabilities.some(item=>item.part===part && item.scope.kind==="text-span" && item.scope.index===texts.indexOf(node) && item.support==="native"))
      const element = textElement({id:id(`s${index}t${shapeIndex}`),kind:"text",box:box(shape),source:{...source,objectId:`text:${spans.map(node=>texts.indexOf(node)).join(",")}`},support:capable ? {kind:"native"} : {kind:"kept",preview:null},theme:null,placeholder:null,overlap:null}, parsed, shape, spans)
      if(element) elements.push(element)
      else objects.push(shape)
    }
    function nested(node: XmlNode, identity: string): NativeElement {
      const children = parsed.nodes.filter(child => within(node, child))
      const name = children.find(child => child.local === "cNvPr")?.attributes.id
      const base = {id: id(identity), box: box(node), source: {...source, objectId: `nested:${node.local}:${name}`}, support: {kind: "kept", preview: null} satisfies Element["support"], theme: null, placeholder: null, overlap: null}
      if (node.local === "sp") {
        const spans = texts.filter(child => within(node, child)), body = children.find(child => child.local === "txBody")
        if (body) {
          const capable = spans.every(child => presentation.report.capabilities.some(item => item.part === part && item.scope.kind === "text-span" && item.scope.index === texts.indexOf(child) && item.support === "native"))
          const text = textElement({...base, kind: "text", source: {...source, objectId: spans.length ? `text:${spans.map(child => texts.indexOf(child)).join(",")}` : `body:${parsed.nodes.filter(child => child.local === "txBody").indexOf(body)}`}, support: capable ? {kind: "native"} : base.support}, parsed, node, spans)
          if (isNativeElement(text)) return text
        }
      }
      if (node.local === "grpSp") {
        const properties = children.find(child => child.local === "grpSpPr"), transform = properties && children.find(child => within(properties, child) && child.local === "xfrm")
        const coordinate = (local: string) => transform && children.find(child => within(transform, child) && child.local === local)
        const offset = coordinate("chOff"), extent = coordinate("chExt")
        if (transform && !Object.keys(transform.attributes).some(key => !key.startsWith("xmlns")) && offset && extent && Number(extent.attributes.cx) > 0 && Number(extent.attributes.cy) > 0) {
          const direct = children.filter(child => ["sp", ...containers].includes(child.local) && !children.some(parent => ["sp", ...containers].includes(parent.local) && within(parent, child)))
          return {...base, kind: "group", source: {...source, objectId: identity.startsWith(`s${index}k`) ? `grpSp:${objects.indexOf(node)}` : `group:${name}`}, support: {kind: "native"}, coordinateSpace: {x: Number(offset.attributes.x) / 9525, y: Number(offset.attributes.y) / 9525, width: Number(extent.attributes.cx) / 9525, height: Number(extent.attributes.cy) / 9525}, children: direct.map(child => nested(child, `s${index}n${parsed.nodes.find(candidate => within(child, candidate) && candidate.local === "cNvPr")?.attributes.id}`))}
        }
      }
      return {...base, kind: "shape", geometry: "rectangle", fill: "#ffffff"}
    }
    for(const [objectIndex,node] of objects.entries()){
      if (nativeGroups && node.local === "grpSp") { elements.push(nested(node, `s${index}k${objectIndex}`)); continue }
      const objectType=node.local==="graphicFrame" ? parsed.nodes.some(child=>within(node,child)&&child.local==="chart"&&["http://schemas.openxmlformats.org/drawingml/2006/chart","http://purl.oclc.org/ooxml/drawingml/chart"].includes(child.uri)) ? "chart" : parsed.nodes.some(child=>within(node,child)&&child.local==="tbl"&&["http://schemas.openxmlformats.org/drawingml/2006/main","http://purl.oclc.org/ooxml/drawingml/main"].includes(child.uri)) ? "table" : undefined : undefined
      elements.push({id:id(`s${index}k${objectIndex}`),kind:"shape",geometry:"rectangle",fill:"#ffffff",box:box(node),source:{...source,objectId:`${node.local}:${objectIndex}`,...objectType ? {objectType} : {}},support:{kind:"kept",preview:null},theme:null,placeholder:null,overlap:null})
    }
    for(const element of elements){
      const index=Number(element.source.kind==="original" ? element.source.objectId.split(":").at(-1) : -1)
      const object=element.kind==="text" ? undefined : objects[index]
      const identity=object && parsed.nodes.find(child=>within(object,child)&&child.local==="cNvPr")
      const removal=identity && presentation.report.removals.findLast(removal=>removal.affectedObjects?.some(affected=>affected.part===part&&affected.objectId===identity.attributes.id&&affected.content!=="preserved"))
      if(removal){
        const affected=removal.affectedObjects?.find(affected=>affected.part===part&&affected.objectId===identity?.attributes.id)
        element.support={kind:"flagged",preservation:removal.provenance === "source-reported" ? "reported" : affected?.content === "partial" ? "partial" : "removed",preview:null,reason:removal.reason}
      }
      else if(object){
        const references=parsed.nodes.filter(child=>within(object,child)).flatMap(child=>Object.entries(child.attributes).filter(([key])=>["r:embed","r:link","r:id"].includes(key)).map(([,value])=>value))
        const targets=presentation.report.relationships.filter(rel=>rel.part===part&&references.includes(rel.id)).map(rel=>rel.target)
        const normalized=presentation.report.removals.find(removal=>removal.disposition==="normalized"&&targets.includes(removal.part))
        if(normalized)element.support={kind:"flagged",preview:null,reason:normalized.provenance === "source-reported" ? `Source reports prior normalization (unverified): ${normalized.detail}` : normalized.detail}
      }
    }
    const notesRel=presentation.report.relationships.find(rel=>rel.part===part && rel.type.endsWith("/notesSlide")),notesBytes=notesRel ? presentation.parts.get(notesRel.target) : null
    const notes=notesBytes ? notesBody(notesBytes) : ""
    const slide={id:id(`s${index}`),version:0,size:{width,height},elements,notes,theme:null,source}
    if (!validSlide(slide)) throw new Error("invalid-import-slide")
    progress?.({completed:index+1,total:ordered.length})
    return slide
  })
  return slides
}

export function importedDeck(presentation: Presentation, progress?: (value: {completed: number; total: number}) => void): Deck {
  const slides = importedSlides(presentation, (base, parsed, shape, spans) => {
      const runs=spans.map((node,spanIndex)=>{
        const run=parsed.nodes.filter(parent=>parent.local==="r" && within(parent,node)).at(-1)
        const properties=run ? parsed.nodes.filter(child=>within(run,child)) : []
        const style=properties.find(child=>child.local==="rPr"),font=properties.find(child=>child.local==="latin"),color=properties.find(child=>child.local==="srgbClr")
        const paragraph=parsed.nodes.find(parent=>parent.local==="p" && within(parent,node)),previous=spans[spanIndex-1]
        return {text:(previous && paragraph && !within(paragraph,previous) ? "\n" : "")+content(parsed.xml.slice(node.openEnd,node.closeStart)),bold:style?.attributes.b==="1",...(style?.attributes.i==="1" ? {italic:true} : {}),...(style?.attributes.u&&style.attributes.u!=="none" ? {underline:true} : {}),font:font?.attributes.typeface || "Aptos",size:Math.max(1,Number(style?.attributes.sz ?? 2400)/100*4/3),color:color?.attributes.val ? `#${color.attributes.val}` : "#171717"}
      })
    if (!runs[0]) return undefined
    return {...base, runs: [runs[0], ...runs.slice(1)]}
  }, isSlide, progress)
  return parseDeck({id: id("imported"), version: 0, slides, themes: []})
}
export function importedNativeDeck(presentation: Presentation, progress?: (value: {completed: number; total: number}) => void): NativeDeck {
  const slides = importedSlides(presentation, (base, parsed, shape, spans): NativeText | undefined => {
    const body = parsed.nodes.find(node => node.local === "txBody" && within(shape, node))
    if (!body) return undefined
    const bodyIndex = parsed.nodes.filter(node => node.local === "txBody").indexOf(body)
    try {
      const part = base.source.kind === "original" ? base.source.part : ""
      return {...base, source: {...base.source, ...(base.source.kind === "original" && !spans.length ? {objectId: `body:${bodyIndex}`} : {})}, body: readTextBody(parsed, body, base.id, textContext(presentation, part, parsed, shape))}
    } catch (error) {
      if (error instanceof UnsupportedTextFormat) return undefined
      throw error
    }
  }, isNativeSlide, progress, true)
  return parseNativeArchiveV3({version: 3, deck: {id: id("imported"), version: 0, slides, themes: []}}).deck
}

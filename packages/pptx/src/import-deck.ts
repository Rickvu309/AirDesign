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
export function importedDeck(presentation:Presentation,progress?:(value:{completed:number;total:number})=>void):Deck {
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
    const source:Source={kind:"original",part,sha256:hash(bytes),objectId:"slide",dependencies:presentation.report.relationships.filter(rel=>rel.part===part).map(rel=>rel.target)}
    const parsed=parseXml(bytes),texts=parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main"))
    const containers=["graphicFrame","pic","cxnSp","grpSp"]
    const objects=parsed.nodes.filter(node=>containers.includes(node.local) && !parsed.nodes.some(parent=>containers.includes(parent.local)&&within(parent,node)))
    const shapes=parsed.nodes.filter(node=>node.local==="sp"&&!objects.some(parent=>within(parent,node)))
    const elements:Element[]=[]
    function box(node:XmlNode) {
      const children=parsed.nodes.filter(child=>within(node,child)),offset=children.find(child=>child.local==="off"),extent=children.find(child=>child.local==="ext")
      return {x:Number(offset?.attributes.x ?? 0)/9525,y:Number(offset?.attributes.y ?? 0)/9525,width:Number(extent?.attributes.cx ?? width*9525)/9525,height:Number(extent?.attributes.cy ?? height*9525)/9525}
    }
    for(const [shapeIndex,shape] of shapes.entries()){
      const spans=texts.filter(node=>within(shape,node))
      if(!spans.length){objects.push(shape);continue}
      const runs=spans.map((node,spanIndex)=>{
        const run=parsed.nodes.filter(parent=>parent.local==="r" && within(parent,node)).at(-1)
        const properties=run ? parsed.nodes.filter(child=>within(run,child)) : []
        const style=properties.find(child=>child.local==="rPr"),font=properties.find(child=>child.local==="latin"),color=properties.find(child=>child.local==="srgbClr")
        const paragraph=parsed.nodes.find(parent=>parent.local==="p" && within(parent,node)),previous=spans[spanIndex-1]
        return {text:(previous && paragraph && !within(paragraph,previous) ? "\n" : "")+content(parsed.xml.slice(node.openEnd,node.closeStart)),bold:style?.attributes.b==="1",font:font?.attributes.typeface || "Aptos",size:Math.max(1,Number(style?.attributes.sz ?? 2400)/100*4/3),color:color?.attributes.val ? `#${color.attributes.val}` : "#171717"}
      })
      const capable=spans.every(node=>presentation.report.capabilities.some(item=>item.part===part && item.scope.kind==="text-span" && item.scope.index===texts.indexOf(node) && item.support==="native"))
      if(runs[0])elements.push({id:id(`s${index}t${shapeIndex}`),kind:"text",box:box(shape),source:{...source,objectId:`text:${spans.map(node=>texts.indexOf(node)).join(",")}`},support:capable ? {kind:"native"} : {kind:"kept",preview:null},theme:null,placeholder:null,overlap:null,runs:[runs[0],...runs.slice(1)]})
    }
    for(const [objectIndex,node] of objects.entries())elements.push({id:id(`s${index}k${objectIndex}`),kind:"shape",geometry:"rectangle",fill:"#ffffff",box:box(node),source:{...source,objectId:`${node.local}:${objectIndex}`},support:{kind:"kept",preview:null},theme:null,placeholder:null,overlap:null})
    const notesRel=presentation.report.relationships.find(rel=>rel.part===part && rel.type.endsWith("/notesSlide")),notesBytes=notesRel ? presentation.parts.get(notesRel.target) : null
    const notes=notesBytes ? (()=>{const parsed=parseXml(notesBytes);return parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main")).map(node=>content(parsed.xml.slice(node.openEnd,node.closeStart))).join("\n")})() : ""
    const slide={id:id(`s${index}`),version:0,size:{width,height},elements,notes,theme:null,source}
    if(!isSlide(slide))throw new Error("invalid-import-slide")
    progress?.({completed:index+1,total:ordered.length})
    return slide
  })
  return parseDeck({id:id("imported"),version:0,slides,themes:[]})
}

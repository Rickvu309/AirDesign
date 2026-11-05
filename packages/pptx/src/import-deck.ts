import { SaxesParser } from "saxes"
import { id,parseDeck,type Deck,type Element,type Source } from "../../deck/src/index.ts"
import { hash,type Presentation } from "./index.ts"
import { parseXml,type XmlNode } from "./xml.ts"

function content(xml:string) {
  let value=""
  const parser=new SaxesParser({xmlns:true})
  parser.on("text",text=>{value+=text});parser.on("cdata",text=>{value+=text});parser.write(`<root>${xml}</root>`).close()
  return value
}
function within(parent:XmlNode,child:XmlNode) {return child.start>parent.start && child.end<parent.end}
export function importedDeck(presentation:Presentation):Deck {
  const main=presentation.parts.get("ppt/presentation.xml");if(!main)throw new Error("presentation-required")
  const document=parseXml(main),size=document.nodes.find(node=>node.local==="sldSz")
  const width=Number(size?.attributes.cx ?? 12192000)/9525,height=Number(size?.attributes.cy ?? 6858000)/9525
  const slides=document.nodes.filter(node=>node.local==="sldId").map((node,index)=>{
    const rel=presentation.report.relationships.find(rel=>rel.part==="ppt/presentation.xml" && rel.id===node.attributes["r:id"])
    const part=rel?.target,bytes=part ? presentation.parts.get(part) : null
    if(!part || !bytes)throw new Error("slide-relationship-required")
    const source:Source={kind:"original",part,sha256:hash(bytes),objectId:"slide",dependencies:presentation.report.relationships.filter(rel=>rel.part===part).map(rel=>rel.target)}
    const parsed=parseXml(bytes),texts=parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main"))
    const elements:Element[]=texts.map((node,textIndex)=>{
      const shape=parsed.nodes.filter(parent=>parent.local==="sp" && within(parent,node)).at(-1)
      const transform=shape ? parsed.nodes.filter(child=>within(shape,child)) : []
      const offset=transform.find(child=>child.local==="off"),extent=transform.find(child=>child.local==="ext")
      const run=parsed.nodes.filter(parent=>parent.local==="r" && within(parent,node)).at(-1)
      const properties=run ? parsed.nodes.filter(child=>within(run,child)) : []
      const style=properties.find(child=>child.local==="rPr"),font=properties.find(child=>child.local==="latin"),color=properties.find(child=>child.local==="srgbClr")
      const fontSize=Number(style?.attributes.sz ?? 2400)/100*4/3
      const capable=presentation.report.capabilities.some(item=>item.part===part && item.scope.kind==="text-span" && item.scope.index===textIndex && item.support==="native")
      return {id:id(`s${index}t${textIndex}`),kind:"text",box:{x:Number(offset?.attributes.x ?? 0)/9525,y:Number(offset?.attributes.y ?? 0)/9525+textIndex*28,width:Number(extent?.attributes.cx ?? width*9525)/9525,height:Math.min(40,Number(extent?.attributes.cy ?? height*9525)/9525)},source:{...source,objectId:`text:${textIndex}`},support:capable ? {kind:"native"} : {kind:"kept",preview:null},theme:null,placeholder:null,overlap:null,runs:[{text:content(parsed.xml.slice(node.openEnd,node.closeStart)),bold:style?.attributes.b==="1",font:font?.attributes.typeface || "Aptos",size:Math.max(1,fontSize),color:color?.attributes.val ? `#${color.attributes.val}` : "#171717"}]}
    })
    const objects=parsed.nodes.filter(node=>["graphicFrame","pic","cxnSp","grpSp"].includes(node.local)||node.local==="sp"&&!texts.some(text=>within(node,text)))
    for(const [objectIndex,node] of objects.entries())elements.push({id:id(`s${index}k${objectIndex}`),kind:"shape",geometry:"rectangle",fill:"#ffffff",box:{x:0,y:height-32,width:Math.min(width,360),height:24},source:{...source,objectId:`${node.local}:${objectIndex}`},support:{kind:"kept",preview:null},theme:null,placeholder:null,overlap:null})
    const notesRel=presentation.report.relationships.find(rel=>rel.part===part && rel.type.endsWith("/notesSlide")),notesBytes=notesRel ? presentation.parts.get(notesRel.target) : null
    const notes=notesBytes ? (()=>{const parsed=parseXml(notesBytes);return parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main")).map(node=>content(parsed.xml.slice(node.openEnd,node.closeStart))).join("\n")})() : ""
    return {id:id(`s${index}`),version:0,size:{width,height},elements,notes,theme:null,source}
  })
  return parseDeck({id:id("imported"),version:0,slides,themes:[]})
}

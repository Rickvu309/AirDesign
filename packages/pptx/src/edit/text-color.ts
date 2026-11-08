import type {Presentation} from "../index.ts"
import {parseXml} from "../xml.ts"

export function patchTextColor(presentation:Presentation,part:string,index:number,color:string):Presentation {
  if(!/^#[\da-f]{6}$/i.test(color))throw new Error("invalid-text-color")
  const bytes=presentation.parts.get(part)
  if(!bytes)throw new Error("part-not-found")
  const parsed=parseXml(bytes),text=parsed.nodes.filter(node=>node.local==="t" && node.uri.endsWith("/drawingml/2006/main"))[index]
  if(!text)throw new Error("qualified-text-span-required")
  const run=parsed.nodes.find(node=>node.local==="r" && node.start<text.start && node.end>text.end)
  if(!run)throw new Error("qualified-text-run-required")
  const prefix=run.name.includes(":") ? run.name.split(":")[0]+":" : ""
  const fill=`<${prefix}solidFill><${prefix}srgbClr val="${color.slice(1)}"/></${prefix}solidFill>`
  const properties=parsed.nodes.find(node=>node.local==="rPr" && node.start>run.start && node.end<run.end)
  let xml=parsed.xml
  if(properties){
    const existing=parsed.nodes.find(node=>["solidFill","noFill","gradFill","pattFill","blipFill","grpFill"].includes(node.local) && node.start>properties.start && node.end<properties.end)
    if(existing)xml=xml.slice(0,existing.start)+fill+xml.slice(existing.end)
    else if(xml.slice(properties.start,properties.openEnd).endsWith("/>"))xml=xml.slice(0,properties.openEnd-2)+">"+fill+`</${properties.name}>`+xml.slice(properties.end)
    else {const line=parsed.nodes.find(node=>node.local==="ln" && node.start>properties.start && node.end<properties.end),at=line?.end ?? properties.openEnd;xml=xml.slice(0,at)+fill+xml.slice(at)}
  }else xml=xml.slice(0,run.openEnd)+`<${prefix}rPr>${fill}</${prefix}rPr>`+xml.slice(run.openEnd)
  const parts=new Map(presentation.parts);parts.set(part,Buffer.from(xml));parseXml(parts.get(part)!)
  return {...presentation,parts}
}

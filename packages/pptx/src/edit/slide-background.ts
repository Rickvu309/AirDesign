import type {Presentation} from "../index.ts"
import {parseXml} from "../xml.ts"

export function patchSlideBackground(presentation:Presentation,part:string,color:string):Presentation {
  if(!/^#[\da-f]{6}$/i.test(color))throw new Error("invalid-background-color")
  const bytes=presentation.parts.get(part)
  if(!bytes)throw new Error("part-not-found")
  const parsed=parseXml(bytes),slide=parsed.nodes.find(node=>node.local==="cSld")
  if(!slide)throw new Error("slide-content-required")
  const background=parsed.nodes.find(node=>node.local==="bg" && node.start>slide.start && node.end<slide.end)
  const prefix=slide.name.includes(":") ? slide.name.split(":")[0]+":" : ""
  const replacement=`<${prefix}bg><${prefix}bgPr><a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:srgbClr val="${color.slice(1)}"/></a:solidFill></${prefix}bgPr></${prefix}bg>`
  const start=background?.start ?? slide.openEnd,end=background?.end ?? slide.openEnd
  const parts=new Map(presentation.parts);parts.set(part,Buffer.from(parsed.xml.slice(0,start)+replacement+parsed.xml.slice(end)))
  parseXml(parts.get(part)!)
  return {...presentation,parts}
}

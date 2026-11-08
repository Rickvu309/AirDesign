import {shapeGeometry} from "./shape-geometry.ts"
import type {Element} from "./model.ts"
export function contentLabel(element:Element):string {
  if(element.support.kind!=="native" && element.source.kind==="original"){
    const labels:Record<string,string>={chart:"Chart",table:"Table",pic:"Picture",sp:"Shape",grpSp:"Group",cxnSp:"Connector",graphicFrame:"Graphic frame",text:"Text"}
    const label=labels[element.source.objectType ?? element.source.objectId.split(":")[0] ?? ""]
    if(label)return label
  }
  const text=element.kind==="text" ? element.runs.map(run=>run.text).join("") : element.kind==="image" ? element.image.alt || "Image" : element.kind==="shape" ? shapeGeometry[element.geometry].name : element.children.filter(child=>child.kind==="shape").length>1&&element.children.every(child=>child.kind==="text"||child.kind==="shape"&&child.geometry==="rectangle") ? "Bar chart" : "Group"
  return text.replaceAll(/\s+/g," ").trim().slice(0,64)||"Untitled content"
}

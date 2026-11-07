import {shapeGeometry} from "./shape-geometry.ts"
import type {Element} from "./model.ts"
export function contentLabel(element:Element):string {
  const text=element.kind==="text" ? element.runs.map(run=>run.text).join("") : element.kind==="image" ? element.image.alt || "Image" : element.kind==="shape" ? shapeGeometry[element.geometry].name : element.children.every(child=>child.kind==="shape") ? "Chart" : "Group"
  return text.replaceAll(/\s+/g," ").trim().slice(0,64)||"Untitled content"
}

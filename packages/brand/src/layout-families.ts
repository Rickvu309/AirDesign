import type { LayoutFamily } from "./index.ts"
export function layoutFamilies(relationships: readonly {part:string;type:string;target:string}[]): LayoutFamily[] {
  const masters = [...new Set(relationships.filter(rel => rel.type.endsWith("/slideMaster")).map(rel => rel.target))].sort()
  return masters.map((master,index) => ({id:`master${index+1}`,name:`Master ${index+1}`,master,layouts:relationships.filter(rel => rel.type.endsWith("/slideMaster") && rel.target === master && rel.part !== "ppt/presentation.xml").map(rel => rel.part).sort()})).filter(family => family.layouts.length > 0)
}

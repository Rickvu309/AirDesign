import type { Element, Slide } from "../../deck/src/model.ts"
export type Defect = { code: "clipping" | "accidental-overlap"; ids: string[]; location: { x: number; y: number }; message: string }
export function hardDefects(slide: Slide, clippedTextIds: readonly string[] = []): Defect[] {
  const defects: Defect[] = []
  const painted: { element: Element; box: Element["box"]; overlaps: string[] }[] = []
  function visit(elements: Element[], x: number, y: number, overlaps: string[]) {
    for (const element of elements) {
      const box = { ...element.box, x: x + element.box.x, y: y + element.box.y }
      const intended = element.overlap ? [...overlaps, element.overlap] : overlaps
      if (element.kind === "group" && element.support.kind === "native") { visit(element.children, box.x, box.y, intended); continue }
      painted.push({ element, box, overlaps: intended })
      if (box.x < 0 || box.y < 0 || box.x + box.width > slide.size.width || box.y + box.height > slide.size.height || clippedTextIds.includes(element.id)) defects.push({ code: "clipping", ids: [element.id], location: { x: box.x, y: box.y }, message: "Move or resize the item, or enlarge its text box." })
    }
  }
  visit(slide.elements, 0, 0, [])
  for (let i = 0; i < painted.length; i++) for (let j = i + 1; j < painted.length; j++) {
    const a = painted[i]!
    const b = painted[j]!
    if (a.overlaps.some(value => b.overlaps.includes(value))) continue
    if (a.box.x < b.box.x + b.box.width && a.box.x + a.box.width > b.box.x && a.box.y < b.box.y + b.box.height && a.box.y + a.box.height > b.box.y) defects.push({ code: "accidental-overlap", ids: [a.element.id, b.element.id], location: { x: Math.max(a.box.x, b.box.x), y: Math.max(a.box.y, b.box.y) }, message: "Separate these items or mark their intended overlap." })
  }
  return defects
}

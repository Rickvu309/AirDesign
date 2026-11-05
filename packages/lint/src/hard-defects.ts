import type { Element, Slide } from "../../deck/src/model.ts"
export type Defect = { code: "clipping" | "accidental-overlap"; ids: string[]; location: { x: number; y: number }; message: string }
export function hardDefects(slide: Slide, clippedTextIds: readonly string[] = []): Defect[] {
  const defects: Defect[] = []
  function visit(elements: Element[], x: number, y: number) {
    for (const element of elements) {
      const box = { ...element.box, x: x + element.box.x, y: y + element.box.y }
      if (box.x < 0 || box.y < 0 || box.x + box.width > slide.size.width || box.y + box.height > slide.size.height || clippedTextIds.includes(element.id)) defects.push({ code: "clipping", ids: [element.id], location: { x: box.x, y: box.y }, message: "Move or resize the item, or enlarge its text box." })
      if (element.kind === "group") visit(element.children, box.x, box.y)
    }
    for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i]!
      const b = elements[j]!
      if (a.overlap !== null && a.overlap === b.overlap) continue
      if (a.box.x < b.box.x + b.box.width && a.box.x + a.box.width > b.box.x && a.box.y < b.box.y + b.box.height && a.box.y + a.box.height > b.box.y) defects.push({ code: "accidental-overlap", ids: [a.id, b.id], location: { x: x + Math.max(a.box.x, b.box.x), y: y + Math.max(a.box.y, b.box.y) }, message: "Separate these items or mark their intended overlap." })
    }
  }
  visit(slide.elements, 0, 0)
  return defects
}

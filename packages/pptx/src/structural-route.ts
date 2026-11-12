import { presentationPart } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { editPart, partBytes, replacePart } from "./part-markup.js"
import { addSection, orderSection, removeSection } from "./section-route.js"
import { cloneShape, orderShape } from "./shape-route.js"
import { addTextShape } from "./shape-write.js"
import { addSlide, orderSlide, removeSlide } from "./slide-list-route.js"
import { removeShape, type RouteResult } from "./slide-route.js"
import { addRow, addTable, orderRow, removeRow } from "./table-route.js"

export type StructuralEdit =
  | {
      readonly name: "spTree.add"
      readonly part: string
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "spTree.remove"; readonly part: string; readonly shape: string }
  | { readonly name: "spTree.order"; readonly part: string; readonly shape: string; readonly before: string }
  | { readonly name: "spTree.clone"; readonly part: string; readonly shape: string }
  | { readonly name: "sldIdLst.add"; readonly after: string }
  | { readonly name: "sldIdLst.remove"; readonly slide: string }
  | { readonly name: "sldIdLst.order"; readonly slide: string; readonly before: string }
  | { readonly name: "sldIdLst.clone"; readonly slide: string }
  | { readonly name: "sectionLst.add"; readonly title: string }
  | { readonly name: "sectionLst.remove"; readonly section: string }
  | { readonly name: "sectionLst.order"; readonly section: string; readonly before: string }
  | { readonly name: "graphicFrame.addTable"; readonly part: string }
  | { readonly name: "tbl.addRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.removeRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.orderRow"; readonly part: string; readonly row: number; readonly before: number }

export function writeStructuralRoute(parts: ReadonlyMap<string, Uint8Array>, route: StructuralEdit): RouteResult {
  const next = new Map(parts)
  switch (route.name) {
    case "spTree.add": {
      const written = addTextShape(decodeUtf8(partBytes(next, route.part)), route.text, {
        x: route.x,
        y: route.y,
        cx: route.cx,
        cy: route.cy,
      })
      replacePart(next, route.part, encodeUtf8(written.xml))
      return { parts: next, id: String(written.id) }
    }
    case "spTree.remove":
      editPart(next, route.part, (bytes) => removeShape(bytes, route.shape))
      return { parts: next, id: null }
    case "spTree.order":
      editPart(next, route.part, (bytes) => orderShape(bytes, route.shape, route.before))
      return { parts: next, id: null }
    case "spTree.clone":
      editPart(next, route.part, (bytes) => cloneShape(bytes, route.shape))
      return { parts: next, id: null }
    case "sldIdLst.add":
      return { parts: next, id: addSlide(next, route.after, false) }
    case "sldIdLst.clone":
      addSlide(next, route.slide, true)
      return { parts: next, id: null }
    case "sldIdLst.remove":
      removeSlide(next, route.slide)
      return { parts: next, id: null }
    case "sldIdLst.order":
      editPart(next, presentationPart, (bytes) => orderSlide(bytes, route.slide, route.before))
      return { parts: next, id: null }
    case "sectionLst.add":
      editPart(next, presentationPart, (bytes) => addSection(bytes, route.title))
      return { parts: next, id: null }
    case "sectionLst.remove":
      editPart(next, presentationPart, (bytes) => removeSection(bytes, route.section))
      return { parts: next, id: null }
    case "sectionLst.order":
      editPart(next, presentationPart, (bytes) => orderSection(bytes, route.section, route.before))
      return { parts: next, id: null }
    case "graphicFrame.addTable":
      editPart(next, route.part, addTable)
      return { parts: next, id: null }
    case "tbl.addRow":
      editPart(next, route.part, (bytes) => addRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.removeRow":
      editPart(next, route.part, (bytes) => removeRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.orderRow":
      editPart(next, route.part, (bytes) => orderRow(bytes, route.row, route.before))
      return { parts: next, id: null }
    default: {
      const unexpected: never = route
      throw new Error(String(unexpected))
    }
  }
}

export function applyStructuralRoute(
  parts: ReadonlyMap<string, Uint8Array>,
  route: StructuralEdit,
): Map<string, Uint8Array> {
  return writeStructuralRoute(parts, route).parts
}

import type { Geometry } from "@airdesign/document"
import { presentationPart } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { editPart, partBytes, replacePart } from "./part-markup.js"
import { addSection, orderSection, removeSection } from "./section-write.js"
import { cloneShape, orderShape } from "./shape-route.js"
import { addDrawnShape, addTextShape, type ShapeBox } from "./shape-write.js"
import { addSlide, orderSlide, removeSlide } from "./slide-list-route.js"
import { removeShape, type RouteResult } from "./slide-route.js"
import type { TableShape } from "./table-frame.js"
import { newTableStyle } from "./table-style-list.js"
import { addColumn, removeColumn } from "./table-column-route.js"
import { addRow, addTable, orderRow, removeRow } from "./table-route.js"

export type StructuralEdit =
  | ({
      readonly name: "spTree.add"
      readonly part: string
      readonly text: string
      readonly geometry?: Geometry
      readonly holdsText?: true
      readonly id?: number
    } & ShapeBox)
  | { readonly name: "spTree.remove"; readonly part: string; readonly shape: string }
  | { readonly name: "spTree.order"; readonly part: string; readonly shape: string; readonly before: string }
  | {
      readonly name: "spTree.clone"
      readonly part: string
      readonly shape: string
      readonly id?: number
      readonly ids?: readonly (readonly [string, number])[]
    }
  | { readonly name: "sldIdLst.add"; readonly after: string; readonly id?: string; readonly layout?: string }
  | { readonly name: "sldIdLst.remove"; readonly slide: string }
  | { readonly name: "sldIdLst.order"; readonly slide: string; readonly before: string }
  | { readonly name: "sldIdLst.clone"; readonly slide: string; readonly id?: string }
  | { readonly name: "sectionLst.add"; readonly title: string }
  | { readonly name: "sectionLst.remove"; readonly section: string }
  | { readonly name: "sectionLst.order"; readonly section: string; readonly before: string }
  | ({ readonly name: "graphicFrame.addTable"; readonly part: string; readonly id?: number } & TableShape)
  | { readonly name: "tbl.addRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.removeRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.orderRow"; readonly part: string; readonly row: number; readonly before: number }
  | {
      readonly name: "tbl.addColumn"
      readonly part: string
      readonly shape: string
      readonly column: number
      readonly place: "before" | "after"
    }
  | { readonly name: "tbl.removeColumn"; readonly part: string; readonly shape: string; readonly column: number }

export function writeStructuralRoute(parts: ReadonlyMap<string, Uint8Array>, route: StructuralEdit): RouteResult {
  const next = new Map(parts)
  switch (route.name) {
    case "spTree.add": {
      const xml = decodeUtf8(partBytes(next, route.part))
      const box = { x: route.x, y: route.y, cx: route.cx, cy: route.cy }
      if (route.geometry !== undefined && route.text !== "") throw new Error("text")
      const written =
        route.geometry === undefined
          ? addTextShape(xml, route.text, box, route.id)
          : addDrawnShape(xml, route.geometry, box, route.id, route.holdsText === true)
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
      editPart(next, route.part, (bytes) => cloneShape(bytes, route.shape, route.id, new Map(route.ids ?? [])))
      return { parts: next, id: null }
    case "sldIdLst.add":
      return { parts: next, id: addSlide(next, route.after, false, route.id, route.layout) }
    case "sldIdLst.clone":
      addSlide(next, route.slide, true, route.id)
      return { parts: next, id: null }
    case "sldIdLst.remove":
      removeSlide(next, route.slide)
      return { parts: next, id: null }
    case "sldIdLst.order":
      editPart(next, presentationPart, (bytes) => orderSlide(bytes, route.slide, route.before))
      return { parts: next, id: null }
    case "sectionLst.add":
      return { parts: new Map(addSection(next, route.title)), id: null }
    case "sectionLst.remove":
      return { parts: new Map(removeSection(next, route.section)), id: null }
    case "sectionLst.order":
      return { parts: new Map(orderSection(next, route.section, route.before)), id: null }
    case "graphicFrame.addTable": {
      const style = newTableStyle(next)
      editPart(next, route.part, (bytes) => addTable(bytes, route, style))
      return { parts: next, id: null }
    }
    case "tbl.addRow":
      editPart(next, route.part, (bytes) => addRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.removeRow":
      editPart(next, route.part, (bytes) => removeRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.orderRow":
      editPart(next, route.part, (bytes) => orderRow(bytes, route.row, route.before))
      return { parts: next, id: null }
    case "tbl.addColumn":
      editPart(next, route.part, (bytes) => addColumn(bytes, route.shape, route.column, route.place))
      return { parts: next, id: null }
    case "tbl.removeColumn":
      editPart(next, route.part, (bytes) => removeColumn(bytes, route.shape, route.column))
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

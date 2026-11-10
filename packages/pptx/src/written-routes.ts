import { type ExportRoute, type StructuralRoute } from "@airdesign/document"

export const writtenRoutes = {
  text: "txBody",
  move: "xfrm",
  resize: "xfrm",
  add: "spTree.add",
  remove: "spTree.remove",
  order: "spTree.order",
  clone: "spTree.clone",
  addSlide: "sldIdLst.add",
  removeSlide: "sldIdLst.remove",
  orderSlide: "sldIdLst.order",
  cloneSlide: "sldIdLst.clone",
  addSection: "sectionLst.add",
  removeSection: "sectionLst.remove",
  orderSection: "sectionLst.order",
  addTable: "graphicFrame.addTable",
  addRow: "tbl.addRow",
  removeRow: "tbl.removeRow",
  orderRow: "tbl.orderRow",
} as const satisfies Record<string, ExportRoute | StructuralRoute>

import {
  elementId,
  floorFor,
  floorOpening,
  landedPatch,
  ownFloor,
  shapeOf,
  slideKind,
  type IndexElement,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { indexPackage } from "@airdesign/pptx"
import { shownBox } from "@/editing/element-move"
import { slideBase } from "@/editing/exported-parts"
import { shownValue } from "@/editing/live-repaint"

type Parts = ReadonlyMap<string, Uint8Array>

function slideRows(parts: Parts, slide: SlideId): readonly IndexElement[] {
  return indexPackage(parts).elements.filter((row) => shapeOf(row.node).slide === slide)
}

export function flooredEdit(
  parts: Parts,
  register: Register,
  file: readonly SlideId[],
  edit: SlideCommand,
): SlideCommand {
  if (edit.slide === "add") {
    return {
      ...edit,
      floor: slideRows(slideBase(parts, { ...register, file, order: [...register.order, edit] }), edit.id),
    }
  }
  if (edit.slide !== "clone") return edit
  return { ...edit, floor: cloneFloor(parts, register)(edit.source, edit.id) }
}

export function cloneFloor(parts: Parts, register: Register) {
  const openingRows = indexPackage(slideBase(parts, register)).elements
  return (source: SlideId, id: SlideId) => {
    const notes = elementId(`${source}.notes`)
    const found = openingRows
      .filter((row) => shapeOf(row.node).slide === source)
      .filter((row) => slideKind(row.node) !== "slide")
    const rows = [
      ...found,
      ...(found.some((row) => row.node === notes)
        ? []
        : [{ node: notes, kind: "slide" as const, value: null, box: null, grouped: false }]),
    ].flatMap((row) => {
      const value = shownValue(register, row.node, row.value ?? "")
      if (row.node === notes && row.value === null && value === "") return []
      const body = register.nodes.includes(row.node) ? register.elements[row.node] : undefined
      const opening = floorOpening(register, row.node, body === undefined ? {} : landedPatch(body, "text"))
      const shown = { ...row, value: value === "" ? null : value, box: shownBox(register, row.node, row.box) }
      return [opening === undefined ? shown : { ...shown, opening }]
    })
    return floorFor([...rows, ownFloor(register, source)], id)
  }
}

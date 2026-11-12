import {
  floorFor,
  shapeOf,
  type IndexElement,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { indexPackage, orderedParts } from "@airdesign/pptx"
import { shownBox } from "@/element-move"
import { slideBase } from "@/exported-parts"
import { shownValue } from "@/live-repaint"

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
    return { ...edit, floor: slideRows(orderedParts(parts, { file, order: [...register.order, edit] }), edit.id) }
  }
  if (edit.slide !== "clone") return edit
  const rows = slideRows(slideBase(parts, register), edit.source).map((row) => {
    const value = shownValue(register, row.node, row.value ?? "")
    return { ...row, value: value === "" ? null : value, box: shownBox(register, row.node, row.box) }
  })
  return { ...edit, floor: floorFor(rows, edit.id) }
}

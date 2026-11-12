import {
  elementId,
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
  const notes = elementId(`${edit.source}.notes`)
  const found = slideRows(slideBase(parts, register), edit.source)
  const rows = [
    ...found,
    ...(found.some((row) => row.node === notes)
      ? []
      : [{ node: notes, kind: "slide" as const, value: null, box: null, grouped: false }]),
  ].flatMap((row) => {
    const value = shownValue(register, row.node, row.value ?? "")
    if (row.node === notes && row.value === null && value === "") return []
    return [{ ...row, value: value === "" ? null : value, box: shownBox(register, row.node, row.box) }]
  })
  return { ...edit, floor: floorFor(rows, edit.id) }
}

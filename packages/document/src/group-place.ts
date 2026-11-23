import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import type { FieldEdit } from "./trait-patch.js"

export type Place = { readonly box: Box; readonly rot: number; readonly flipH: boolean; readonly flipV: boolean }

const fullTurn = 21_600_000
const turnsPerDegree = 60_000

export function throughGroup(child: Place, group: Place, frame: Box): Place {
  const scaleX = frame.cx === 0 ? 1 : group.box.cx / frame.cx
  const scaleY = frame.cy === 0 ? 1 : group.box.cy / frame.cy
  const scaledX = group.box.x + (child.box.x + child.box.cx / 2 - frame.x) * scaleX
  const scaledY = group.box.y + (child.box.y + child.box.cy / 2 - frame.y) * scaleY
  const middleX = group.box.x + group.box.cx / 2
  const middleY = group.box.y + group.box.cy / 2
  const fromX = (group.flipH ? 2 * middleX - scaledX : scaledX) - middleX
  const fromY = (group.flipV ? 2 * middleY - scaledY : scaledY) - middleY
  const radians = (group.rot / turnsPerDegree) * (Math.PI / 180)
  const centreX = middleX + fromX * Math.cos(radians) - fromY * Math.sin(radians)
  const centreY = middleY + fromX * Math.sin(radians) + fromY * Math.cos(radians)
  const cx = Math.round(child.box.cx * scaleX)
  const cy = Math.round(child.box.cy * scaleY)
  const turn = (group.flipH !== group.flipV ? -child.rot : child.rot) + group.rot
  return {
    box: { x: Math.round(centreX - cx / 2) + 0, y: Math.round(centreY - cy / 2) + 0, cx, cy },
    rot: ((turn % fullTurn) + fullTurn) % fullTurn,
    flipH: child.flipH !== group.flipH,
    flipV: child.flipV !== group.flipV,
  }
}

function designed(opening: IndexElement | undefined, key: "box.rot" | "box.flipH" | "box.flipV"): unknown {
  return opening?.design?.[key]?.[0]
}

export function openingPlace(opening: IndexElement | undefined): Place | null {
  if (opening?.box === null || opening?.box === undefined) return null
  return {
    box: opening.box,
    rot: turnOf(undefined, opening),
    flipH: flipOf(undefined, opening, "box.flipH"),
    flipV: flipOf(undefined, opening, "box.flipV"),
  }
}

function turnOf(edit: FieldEdit<unknown> | undefined, opening: IndexElement | undefined): number {
  if (typeof edit === "object" && typeof edit.set === "number") return edit.set
  const read = designed(opening, "box.rot")
  return typeof read === "number" ? Math.round(read * turnsPerDegree) % fullTurn : 0
}

function flipOf(
  edit: FieldEdit<unknown> | undefined,
  opening: IndexElement | undefined,
  key: "box.flipH" | "box.flipV",
): boolean {
  if (typeof edit === "object" && typeof edit.set === "boolean") return edit.set
  return designed(opening, key) === true
}

import type * as doom from "@airdesign/doom"
import { readKitPiece } from "@airdesign/skills"

import { refused, type Answer } from "./answer.js"

type Paste = Extract<doom.AgentChange, { op: "paste" }>
type Fields = Readonly<Record<string, unknown>>

const kitPrefix = "kit/"
const coordinate = (value: unknown) => typeof value === "number" && Number.isFinite(value)

function boxOf(box: unknown): Pick<Paste, "box"> | Answer {
  if (box === undefined) return {}
  const given = typeof box === "object" && box !== null ? (box as Fields) : {}
  const sides = ["x", "y", "w", "h"].filter((key) => given[key] !== undefined)
  if (!coordinate(given.x) || !coordinate(given.y) || !sides.every((key) => coordinate(given[key])))
    return refused("field", {
      field: "box",
      note: "box takes numbers: x and y, and w and h if the piece should take another size.",
    })
  return { box: Object.fromEntries(sides.map((key) => [key, given[key]])) as NonNullable<Paste["box"]> }
}

export function readPaste(fields: Fields): Pick<Paste, "piece" | "box"> | Answer | undefined {
  if (fields.from === undefined) {
    const placed = ["parent", "box"].find((key) => fields[key] !== undefined)
    return placed === undefined
      ? undefined
      : refused("field", {
          field: placed,
          note: `copy takes ${placed} only with from: a kit piece. A layer's copy lands right after it; move it after.`,
        })
  }
  const listed = ["target", "targets"].find((key) => fields[key] !== undefined)
  if (listed !== undefined) return refused("field", { field: listed, note: "copy takes from or targets, not both." })
  const from = fields.from
  const piece =
    typeof from === "string" && from.startsWith(kitPrefix) ? readKitPiece(from.slice(kitPrefix.length)) : undefined
  if (piece === undefined)
    return refused("field", {
      field: "from",
      note: `The kit has no ${JSON.stringify(from)}. Its pieces are listed by airdesign_read_skill({ name: "kit" }).`,
    })
  const box = boxOf(fields.box)
  return "fields" in box ? box : { piece: piece.tree, ...box }
}

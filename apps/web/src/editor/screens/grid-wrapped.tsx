import { gridMovePlacement } from "@airdesign/document"
import { useState } from "react"
import { EditorGrid } from "@/editor/editor-grid"
import { gridAnchor, type GridMoveSide } from "@/editor/grid-drop"
import { SlideThumb } from "@/editor/slide-thumb"
import { slideThumbWidth } from "@/editor/slide-sidebar"

const sectionNames = [
  { id: 0, name: "Introduction" },
  { id: 1, name: "Part 1: Basic Principles of Heat Pump Operation" },
  { id: 29, name: "Part 2: System Design Options/Considerations" },
  { id: 39, name: "Appendices" },
] as const

function initialRows(): number[][] {
  return [
    [0],
    Array.from({ length: 28 }, (_, index) => index + 1),
    Array.from({ length: 10 }, (_, index) => index + 29),
    [39, 40],
  ]
}

function moveSlides(
  rows: readonly (readonly number[])[],
  indices: readonly number[],
  at: number,
  side: GridMoveSide,
): number[][] {
  const flat = rows.flat()
  const moving = indices.flatMap((index) => {
    const id = flat[index]
    return id === undefined ? [] : [id]
  })
  return gridMovePlacement(
    rows.map((row) => [...row]),
    moving,
    gridAnchor(flat, indices, at, side),
    side,
  ).rows
}

function insertSlide(
  rows: readonly (readonly number[])[],
  after: number | undefined,
  side: "same" | "new",
): number[][] {
  const next = rows.map((row) => [...row])
  const flat = next.flat()
  const id = Math.max(-1, ...flat) + 1
  const anchor = after === undefined ? flat[0] : flat[after]
  const rowIndex = next.findIndex((row) => anchor !== undefined && row.includes(anchor))
  const row = next[rowIndex]
  if (row === undefined || anchor === undefined) return [...next, [id]]
  if (side === "new") {
    next.splice(rowIndex + 1, 0, [id])
    return next
  }
  row.splice(row.indexOf(anchor) + 1, 0, id)
  return next
}

export function GridWrapped() {
  const [rows, setRows] = useState(initialRows)
  const [current, setCurrent] = useState(0)
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(() => new Set())
  const flat = rows.flat()
  const starts: number[] = []
  let cursor = 0
  for (const row of rows) {
    starts.push(cursor)
    cursor += row.length
  }
  const sections = sectionNames
    .flatMap(({ id, name }) => {
      const start = flat.indexOf(id)
      return start < 0 ? [] : [{ name, start }]
    })
    .sort((left, right) => left.start - right.start)
  return (
    <div className="h-dvh">
      <EditorGrid
        id="grid-wrapped"
        title="Heat pumps"
        size={{ width: 12_192_000, height: 6_858_000 }}
        onSlides={() => undefined}
        onExport={() => undefined}
        strip={{
          count: flat.length,
          current,
          gridStarts: starts,
          sections,
          skipped: flat.map((id) => skipped.has(id)),
          onSelect: setCurrent,
          onSkip: (indices, next) => {
            setSkipped((held) => {
              const ids = new Set(held)
              for (const index of indices) {
                const id = flat[index]
                if (id === undefined) continue
                if (next) ids.add(id)
                else ids.delete(id)
              }
              return ids
            })
          },
          onAdd: (_layout, after, side) => {
            setRows((held) => insertSlide(held, after, side === "new" ? "new" : "same"))
          },
          onMoveMany: (indices, at, side = "same") => {
            setRows((held) => moveSlides(held, indices, at, side))
          },
          thumbHeight: Math.round((slideThumbWidth * 9) / 16),
          thumb: (index, width) => (
            <span data-origin={flat[index]}>
              <SlideThumb index={flat[index] ?? index} width={width} />
            </span>
          ),
        }}
      />
    </div>
  )
}

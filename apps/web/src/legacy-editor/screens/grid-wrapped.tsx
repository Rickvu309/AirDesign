import { gridMovePlacement } from "@airdesign/document"
import { useState } from "react"
import { EditorGrid } from "@/editor/editor-grid"
import { gridAnchor, type GridMoveSide } from "@/editor/grid-drop"
import { SlideThumb } from "@/editor/slide-thumb"
import { slideThumbWidth } from "@/editor/slide-sidebar"

type Group = { readonly key: string; readonly name: string | null; readonly slides: readonly number[] }

const sectionNames = [
  "Introduction",
  "Part 1: Basic Principles of Heat Pump Operation",
  "Part 2: System Design Options/Considerations",
  "Appendices",
] as const

function initialGroups(): Group[] {
  let next = 0
  return [1, 28, 10, 2].map((size, index) => {
    const slides = Array.from({ length: size }, (_, offset) => next + offset)
    next += size
    return { key: `f${String(index)}`, name: sectionNames[index] ?? null, slides }
  })
}

function regrouped(
  groups: readonly Group[],
  placed: readonly (readonly number[])[],
  moving: ReadonlySet<number>,
): Group[] {
  const owner = new Map(placed.flatMap((ids, index) => ids.map((id) => [id, index] as const)))
  const held = new Map<number, Group>()
  const claim = (group: Group, id: number | undefined) => {
    const at = id === undefined ? undefined : owner.get(id)
    if (at !== undefined && !held.has(at)) held.set(at, group)
  }
  for (const group of groups)
    claim(
      group,
      group.slides.find((id) => !moving.has(id)),
    )
  for (const group of groups) if (group.slides.every((id) => moving.has(id))) claim(group, group.slides[0])
  return placed.flatMap((slides, index) => {
    const first = slides[0]
    if (first === undefined) return []
    const group = held.get(index)
    return [{ key: group?.key ?? `r${String(first)}`, name: group?.name ?? null, slides: [...slides] }]
  })
}

function moveSlides(groups: readonly Group[], indices: readonly number[], at: number, side: GridMoveSide): Group[] {
  const flat = groups.flatMap((group) => group.slides)
  const moving = indices.flatMap((index) => {
    const id = flat[index]
    return id === undefined ? [] : [id]
  })
  const placed = gridMovePlacement(
    groups.map((group) => [...group.slides]),
    moving,
    gridAnchor(flat, indices, at, side),
    side,
  ).groups
  return regrouped(groups, placed, new Set(moving))
}

function insertSlide(groups: readonly Group[], after: number | undefined, side: "same" | "new"): Group[] {
  const flat = groups.flatMap((group) => group.slides)
  const id = Math.max(-1, ...flat) + 1
  const anchor = after === undefined ? flat[0] : flat[after]
  const at = groups.findIndex((group) => anchor !== undefined && group.slides.includes(anchor))
  const group = groups[at]
  const added: Group = { key: `r${String(id)}`, name: null, slides: [id] }
  if (group === undefined || anchor === undefined) return [...groups, added]
  if (side === "new") return groups.toSpliced(at + 1, 0, added)
  const slides = group.slides.toSpliced(group.slides.indexOf(anchor) + 1, 0, id)
  return groups.with(at, { ...group, slides })
}

export function GridWrapped() {
  const [groups, setGroups] = useState(initialGroups)
  const [current, setCurrent] = useState(0)
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(() => new Set())
  const flat = groups.flatMap((group) => group.slides)
  const starts: number[] = []
  let cursor = 0
  for (const group of groups) {
    starts.push(cursor)
    cursor += group.slides.length
  }
  const stripGroups = groups.map((group, index) => ({ name: group.name, start: starts[index] ?? 0, key: group.key }))
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
          groups: stripGroups,
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
            setGroups((held) => insertSlide(held, after, side === "new" ? "new" : "same"))
          },
          onMoveMany: (indices, at, side = "same") => {
            setGroups((held) => moveSlides(held, indices, at, side))
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

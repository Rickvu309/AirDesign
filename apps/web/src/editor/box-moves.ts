import { placedByFrame, resizedSides, type Box, type ElementId, type Register } from "@airdesign/document"
import { connect, memoryRemote, noteBoxes } from "@airdesign/live"
import type { Moved, PaintStore } from "@airdesign/render"
import { commitPatch, flushPending, storeBoxes, type BoxCommit, type CommitOutcome } from "@/commit-edit"
import type { DesignDeck } from "@/design/design-change"
import { deviceRegister } from "@/device-copy"
import { commitPlace } from "@/editor/group-actions"
import { landedBox, paintedBox, shownBox } from "@/element-move"
import { laidBox, storedBox } from "@/frame-boxes"
import { storedGroupBox, storedGroupBoxNow } from "@/group-boxes"
import { indexedRegister } from "@/indexed-register"
import { resizedCorners } from "@/resized-corners"
import { resizedSizing } from "@/resized-sizing"
import { boxName } from "@/undo-names"
import { draggedSize, relaidBoxes } from "@/editor/live-layout"

type RestBox = (target: ElementId, box: Box | null) => void

const movesInFlight = new WeakMap<PaintStore, Map<ElementId, Box>>()

type BoxMoves = {
  readonly onBoxes: (moved: readonly Moved[]) => Promise<void>
  readonly relayout: (boxes: ReadonlyMap<ElementId, Box>, grip: string) => ReadonlyMap<ElementId, Box> | null
}

export function boxMoves({ id, shown, undo, settle }: DesignDeck): BoxMoves {
  const { store, movables, shapes, canvases, current, bound, shownParts, shownRegister, showEdited } = shown
  const { record } = undo

  async function placed(only: Moved, rest: RestBox): Promise<"moved" | "kept" | "refused" | "stored"> {
    const opened = await connect(memoryRemote()).openDeck(id)
    if (!opened.ok) return "moved"
    const parts = shownParts.current
    const outcome = await commitPlace(id, parts, opened.register, only.id, only.box, async (undoable) => {
      if (undoable !== null) record({ name: "move", undoable })
      await showEdited("kept")
    })
    if (outcome === "kept") rest(only.id, landedBox(await deviceRegister(id), only.id))
    const register = shownRegister.current
    if (outcome === "stored" && register !== null) rest(only.id, landedBox(indexedRegister(parts, register), only.id))
    return outcome
  }

  async function storeMoved(
    moved: readonly Moved[],
    boxes: readonly BoxCommit[],
    framing: Register | null,
    rest: RestBox,
  ): Promise<CommitOutcome | "stored" | null> {
    const [only] = moved
    const place = moved.length === 1 && only !== undefined && !resized(only) ? await placed(only, rest) : "moved"
    if (place === "kept") return null
    if (place !== "moved") return place
    const opening = connect(memoryRemote()).openDeck(id)
    async function refused(target: ElementId) {
      rest(target, landedBox(await deviceRegister(id), target))
    }
    for (const { id: target } of moved) if (!movables.current.has(target)) await refused(target)
    const stored = await storeBoxes(
      connect,
      id,
      boxes,
      async (kept) => {
        const opened = await opening
        const beforeRegister = opened.ok ? indexedRegister(shownParts.current, opened.register) : framing
        let repaints = false
        const steps = boxes.flatMap((commit) => {
          const { box, element } = commit
          const target = element.id
          if (!kept.includes(target)) return []
          const file = shapes.current.get(target)?.box ?? paintedBox(canvases.current(current), target)
          const shown = shownBox(opened.ok ? opened.register : null, target, file)
          const before =
            storedGroupBoxNow(beforeRegister, target) ??
            (shown === null ? null : storedBox(beforeRegister, target, shown))
          if (bound.current.has(target) || (before !== null && (before.cx !== box.cx || before.cy !== box.cy)))
            repaints = true
          const name = before === null ? null : boxName(before, box)
          return before === null || name === null
            ? []
            : [
                {
                  name,
                  step: {
                    node: target,
                    before: commitPatch(before, commit, "before"),
                    after: commitPatch(box, commit, "after"),
                  },
                },
              ]
        })
        const [first] = steps
        if (first !== undefined) {
          const name =
            steps.length > 1 ? (steps.some((each) => each.name === "resize") ? "resize" : "move") : first.name
          record({
            name,
            undoable: { steps: steps.map((each) => each.step) },
          })
        }
        if (repaints) await showEdited("kept")
      },
      refused,
    )
    const grouped = moved.filter(({ id: target }) => storedGroupBoxNow(framing, target) !== undefined)
    if (grouped.length > 0) {
      await showEdited("kept")
      for (const each of grouped) rest(each.id, null)
    }
    return stored
  }

  async function onBoxes(moved: readonly Moved[]): Promise<void> {
    const latest = new Map(moved.map(({ id: target, box }) => [target, box]))
    const paint = store.current
    const inFlight = movesInFlight.get(paint) ?? new Map<ElementId, Box>()
    movesInFlight.set(paint, inFlight)
    for (const [target, box] of latest) inFlight.set(target, box)
    const isLatest = (target: ElementId) => inFlight.get(target) === latest.get(target)
    const rest: RestBox = (target, box) => {
      if (isLatest(target)) paint.placeBox(target, box)
    }
    const laid = paint.laidNow()
    const framing = framingNow()
    const boxes = commitsOf(framing, moved)
    const release = noteBoxes(
      id,
      boxes.map(({ box, element }) => ({ node: element.id, floor: element.file, box })),
    )
    const stored = await undo
      .turnAfter(() => storeMoved(moved, boxes, framing, rest))
      .finally(() => {
        release()
        for (const target of latest.keys()) if (isLatest(target)) inFlight.delete(target)
      })
    if (laid !== null && paint.laidNow() === laid) paint.lay(null)
    if (stored === "stored") settle(await flushPending(connect, id))
    else if (stored !== null) settle(stored)
  }

  function resized({ id: target, box }: Moved): boolean {
    const painted = canvases.current(current)?.elements.find((each) => each.id === target)?.box
    return painted != null && (painted.width !== box.cx || painted.height !== box.cy)
  }

  function framingNow(): Register | null {
    const register = shownRegister.current
    return register === null ? null : indexedRegister(shownParts.current, register)
  }

  function commitsOf(framing: Register | null, moved: readonly Moved[]): readonly BoxCommit[] {
    const painted = canvases.current(current)?.elements
    return moved.flatMap(({ id: target, box }) => {
      const element = movables.current.get(target)
      const stored = storedGroupBox(framing, target, box) ?? storedBox(framing, target, box)
      const shown = painted?.find((each) => each.id === target)
      const corners = resizedCorners(shown, box)
      const sizing = resizedSizing(shown, box)
      const sides = framing === null ? null : resizedSides(framing, target, stored)
      const laidOut = framing !== null && placedByFrame(framing, target) ? { laidOut: true as const } : {}
      return element === undefined
        ? []
        : [{ box: stored, element, ...corners, ...sizing, ...(sides === null ? {} : { sides }), ...laidOut }]
    })
  }

  function relayout(boxes: ReadonlyMap<ElementId, Box>, grip: string): ReadonlyMap<ElementId, Box> | null {
    const framing = framingNow()
    const now = (target: ElementId) => (framing === null ? undefined : laidBox(framing, target))
    const moved = [...boxes].map(([target, box]) => ({ id: target, box: draggedSize(box, now(target), grip) }))
    return relaidBoxes(framing, commitsOf(framing, moved))
  }

  return { onBoxes, relayout }
}

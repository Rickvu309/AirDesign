import {
  boxPatch,
  decide,
  elementId,
  elementsUndoable,
  format,
  openRegister,
  presentSlides,
  slideId,
  slideUndoable,
  type Command,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { emptyUndo, recorded, recordsInFlight, shownOf, turnBack, undoLabel, type UndoLink } from "./undo-list"

const node = elementId("256.2")
const file = [slideId("256"), slideId("257")] as const

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function undoableOf(register: Register, edit: SlideCommand): Undoable {
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) throw new Error("undoable")
  return undoable
}

function deckLink(start: Register) {
  let register = start
  const sent: string[] = []
  const link: UndoLink = {
    async openDeck() {
      return { ok: true, register }
    },
    async enqueue(_deck, value, target) {
      sent.push(`text ${value}`)
      register = landed(register, { command: "person", value, node: target })
      return { ok: true }
    },
    async enqueueBox(_deck, box, target) {
      sent.push(`box ${box.x}`)
      register = landed(register, { command: "person", property: "box", value: box, node: target })
      return { ok: true }
    },
    async enqueueRow(_deck, row, target) {
      sent.push(`row ${JSON.stringify(row.patch)}`)
      register = landed(register, { command: "person", ...row, node: target })
      return { ok: true }
    },
    async enqueueSlide(_deck, known, edit) {
      sent.push(`slide ${edit.slide}`)
      register = landed(register, { command: "slide", file: known, edit })
      return { ok: true }
    },
  }
  return {
    link,
    sent,
    write(command: Command) {
      register = landed(register, command)
    },
  }
}

function edited(): Register {
  const opened = landed(openRegister("", ""), { command: "add", node, floor: "Old", route: "" })
  return landed(opened, { command: "person", value: "New", node })
}

const text = (value: string) => ({ text: { value: { set: value } } })
const step = (before: string, after: string) => ({ node, before: text(before), after: text(after) })

const textEdit = { name: "text", undoable: { steps: [step("Old", "New")] } } as const

describe("undo list", () => {
  it("undoes the last edit, keeps it for redo, and redoes it", async () => {
    const deck = deckLink(edited())
    const list = recorded(emptyUndo, textEdit)
    const undone = await turnBack(deck.link, "deck", list, "undo")
    expect(undone.outcome).toBe("turned")
    expect(undone.list).toEqual({ undo: [], redo: [textEdit] })
    const redone = await turnBack(deck.link, "deck", undone.list, "redo")
    expect(redone.list).toEqual({ undo: [textEdit], redo: [] })
    expect(deck.sent).toEqual(["text Old", "text New"])
  })

  it("drops an edit someone changed after and sends nothing", async () => {
    const deck = deckLink(edited())
    deck.write({ command: "person", value: "Aira", node })
    const turned = await turnBack(deck.link, "deck", recorded(emptyUndo, textEdit), "undo")
    expect(turned).toEqual({ outcome: "changed", list: emptyUndo, entry: textEdit })
    expect(deck.sent).toEqual([])
  })

  it("turns a step on two elements back through one entry", async () => {
    const other = elementId("256.3")
    const opened = landed(edited(), { command: "add", node: other, floor: "Old", route: "" })
    const deck = deckLink(landed(opened, { command: "person", value: "New", node: other }))
    const both = {
      name: "format",
      undoable: { steps: [step("Old", "New"), { ...step("Old", "New"), node: other }] },
    } as const
    const turned = await turnBack(deck.link, "deck", recorded(emptyUndo, both), "undo")
    expect(turned.outcome).toBe("turned")
    expect(deck.sent).toEqual(["text Old", "text Old"])
    expect(undoLabel("redo", shownOf(turned.list, null))).toBe("Redo text format")
  })

  it("sends a fill step through the row queue, back to the opening fill and forward again", async () => {
    const after = { fill: { value: { set: { solid: { scheme: "accent2" as const } } } } }
    const deck = deckLink(landed(edited(), { command: "person", v: format, patch: after, node }))
    const fill = {
      name: "fill",
      undoable: { steps: [{ node, before: { fill: { value: "opening" } }, after }] },
    } as const
    const undone = await turnBack(deck.link, "deck", recorded(emptyUndo, fill), "undo")
    expect(undone.outcome).toBe("turned")
    await turnBack(deck.link, "deck", undone.list, "redo")
    expect(deck.sent).toEqual([`row {"fill":{"value":"opening"}}`, `row ${JSON.stringify(after)}`])
    expect(undoLabel("undo", shownOf(recorded(emptyUndo, fill), null))).toBe("Undo fill")
  })

  it("has nothing to undo on an empty list", async () => {
    const deck = deckLink(edited())
    expect(await turnBack(deck.link, "deck", emptyUndo, "redo")).toEqual({ outcome: "empty", list: emptyUndo })
  })

  it("keeps the keystrokes of one text session as one edit, and drops a session that ends where it began", () => {
    const typed = (after: string) => ({ name: "text", session: 1, undoable: { steps: [step("Ol", after)] } }) as const
    const first = recorded(emptyUndo, { ...textEdit, session: 1 })
    const second = recorded(first, typed("Newer"))
    expect(second.undo).toEqual([{ ...textEdit, session: 1, undoable: { steps: [step("Old", "Newer")] } }])
    expect(recorded(second, typed("Old"))).toEqual(emptyUndo)
    expect(recorded(second, { ...typed("Two"), session: 2 }).undo).toHaveLength(2)
  })

  it("five arrow presses in one visit are one entry", () => {
    const other = elementId("256.3")
    const width = (w: number) => ({ box: { w: { set: w } } })
    const press = (from: number) =>
      ({
        name: "resize",
        session: 3,
        undoable: {
          steps: [
            { node, before: width(from), after: width(from + 1) },
            { node: other, before: width(from), after: width(from + 1) },
          ],
        },
      }) as const
    const visit = [432, 433, 434, 435, 436].map(press).reduce(recorded, emptyUndo)
    expect(visit.undo).toEqual([
      {
        name: "resize",
        session: 3,
        undoable: {
          steps: [
            { node, before: width(432), after: width(437) },
            { node: other, before: width(432), after: width(437) },
          ],
        },
      },
    ])
    const swapped = { ...press(437), undoable: { steps: [...press(437).undoable.steps].reverse() } }
    expect(recorded(visit, swapped).undo).toHaveLength(2)
    expect(recorded(visit, { ...press(437), session: 4 }).undo).toHaveLength(2)
  })

  it("clears redo when a new edit is recorded", () => {
    const list = { undo: [], redo: [textEdit] }
    expect(recorded(list, textEdit)).toEqual({ undo: [textEdit], redo: [] })
  })

  it("sends a box and a slide edit through their own queues", async () => {
    const moved = landed(edited(), { command: "person", property: "box", value: { x: 9, y: 0, cx: 1, cy: 1 }, node })
    const removed = landed(moved, { command: "slide", file, edit: { slide: "remove", id: file[1] } })
    const deck = deckLink(removed)
    const box = {
      name: "move",
      undoable: {
        steps: [
          { node, before: boxPatch({ x: 1, y: 0, cx: 1, cy: 1 }), after: boxPatch({ x: 9, y: 0, cx: 1, cy: 1 }) },
        ],
      },
    } as const
    const key = presentSlides({ file, order: [] })[1]?.key
    if (key === undefined) throw new Error("key")
    const slide = {
      name: "delete",
      undoable: {
        slide: file[1],
        file,
        before: { present: true, key },
        after: { present: false, key },
      },
    } as const
    const list = recorded(recorded(emptyUndo, box), slide)
    const first = await turnBack(deck.link, "deck", list, "undo")
    const second = await turnBack(deck.link, "deck", first.list, "undo")
    expect(second.outcome).toBe("turned")
    expect(deck.sent).toEqual(["slide restore", "box 1"])
  })

  it("takes back an added text box and a deleted element through the slide queue, and names each", async () => {
    const box = {
      node: elementId("256.9"),
      kind: "shape" as const,
      value: "",
      box: { x: 0, y: 0, cx: 1, cy: 1 },
      grouped: false,
    }
    const add: SlideCommand = { slide: "element-add", id: file[0], element: box }
    const remove: SlideCommand = { slide: "element-remove", id: file[0], node }
    const added = landed(edited(), { command: "slide", file, edit: add })
    const removed = landed(added, { command: "slide", file, edit: remove })
    const deck = deckLink(removed)
    const addBox = { name: "add-box", undoable: undoableOf(edited(), add) } as const
    const deleted = { name: "delete-element", undoable: undoableOf(added, remove) } as const
    const list = recorded(recorded(emptyUndo, addBox), deleted)
    expect(undoLabel("undo", shownOf(list, null))).toBe("Undo delete element")
    const first = await turnBack(deck.link, "deck", list, "undo")
    expect(undoLabel("undo", shownOf(first.list, null))).toBe("Undo add text box")
    expect(undoLabel("redo", shownOf(first.list, null))).toBe("Redo delete element")
    const second = await turnBack(deck.link, "deck", first.list, "undo")
    expect(undoLabel("redo", shownOf(second.list, null))).toBe("Redo add text box")
    const third = await turnBack(deck.link, "deck", second.list, "redo")
    expect(third.outcome).toBe("turned")
    expect(deck.sent).toEqual(["slide element-restore", "slide element-remove", "slide element-restore"])
  })

  it("keeps for the other list only the elements a turn took back, so one an agent deleted in between stays gone", async () => {
    const other = elementId("256.3")
    const opened = landed(edited(), { command: "add", node: other, floor: "Old", route: "" })
    const edits = [node, other].map((each) => ({ slide: "element-remove", id: file[0], node: each }) as const)
    const undoable = elementsUndoable(opened, file, edits)
    if (undoable === null) throw new Error("undoable")
    const deck = deckLink(edits.reduce((register, edit) => landed(register, { command: "slide", file, edit }), opened))
    const list = recorded(emptyUndo, { name: "delete-element", undoable })
    const undone = await turnBack(deck.link, "deck", list, "undo")
    expect(undone.outcome).toBe("turned")
    deck.write({ command: "slide", file, edit: edits[0]! })
    const redone = await turnBack(deck.link, "deck", undone.list, "redo")
    expect(redone.outcome).toBe("turned")
    const again = await turnBack(deck.link, "deck", redone.list, "undo")
    expect(again.outcome).toBe("turned")
    expect(deck.sent).toEqual([
      "slide element-restore",
      "slide element-restore",
      "slide element-remove",
      "slide element-restore",
    ])
  })

  it("names the edit each button undoes or redoes", () => {
    expect(undoLabel("undo", shownOf(recorded(emptyUndo, { ...textEdit, name: "notes" }), null))).toBe(
      "Undo speaker notes edit",
    )
    expect(undoLabel("undo", shownOf(emptyUndo, null))).toBe("Undo")
    expect(undoLabel("redo", shownOf(emptyUndo, null))).toBe("Redo")
    expect(undoLabel("undo", shownOf(recorded(emptyUndo, textEdit), null))).toBe("Undo text edit")
    expect(undoLabel("redo", shownOf({ undo: [], redo: [{ ...textEdit, name: "delete" }] }, null))).toBe(
      "Redo delete slide",
    )
  })

  it("lands only once every edit still being recorded is recorded", async () => {
    const records = recordsInFlight()
    const first = records.hold()
    const second = records.hold()
    let landed = false
    const waited = records.landed().then(() => {
      landed = true
    })
    first()
    first()
    await Promise.resolve()
    expect(landed).toBe(false)
    second()
    await waited
    expect(landed).toBe(true)
    await records.landed()
  })
})

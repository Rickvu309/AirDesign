import {
  decide,
  elementId,
  openRegister,
  presentSlides,
  slideId,
  type Command,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { emptyUndo, recorded, turnBack, undoLabel, type UndoLink } from "./undo-list"

const node = elementId("256.2")
const file = [slideId("256"), slideId("257")] as const

function landed(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
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

const textEdit = {
  name: "text",
  undoable: { node, floor: "Old", before: { value: "Old" }, after: { value: "New" } },
} as const

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

  it("has nothing to undo on an empty list", async () => {
    const deck = deckLink(edited())
    expect(await turnBack(deck.link, "deck", emptyUndo, "redo")).toEqual({ outcome: "empty", list: emptyUndo })
  })

  it("keeps the keystrokes of one text session as one edit, and drops a session that ends where it began", () => {
    const typed = (after: string) =>
      ({
        name: "text",
        session: 1,
        undoable: { ...textEdit.undoable, before: { value: "Ol" }, after: { value: after } },
      }) as const
    const first = recorded(emptyUndo, { ...textEdit, session: 1 })
    const second = recorded(first, typed("Newer"))
    expect(second.undo).toEqual([
      { ...textEdit, session: 1, undoable: { ...textEdit.undoable, after: { value: "Newer" } } },
    ])
    expect(recorded(second, typed("Old"))).toEqual(emptyUndo)
    expect(recorded(second, { ...typed("Two"), session: 2 }).undo).toHaveLength(2)
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
        node,
        floor: "Old",
        before: { property: "box", value: { x: 1, y: 0, cx: 1, cy: 1 } },
        after: { property: "box", value: { x: 9, y: 0, cx: 1, cy: 1 } },
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
    const added = landed(edited(), {
      command: "slide",
      file,
      edit: { slide: "element-add", id: file[0], element: box },
    })
    const removed = landed(added, { command: "slide", file, edit: { slide: "element-remove", id: file[0], node } })
    const deck = deckLink(removed)
    const addBox = {
      name: "add-box",
      undoable: { element: box.node, slide: file[0], file, before: false, after: true },
    } as const
    const deleted = {
      name: "delete-element",
      undoable: { element: node, slide: file[0], file, before: true, after: false },
    } as const
    const list = recorded(recorded(emptyUndo, addBox), deleted)
    expect(undoLabel("undo", list)).toBe("Undo delete element")
    const first = await turnBack(deck.link, "deck", list, "undo")
    expect(undoLabel("undo", first.list)).toBe("Undo add text box")
    expect(undoLabel("redo", first.list)).toBe("Redo delete element")
    const second = await turnBack(deck.link, "deck", first.list, "undo")
    expect(undoLabel("redo", second.list)).toBe("Redo add text box")
    const third = await turnBack(deck.link, "deck", second.list, "redo")
    expect(third.outcome).toBe("turned")
    expect(deck.sent).toEqual(["slide element-restore", "slide element-remove", "slide element-restore"])
  })

  it("names the edit each button undoes or redoes", () => {
    expect(undoLabel("undo", recorded(emptyUndo, { ...textEdit, name: "notes" }))).toBe("Undo speaker notes edit")
    expect(undoLabel("undo", emptyUndo)).toBe("Undo")
    expect(undoLabel("redo", emptyUndo)).toBe("Redo")
    expect(undoLabel("undo", recorded(emptyUndo, textEdit))).toBe("Undo text edit")
    expect(undoLabel("redo", { undo: [], redo: [{ ...textEdit, name: "delete" }] })).toBe("Redo delete slide")
  })
})

import { describe, expect, it } from "vitest"
import {
  decide,
  elementId,
  elementStacks,
  groupedNow,
  groupFormed,
  groupOf,
  nextElementId,
  openingElement,
  openRegister,
  placeOf,
  readSlideState,
  redoOf,
  slideId,
  slideUndoable,
  throughGroup,
  undoOf,
  undoSlides,
  ungroupTurn,
  version,
  type Command,
  type IndexElement,
  type Register,
  type SlideCommand,
} from "./index.js"

const slide = slideId("256")
const file = [slide]
const a = elementId("256.2")
const b = elementId("256.3")
const g = elementId("256.4")
const first = elementId("256.5")
const second = elementId("256.6")
const title = elementId("256.7")
const made = elementId("256.20")

const elements: readonly IndexElement[] = [
  { node: a, kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: b, kind: "shape", value: "", box: { x: 400, y: 300, cx: 100, cy: 100 }, grouped: false },
  {
    node: g,
    kind: "group",
    value: null,
    box: { x: 1000, y: 1000, cx: 400, cy: 200 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 200, cy: 100 },
  },
  { node: first, kind: "shape", value: "", box: { x: 0, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  { node: second, kind: "shape", value: "", box: { x: 100, y: 0, cx: 100, cy: 100 }, grouped: true, group: g },
  { node: title, kind: "shape", value: "Title", box: { x: 0, y: 0, cx: 900, cy: 100 }, grouped: false, role: "title" },
]

const indexed: Register = {
  ...openRegister("", ""),
  index: {
    total: elements.length,
    slides: [{ id: "256", position: 0, free: 20, animated: [] }],
    elements,
    pages: [{ once: "page", offset: 0, count: elements.length }],
  },
}

function slideEdit(register: Register, edit: SlideCommand) {
  return decide(register, { command: "slide", file, edit })
}

function applied(register: Register, edit: SlideCommand): Register {
  const decision = slideEdit(register, edit)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function ran(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") throw new Error(opened.code)
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

function grouped(register: Register): Register {
  const command = groupOf(register, slide, made, [a, b])
  if (command === null) throw new Error("group")
  return applied(register, command)
}

function moved(register: Register, node: typeof a, x: number): Register {
  return ran(register, [{ command: "person", v: 13, patch: { box: { x: { set: x } } }, node }])
}

describe("element group", () => {
  it("groups two shapes in a child frame equal to the group's box, so neither moves", () => {
    const command = groupOf(indexed, slide, made, [a, b])
    expect(command?.element).toEqual({
      node: made,
      kind: "group",
      value: null,
      box: { x: 100, y: 100, cx: 400, cy: 300 },
      grouped: false,
    })
    const after = grouped(indexed)
    expect(groupedNow(after, a)).toBe(true)
    expect(openingElement(after, made)?.kind).toBe("group")
    expect(placeOf(after, a)).toEqual({ box: elements[0]?.box, rot: 0, flipH: false, flipV: false })
    const boxed = ran(after, [])
    const opened = decide(boxed, { command: "add", node: a, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(opened.code)
    expect(
      decide(opened.register, { command: "person", property: "box", value: { x: 1, y: 1, cx: 200, cy: 100 }, node: a }),
    ).toEqual({
      decision: "refuse",
      code: "group-box",
    })
    expect(placeOf(moved(after, made, 600), made)?.box).toEqual({ x: 600, y: 100, cx: 400, cy: 300 })
    expect(nextElementId(after, slide, 3)).toBe("256.21")
  })

  it("keeps a moved shape where the person put it when it joins a group", () => {
    const shifted = moved(indexed, a, 700)
    const command = groupOf(shifted, slide, made, [a, b])
    expect(command?.members[0]).toEqual({ node: a, box: { x: 700, y: 100, cx: 200, cy: 100 } })
    expect(placeOf(applied(shifted, command!), a)?.box).toEqual({ x: 700, y: 100, cx: 200, cy: 100 })
  })

  it("refuses a group of one, of a grouped element, of a placeholder, with a wrong box or a used id", () => {
    const pair = groupOf(indexed, slide, made, [a, b])!
    expect(groupOf(indexed, slide, made, [a])).toBeNull()
    const refusal = (edit: SlideCommand) => slideEdit(indexed, edit)
    expect(
      refusal({ ...pair, members: [...pair.members.slice(0, 1), { node: first, box: { x: 0, y: 0, cx: 1, cy: 1 } }] }),
    ).toEqual({
      decision: "refuse",
      code: "group-box",
    })
    const withTitle = groupOf(indexed, slide, made, [a, title])!
    expect(refusal(withTitle)).toEqual({ decision: "refuse", code: "kind" })
    expect(refusal({ ...pair, element: { ...pair.element, box: { x: 0, y: 0, cx: 1, cy: 1 } } })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    expect(refusal({ ...pair, element: { ...pair.element, node: g } })).toEqual({ decision: "refuse", code: "present" })
    const dissolved = applied(grouped(indexed), { slide: "element-ungroup", id: slide, node: made })
    expect(slideEdit(dissolved, pair)).toEqual({ decision: "refuse", code: "present" })
  })

  it("maps each child of a file group through its frame, so ungrouping moves nothing", () => {
    const turn = ungroupTurn(indexed, file, slide, g)
    if (turn === null) throw new Error("ungroup")
    const after = ran(indexed, turn)
    expect(groupFormed(after, g)).toBe(false)
    expect(groupedNow(after, first)).toBe(false)
    expect(placeOf(after, first)).toEqual({
      box: { x: 1000, y: 1000, cx: 200, cy: 200 },
      rot: 0,
      flipH: false,
      flipV: false,
    })
    expect(placeOf(after, second)?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
    expect(placeOf(moved(after, first, 5), first)?.box).toEqual({ x: 5, y: 1000, cx: 200, cy: 200 })
  })

  it("turns and mirrors a child through a flipped, turned group as the painter does", () => {
    const frame = { x: 0, y: 0, cx: 200, cy: 100 }
    const child = { box: { x: 0, y: 0, cx: 100, cy: 100 }, rot: 0, flipH: false, flipV: false }
    const group = { box: frame, rot: 5_400_000, flipH: true, flipV: false }
    expect(throughGroup(child, group, frame)).toEqual({
      box: { x: 50, y: 50, cx: 100, cy: 100 },
      rot: 5_400_000,
      flipH: true,
      flipV: false,
    })
    expect(throughGroup(child, { ...group, rot: 0, flipH: false }, frame)).toEqual(child)
  })

  it("undoes a person's group by ungrouping it in place and redoes it by putting the same group back", () => {
    const command = groupOf(indexed, slide, made, [a, b])!
    const undoable = slideUndoable(indexed, file, command)
    expect(undoable).toEqual({ group: made, slide, file, before: false, after: true })
    const after = applied(indexed, command)
    const undone = undoOf(moved(after, made, 100), undoable!)
    if (!undone.ok) throw new Error("undo")
    const back = ran(moved(after, made, 100), undone.commands)
    expect(groupFormed(back, made)).toBe(false)
    expect(placeOf(back, a)?.box).toEqual(elements[0]?.box)
    const redone = redoOf(back, undoable!)
    if (!redone.ok) throw new Error("redo")
    expect(redone.commands).toEqual([
      { command: "slide", file, edit: { slide: "element-regroup", id: slide, node: made } },
    ])
    expect(groupedNow(ran(back, redone.commands), b)).toBe(true)
  })

  it("undoes a person's ungroup by putting the file group back, and redoes it with each child's place", () => {
    const edit: SlideCommand = { slide: "element-ungroup", id: slide, node: g }
    const undoable = slideUndoable(indexed, file, edit)
    expect(undoable).toEqual({ group: g, slide, file, before: true, after: false })
    const after = ran(indexed, ungroupTurn(indexed, file, slide, g)!)
    const undone = undoOf(after, undoable!)
    if (!undone.ok) throw new Error("undo")
    const back = ran(after, undone.commands)
    expect(groupFormed(back, g)).toBe(true)
    expect(groupedNow(back, first)).toBe(true)
    expect(placeOf(back, first)?.box).toEqual(elements[3]?.box)
    const redone = redoOf(back, undoable!)
    if (!redone.ok) throw new Error("redo")
    expect(placeOf(ran(back, redone.commands), second)?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
  })

  it("turns back a group an agent made when its run is undone, unless the person moved the group", () => {
    const command = groupOf(indexed, slide, made, [a, b])!
    const after = applied(indexed, { ...command, runId: "run" })
    const undone = undoSlides(after, "run")
    expect(undone === null ? null : groupFormed(undone, made)).toBe(false)
    expect(undone === null ? null : groupedNow(undone, a)).toBe(false)
    expect(undoSlides(moved(after, made, 9), "run")).toBeNull()
    const opened = ran(after, [{ command: "add", node: made, floor: "", route: "" }])
    const running = ran(opened, [{ command: "start", runId: "run", node: made }])
    const agentMoved = ran(running, [
      {
        command: "agent",
        runId: "run",
        readAt: version(running.elements[made]!),
        node: made,
        v: 13,
        patch: { box: { x: { set: 600 } } },
      },
    ])
    const turned = ungroupTurn(agentMoved, file, slide, made)
    const back = applied(ran(agentMoved, turned ?? []), { slide: "element-regroup", id: slide, node: made })
    expect(undoSlides(back, "run")).toBeNull()
    const ungrouped = applied(indexed, { slide: "element-ungroup", id: slide, node: g, runId: "run" })
    const regrouped = undoSlides(ungrouped, "run")
    expect(regrouped === null ? null : groupedNow(regrouped, first)).toBe(true)
  })

  it("lets a device without the index group and ungroup what it cannot check, and refuses what it can", () => {
    const { index: _index, ...bare } = indexed
    const pair = groupOf(indexed, slide, made, [a, b])!
    expect(slideEdit(bare, pair).decision).toBe("apply")
    expect(slideEdit(bare, { slide: "element-ungroup", id: slide, node: g }).decision).toBe("apply")
    expect(slideEdit(bare, { ...pair, element: { ...pair.element, box: { x: 0, y: 0, cx: 1, cy: 1 } } })).toEqual({
      decision: "refuse",
      code: "dead",
    })
    const after = applied(bare, pair)
    expect(slideEdit(after, { slide: "element-ungroup", id: slide, node: made }).decision).toBe("apply")
    expect(slideEdit(after, { ...pair, element: { ...pair.element, node: elementId("256.21") } })).toEqual({
      decision: "refuse",
      code: "group-box",
    })
  })

  it("reads each group command back from the stored order and refuses a malformed one", () => {
    const command = groupOf(indexed, slide, made, [a, b])!
    const order: SlideCommand[] = [
      command,
      { slide: "element-ungroup", id: slide, node: made },
      { slide: "element-regroup", id: slide, node: made },
    ]
    expect(readSlideState(JSON.parse(JSON.stringify({ file, order })))).toEqual({ file, order })
    expect(readSlideState({ file, order: [{ ...command, members: command.members.slice(0, 1) }] })).toBeUndefined()
    expect(
      readSlideState({
        file,
        order: [{ ...command, members: [{ node: a, box: command.members[0]?.box, rot: 0 }, command.members[1]] }],
      }),
    ).toBeUndefined()
    expect(readSlideState({ file, order: [{ slide: "element-ungroup", id: slide, node: "257.4" }] })).toBeUndefined()
  })

  it("starts a fresh stack order on a slide once its elements are grouped", () => {
    const ordered = applied(indexed, { slide: "element-order", id: slide, node: a, before: null, among: [a, b] })
    expect(elementStacks(ordered)).toHaveLength(1)
    expect(elementStacks(grouped(ordered))).toEqual([])
  })
})

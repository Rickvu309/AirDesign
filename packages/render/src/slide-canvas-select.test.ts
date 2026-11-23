import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement, Profiler } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type CanvasSlide,
  type PaintBox,
  type Selection,
} from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const scale = 12_192_000 / 1_200

const placed = (x: number, y: number, width: number, height: number, rotation = 0): PaintBox => ({
  x: x * scale,
  y: y * scale,
  width: width * scale,
  height: height * scale,
  rotation,
  flipH: false,
  flipV: false,
})

const a = elementId("256.2")
const b = elementId("256.3")
const c = elementId("256.4")
const group = elementId("256.9")
const backdrop = elementId("256.10")
const child1 = elementId("256.11")
const child2 = elementId("256.12")
const textNode = elementId("256.13")

function shape(id: ElementId, box: PaintBox, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind: "shape",
    box,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

const groupBox = placed(500, 100, 300, 200)
const frameCarry = { id: group, box: groupBox, frame: "auto" as const }

function baseElements(): readonly CanvasElement[] {
  return [
    shape(a, placed(50, 50, 100, 100)),
    shape(b, placed(200, 50, 100, 100)),
    shape(c, placed(50, 250, 100, 100)),
    shape(group, groupBox, { kind: "group", frame: "auto", filled: false }),
    shape(backdrop, groupBox, { group: frameCarry, backdrop: true, movable: false }),
    shape(child1, placed(520, 120, 100, 100), { group: frameCarry, movable: false }),
    shape(child2, placed(660, 120, 100, 100), { group: frameCarry, movable: false }),
    shape(textNode, placed(320, 250, 150, 80), { editable: true }),
  ]
}

async function mount(
  options: {
    elements?: readonly CanvasElement[]
    inStage?: boolean
    ownsKey?: (event: KeyboardEvent | React.KeyboardEvent) => boolean
    onUngroup?: (id: ElementId) => void
    onRender?: () => void
  } = {},
) {
  const elements = options.elements ?? baseElements()
  const store = paintStore()
  for (const each of elements) {
    if (each.id !== null)
      store.publish({
        id: each.id,
        kind: each.kind === "picture" ? "shape" : each.kind,
        text: each.id === textNode ? "Notes" : "",
      })
  }
  const boxes: [ElementId, Box][] = []
  const selections: Selection[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements }
  const canvas = createElement(SlideCanvas, {
    store,
    slide,
    width: 1_200,
    onEdit: () => undefined,
    onBoxes: (moved: readonly { id: ElementId; box: Box }[]) =>
      boxes.push(...moved.map(({ id, box }): [ElementId, Box] => [id, box])),
    onSelection: (next: Selection) => selections.push(next),
    ...(options.ownsKey === undefined ? {} : { ownsKey: options.ownsKey }),
    ...(options.onUngroup === undefined ? {} : { onUngroup: options.onUngroup }),
  })
  const wrapped =
    options.onRender === undefined
      ? canvas
      : createElement(Profiler, { id: "slide", onRender: options.onRender }, canvas)
  const tree =
    options.inStage === true
      ? createElement("div", { "data-canvas-stage": "" }, createElement("div", { "data-slide-wrapper": "" }, wrapped))
      : wrapped
  await act(async () => {
    root.render(tree)
  })
  return { host, store, boxes, selections }
}

function frameOf(host: HTMLElement, id: ElementId): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${id}"]`)
  if (found === null) throw new Error(`no element ${id}`)
  return found
}

function slideOf(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-slide-paint]")
  if (found === null) throw new Error("no slide")
  return found
}

function marqueeOf(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-slide-marquee]")
  if (found === null) throw new Error("no marquee")
  return found
}

function hoverOf(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-hover-outline]")
  if (found === null) throw new Error("no hover outline")
  return found
}

function chosenIds(host: HTMLElement): string[] {
  const single = host.querySelector("[data-selection]")?.getAttribute("data-selection")
  if (single !== null && single !== undefined) return [single]
  return [...host.querySelectorAll("[data-chosen]")].map((each) => each.getAttribute("data-chosen") ?? "")
}

async function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  init: Partial<PointerEventInit> = {},
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        pointerType: "mouse",
        ...init,
      }),
    )
  })
}

async function key(target: EventTarget, name: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: name, ...init }))
  })
}

async function dragMarquee(
  target: EventTarget,
  from: readonly [number, number],
  to: readonly [number, number],
  init: Partial<PointerEventInit> = {},
): Promise<void> {
  const doc = target instanceof Element ? target.ownerDocument : document
  await pointer(target, "pointerdown", from[0], from[1], init)
  await pointer(doc, "pointermove", to[0], to[1], init)
  await pointer(doc, "pointerup", to[0], to[1], init)
}

describe("SlideCanvas marquee selection", () => {
  it("draws a marquee overlay on empty slide drag and selects touched layers without re-rendering during empty movement", async () => {
    let renders = 0
    const { host } = await mount({ onRender: () => (renders += 1) })
    const surface = slideOf(host)
    const marquee = marqueeOf(host)
    expect(marquee.hidden).toBe(true)

    await pointer(surface, "pointerdown", 10, 10)
    const beforeEmptyMoves = renders
    await pointer(document, "pointermove", 20, 20)
    await pointer(document, "pointermove", 35, 35)
    expect(marquee.hidden).toBe(false)
    expect(marquee.style.width).toBe("25px")
    expect(marquee.style.height).toBe("25px")
    expect(renders).toBe(beforeEmptyMoves)

    await pointer(document, "pointermove", 220, 270)
    expect(chosenIds(host)).toEqual([a, b, c])
    await pointer(document, "pointerup", 220, 270)
    expect(marquee.hidden).toBe(true)
    expect(chosenIds(host)).toEqual([a, b, c])
  })

  it("starts a marquee from the surrounding canvas stage outside the slide", async () => {
    const { host } = await mount({ inStage: true })
    const stage = host.querySelector<HTMLElement>("[data-canvas-stage]")!
    await dragMarquee(stage, [-40, -20], [220, 120])
    expect(chosenIds(host)).toEqual([a, b])
  })

  it("adds layers on Shift-marquee without clearing the existing selection", async () => {
    const { host } = await mount()
    const surface = slideOf(host)
    await dragMarquee(surface, [10, 10], [220, 120])
    expect(chosenIds(host)).toEqual([a, b])

    await dragMarquee(surface, [10, 240], [160, 360], { shiftKey: true })
    expect(chosenIds(host)).toEqual([a, b, c])
  })

  it("deep-selects children inside groups and frames on Cmd/Ctrl-marquee and ignores backdrops", async () => {
    const { host } = await mount()
    const surface = slideOf(host)
    await dragMarquee(surface, [490, 90], [630, 230])
    expect(chosenIds(host)).toEqual([group])

    await dragMarquee(surface, [490, 90], [630, 230], { ctrlKey: true })
    expect(chosenIds(host)).toEqual([child1])

    await dragMarquee(frameOf(host, backdrop), [510, 110], [700, 230], { metaKey: true })
    expect(chosenIds(host)).toEqual([child1, child2])
  })

  it("cancels an active marquee on Escape and restores the prior selection", async () => {
    const { host } = await mount()
    const surface = slideOf(host)
    await pointer(frameOf(host, a), "pointerdown", 80, 80)
    await pointer(document, "pointerup", 80, 80)
    expect(chosenIds(host)).toEqual([a])

    await pointer(surface, "pointerdown", 180, 30)
    await pointer(document, "pointermove", 310, 160)
    expect(chosenIds(host)).toEqual([b])
    await key(window, "Escape")
    expect(marqueeOf(host).hidden).toBe(true)
    expect(chosenIds(host)).toEqual([a])
    await pointer(document, "pointerup", 310, 160)
    expect(chosenIds(host)).toEqual([a])
  })
})

describe("SlideCanvas groups, deep select, keyboard traversal and hover", () => {
  it("keeps a group selected on slow single clicks, steps in on double-click, and deep-selects on Cmd/Ctrl+click", async () => {
    const { host } = await mount()
    const firstChild = frameOf(host, child1)
    await pointer(firstChild, "pointerdown", 550, 150)
    await pointer(document, "pointerup", 550, 150)
    expect(chosenIds(host)).toEqual([group])

    await pointer(firstChild, "pointerdown", 550, 150)
    await pointer(document, "pointerup", 550, 150)
    expect(chosenIds(host)).toEqual([group])

    await act(async () => {
      firstChild.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))
    })
    expect(chosenIds(host)).toEqual([child1])

    await pointer(slideOf(host), "pointerdown", 10, 10)
    await pointer(document, "pointerup", 10, 10)
    expect(chosenIds(host)).toEqual([])

    await pointer(frameOf(host, child2), "pointerdown", 700, 150, { metaKey: true })
    await pointer(document, "pointerup", 700, 150, { metaKey: true })
    expect(chosenIds(host)).toEqual([child2])
  })

  it("steps up to parent on Escape and Shift+Enter, and selects children on Enter", async () => {
    const { host } = await mount()
    await pointer(frameOf(host, child1), "pointerdown", 550, 150, { ctrlKey: true })
    await pointer(document, "pointerup", 550, 150, { ctrlKey: true })
    expect(chosenIds(host)).toEqual([child1])

    await key(frameOf(host, child1), "Escape")
    expect(chosenIds(host)).toEqual([group])
    expect(document.activeElement).toBe(frameOf(host, group))

    await key(frameOf(host, group), "Enter")
    expect(chosenIds(host)).toEqual([child1, child2])

    await key(frameOf(host, child2), "Enter", { shiftKey: true })
    expect(chosenIds(host)).toEqual([group])
    await key(frameOf(host, group), "Enter", { shiftKey: true })
    expect(chosenIds(host)).toEqual([group])

    await key(frameOf(host, group), "Escape")
    expect(chosenIds(host)).toEqual([])
  })

  it("keeps Tab in the text being edited, as Figma does, and takes no selection key ownsKey denies", async () => {
    const { host } = await mount({ ownsKey: () => false })
    await pointer(frameOf(host, group), "pointerdown", 550, 150)
    await pointer(document, "pointerup", 550, 150)
    await pointer(frameOf(host, child1), "pointerdown", 550, 150, { ctrlKey: true })
    await pointer(document, "pointerup", 550, 150, { ctrlKey: true })
    expect(chosenIds(host)).toEqual([child1])
    await key(frameOf(host, child1), "Escape")
    await key(frameOf(host, child1), "Tab")
    expect(chosenIds(host)).toEqual([child1])

    const { host: host2 } = await mount()
    const editable = frameOf(host2, textNode).querySelector<HTMLElement>('[contenteditable="true"]')!
    await act(async () => {
      editable.focus()
    })
    expect(chosenIds(host2)).toEqual([textNode])
    const tabEvent = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Tab" })
    await act(async () => {
      editable.dispatchEvent(tabEvent)
    })
    expect(tabEvent.defaultPrevented).toBe(true)
    expect(chosenIds(host2)).toEqual([textNode])
    expect(document.activeElement).toBe(editable)
  })

  it("asks ownsKey only for the selection keys, so Ctrl+Shift+G still ungroups while a popover is open", async () => {
    const ungrouped: ElementId[] = []
    const { host } = await mount({ ownsKey: () => false, onUngroup: (id) => ungrouped.push(id) })
    await pointer(frameOf(host, child1), "pointerdown", 550, 150)
    await pointer(document, "pointerup", 550, 150)
    expect(chosenIds(host)).toEqual([group])
    await key(frameOf(host, group), "G", { code: "KeyG", ctrlKey: true, shiftKey: true })
    expect(ungrouped).toEqual([group])
  })

  it("paints a hover outline without re-rendering elements, switching to deep leaf while Cmd/Ctrl is held", async () => {
    let renders = 0
    const { host } = await mount({ onRender: () => (renders += 1) })
    const before = renders
    const outline = hoverOf(host)
    expect(outline.hidden).toBe(true)

    await pointer(frameOf(host, child1), "pointermove", 550, 150)
    expect(outline.hidden).toBe(false)
    expect(outline.dataset.hoverOutline).toBe(group)
    expect(renders).toBe(before)

    await pointer(frameOf(host, child1), "pointermove", 555, 150, { metaKey: true })
    expect(outline.dataset.hoverOutline).toBe(child1)
    expect(renders).toBe(before)

    await pointer(frameOf(host, child1), "pointermove", 555, 150, { pointerType: "touch" })
    expect(outline.hidden).toBe(true)
    expect(renders).toBe(before)

    await pointer(frameOf(host, a), "pointermove", 80, 80)
    expect(outline.dataset.hoverOutline).toBe(a)
    const hand = document.createElement("div")
    hand.dataset.handPan = ""
    document.body.append(hand)
    await pointer(frameOf(host, b), "pointermove", 220, 80)
    expect(outline.hidden).toBe(true)
    hand.remove()
    await pointer(frameOf(host, a), "pointermove", 80, 80)
    expect(outline.dataset.hoverOutline).toBe(a)
    await pointer(slideOf(host), "pointerleave", 0, 0)
    expect(outline.hidden).toBe(true)
    expect(renders).toBe(before)
  })

  it("keeps plain-group children and their selection frames at the moved group position despite stale pre-group boxes", async () => {
    const plainGroup = elementId("256.20")
    const member1 = elementId("256.21")
    const member2 = elementId("256.22")
    const movedGroupBox = placed(300, 140, 240, 100)
    const carry = { id: plainGroup, box: movedGroupBox }
    const { host, store } = await mount({
      elements: [
        shape(plainGroup, movedGroupBox, { kind: "group", filled: false }),
        shape(member1, placed(300, 140, 100, 100), { group: carry, movable: false }),
        shape(member2, placed(440, 140, 100, 100), { group: carry, movable: false }),
      ],
    })
    await act(async () => {
      store.placeBox(member1, { x: 100 * scale, y: 100 * scale, cx: 100 * scale, cy: 100 * scale })
      store.placeBox(plainGroup, { x: 380 * scale, y: 170 * scale, cx: 240 * scale, cy: 100 * scale })
    })
    expect(frameOf(host, member1).style.left).toBe("380px")
    expect(frameOf(host, member1).style.top).toBe("170px")

    await pointer(frameOf(host, member1), "pointerdown", 400, 200, { ctrlKey: true })
    await pointer(document, "pointerup", 400, 200, { ctrlKey: true })
    const single = host.querySelector<HTMLElement>("[data-selection]")!
    expect(single.style.left).toBe("380px")
    expect(single.style.top).toBe("170px")

    await key(frameOf(host, member1), "Escape")
    await key(frameOf(host, plainGroup), "Enter")
    const chosen = [...host.querySelectorAll<HTMLElement>("[data-chosen]")]
    expect(chosen.map((each) => each.style.left)).toEqual(["380px", "520px"])
    const around = host.querySelector<HTMLElement>("[data-selection-around]")!
    expect(around.style.left).toBe("380px")
    expect(around.style.top).toBe("170px")
  })
})

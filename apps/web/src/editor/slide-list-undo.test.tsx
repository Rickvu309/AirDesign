import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, beforeAll, expect, it, vi } from "vitest"
import { SlideSidebar, type SlideStrip } from "@/editor/slide-sidebar"
import { nodeId, type NodeId } from "@airdesign/doom"

let window: Window & typeof globalThis

beforeAll(async () => {
  const jsdomName = "jsdom"
  const jsdom = (await import(jsdomName)) as {
    JSDOM: new (html: string, options?: { url?: string }) => { readonly window: Window & typeof globalThis }
  }
  window = new jsdom.JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" }).window
  const shared: [string, unknown][] = [
    ["window", window],
    ["document", window.document],
    ["HTMLElement", window.HTMLElement],
    ["Element", window.Element],
    ["Node", window.Node],
    ["IS_REACT_ACT_ENVIRONMENT", true],
    ["requestAnimationFrame", (step: () => void) => setTimeout(step, 0)],
    ["cancelAnimationFrame", (handle: number) => clearTimeout(handle)],
  ]
  for (const [name, value] of shared) vi.stubGlobal(name, value)
})

afterAll(() => {
  vi.unstubAllGlobals()
  window.close()
})

const first: readonly NodeId[] = [1, 2, 3, 4, 5, 6].map((number) => nodeId(`n:${String(number)}`))

const copyOf = (id: NodeId | undefined): NodeId => nodeId(`c:${String(id).slice(2)}`)

type Deck = {
  other?: (order: readonly NodeId[]) => readonly NodeId[]
  setIds: (ids: readonly NodeId[]) => void
  setCurrent: (index: number) => void
}

function Harness({ deck }: { deck: Deck }) {
  const [ids, setIds] = useState(first)
  const [current, setCurrent] = useState(0)
  deck.setIds = setIds
  deck.setCurrent = setCurrent
  const strip: SlideStrip = {
    count: ids.length,
    slideIds: ids,
    current,
    onSelect: setCurrent,
    onMoveMany: () => undefined,
    onChangeSet: (change, held) => {
      if (change === "remove") {
        const gone = new Set(held.map((at) => ids[at]))
        const order = ids.filter((id) => !gone.has(id))
        setIds(deck.other?.(order) ?? order)
        setCurrent(0)
        return { picked: [], order }
      }
      const copies = held.map((at) => copyOf(ids[at]))
      const order = ids.flatMap((id, at) => (held.includes(at) ? [id, copyOf(id)] : [id]))
      setIds(deck.other?.(order) ?? order)
      setCurrent(held[0] === undefined ? 0 : held[0] + 1)
      return { picked: copies, order }
    },
    thumbHeight: 101,
    thumb: () => null,
  }
  return <SlideSidebar title="Deck" strip={strip} />
}

async function open() {
  const host = window.document.createElement("div")
  window.document.body.append(host)
  const root = createRoot(host)
  const deck: Deck = { setIds: () => undefined, setCurrent: () => undefined }
  await act(async () => root.render(<Harness deck={deck} />))
  const entry = (number: number) => host.querySelector<HTMLElement>(`[data-slide-entry="${String(number)}"]`)!
  const picked = () =>
    [...host.querySelectorAll<HTMLElement>("[data-slide-entry][data-selected]")].map((each) => each.dataset.slideEntry)
  const current = () => host.querySelector<HTMLElement>("[data-slide-entry][aria-current]")?.dataset.slideEntry
  const click = (number: number, shiftKey = false) =>
    act(async () => {
      entry(number).dispatchEvent(new window.MouseEvent("click", { bubbles: true, shiftKey }))
    })
  const press = (number: number, init: KeyboardEventInit) =>
    act(async () => {
      entry(number).dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }))
    })
  return { host, root, deck, picked, current, click, press }
}

it("puts the slides picked before back in the pick when a duplicate is undone, and the copies back when it is redone", async () => {
  const list = await open()
  try {
    await list.click(2)
    await list.click(4, true)
    expect(list.picked()).toEqual(["2", "3", "4"])
    const before = list.current()
    await list.press(2, { key: "d", ctrlKey: true })
    expect(list.host.querySelectorAll("[data-slide-entry]")).toHaveLength(9)
    const copies = list.picked()
    expect(copies).toHaveLength(3)

    await act(async () => {
      list.deck.setIds(first)
      list.deck.setCurrent(0)
    })
    expect(list.picked()).toEqual(["2", "3", "4"])
    expect(list.current()).toBe(before)

    await act(async () => {
      list.deck.setIds(first.flatMap((id, at) => (at >= 1 && at <= 3 ? [id, copyOf(id)] : [id])))
    })
    expect(list.picked()).toEqual(copies)
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("puts the slides picked before back in the pick when a delete is undone", async () => {
  const list = await open()
  try {
    await list.click(2)
    await list.click(3, true)
    expect(list.picked()).toEqual(["2", "3"])
    await list.press(2, { key: "Delete" })
    expect(list.host.querySelectorAll("[data-slide-entry]")).toHaveLength(4)
    expect(list.picked()).toEqual([])

    await act(async () => {
      list.deck.setIds(first)
      list.deck.setCurrent(0)
    })
    expect(list.picked()).toEqual(["2", "3"])
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("leaves the pick alone when the slides change in a way no set action made", async () => {
  const list = await open()
  try {
    await list.click(2)
    await list.click(3, true)
    await act(async () => list.deck.setIds(first.slice(0, 5)))
    await act(async () => list.deck.setIds(first))
    expect(list.picked()).toEqual(["2", "3"])
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("does not bring the old pick back when a later undo returns the slides to the order the duplicate made", async () => {
  const list = await open()
  try {
    await list.click(2)
    await list.click(5, true)
    await list.press(2, { key: "d", ctrlKey: true })
    const duplicated = [...list.host.querySelectorAll<HTMLElement>("[data-slide-entry]")].length
    expect(duplicated).toBe(10)
    const order = first.flatMap((id, at) => (at >= 1 && at <= 4 ? [id, copyOf(id)] : [id]))
    await act(async () => list.deck.setIds(order))
    await list.click(1)
    await list.press(1, { key: "ArrowDown", altKey: true })
    await act(async () => list.deck.setIds([order[1]!, order[0]!, ...order.slice(2)]))
    await list.click(8)
    await act(async () => list.deck.setIds(order))
    expect(list.picked()).toEqual([])
    expect(list.current()).toBe("8")
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("does not bring the old pick back after a third order came between the duplicate and the return", async () => {
  const list = await open()
  try {
    await list.click(2)
    await list.click(3, true)
    await list.press(2, { key: "d", ctrlKey: true })
    await act(async () => list.deck.setIds(first.slice(0, 5)))
    await act(async () => list.deck.setIds(first))
    expect(list.picked()).toEqual([])
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("records the order the duplicate made, so another tab's edit in the same render retires the step", async () => {
  const list = await open()
  try {
    list.deck.other = (order) => order.slice(0, -1)
    await list.click(2)
    await list.click(3, true)
    await list.press(2, { key: "d", ctrlKey: true })
    list.deck.other = undefined
    await act(async () => list.deck.setIds(first))
    expect(list.picked()).toEqual([])
  } finally {
    await act(async () => list.root.unmount())
  }
})

it("moves keyboard focus to the current slide after undo and redo, which can move it", async () => {
  const list = await open()
  try {
    await list.click(2)
    const entry = (number: number) => list.host.querySelector<HTMLElement>(`[data-slide-entry="${String(number)}"]`)!
    await act(async () => entry(2).focus())
    expect(window.document.activeElement).toBe(entry(2))

    await list.press(2, { key: "z", ctrlKey: true })
    await act(async () => {
      list.deck.setIds([first[1]!, first[0]!, ...first.slice(2)])
      list.deck.setCurrent(0)
    })
    expect(window.document.activeElement).toBe(entry(1))

    await list.press(1, { key: "Z", ctrlKey: true, shiftKey: true })
    await act(async () => {
      list.deck.setIds(first)
      list.deck.setCurrent(1)
    })
    expect(window.document.activeElement).toBe(entry(2))
  } finally {
    await act(async () => list.root.unmount())
  }
})

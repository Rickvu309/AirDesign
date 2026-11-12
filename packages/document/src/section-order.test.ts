import { describe, expect, it } from "vitest"
import { slideId, type SlideId } from "./element-id.js"
import { orderKeyBetween } from "./order-key.js"
import { foldSections } from "./section-order.js"
import { orderKeyAfter, presentSlides, type SlideCommand, type SlideState } from "./slide-order.js"

const file = ["256", "257", "258", "259"].map(slideId)
const base = [
  { name: "Opening", slides: ["256", "257"] },
  { name: "Numbers", slides: ["258", "259"] },
]

function listed(state: SlideState) {
  return foldSections(state, base).map((section) => ({ name: section.name, slides: [...section.slides] }))
}

function after(order: readonly SlideCommand[], id: SlideId): ReturnType<typeof orderKeyAfter> {
  return orderKeyAfter(presentSlides({ file, order }), id)
}

function addAfter(order: readonly SlideCommand[], id: string, anchor: SlideId): SlideCommand {
  const key = after(order, anchor)
  if (key === null) throw new Error("key")
  return { slide: "add", id: slideId(id), after: anchor, key, layout: anchor }
}

function cloneOf(order: readonly SlideCommand[], id: string, source: SlideId): SlideCommand {
  const key = after(order, source)
  if (key === null) throw new Error("key")
  return { slide: "clone", id: slideId(id), source, key }
}

describe("foldSections", () => {
  it("lists the sections of the file as they are when nothing was edited", () => {
    expect(listed({ file, order: [] })).toEqual([
      { name: "Opening", slides: ["256", "257"] },
      { name: "Numbers", slides: ["258", "259"] },
    ])
  })

  it("lists no section for a deck without sections or whose sections do not name every slide", () => {
    expect(foldSections({ file, order: [] }, [])).toEqual([])
    expect(foldSections({ file, order: [] }, [{ name: "Opening", slides: ["256"] }])).toEqual([])
  })

  it("puts a new slide in the section of the slide it comes after, even the last slide of a section", () => {
    const add = addAfter([], "260", file[1] as SlideId)
    expect(listed({ file, order: [add] })).toEqual([
      { name: "Opening", slides: ["256", "257", "260"] },
      { name: "Numbers", slides: ["258", "259"] },
    ])
  })

  it("puts a duplicate in the section of the slide it copies", () => {
    const clone = cloneOf([], "260", file[2] as SlideId)
    expect(listed({ file, order: [clone] })[1]).toEqual({ name: "Numbers", slides: ["258", "260", "259"] })
  })

  it("puts a slide added after a new slide in the same section", () => {
    const first = addAfter([], "260", file[3] as SlideId)
    const second = addAfter([first], "261", slideId("260"))
    expect(listed({ file, order: [first, second] })[1]?.slides).toEqual(["258", "259", "260", "261"])
  })

  it("takes a deleted slide out of its section and keeps a section left empty in place with no slides", () => {
    const one: SlideCommand = { slide: "remove", id: file[2] as SlideId }
    expect(listed({ file, order: [one] })[1]).toEqual({ name: "Numbers", slides: ["259"] })
    const both: SlideCommand[] = [one, { slide: "remove", id: file[3] as SlideId }]
    expect(listed({ file, order: both })).toEqual([
      { name: "Opening", slides: ["256", "257"] },
      { name: "Numbers", slides: [] },
    ])
  })

  it("returns a restored slide to the section it left", () => {
    const removed: SlideCommand = { slide: "remove", id: file[2] as SlideId }
    const key = presentSlides({ file, order: [] })[2]?.key
    if (key === undefined) throw new Error("key")
    const restored: SlideCommand = { slide: "restore", id: file[2] as SlideId, key }
    expect(listed({ file, order: [removed, restored] })).toEqual(listed({ file, order: [] }))
  })

  it("puts a moved slide in the section of the slide before it", () => {
    const present = presentSlides({ file, order: [] })
    const key = orderKeyBetween(present[1]?.key ?? null, present[2]?.key ?? null)
    const move: SlideCommand = { slide: "move", id: file[3] as SlideId, key }
    expect(listed({ file, order: [move] })).toEqual([
      { name: "Opening", slides: ["256", "257", "259"] },
      { name: "Numbers", slides: ["258"] },
    ])
  })

  it("puts a slide moved to the front in the first section and leaves the section it emptied with no slides", () => {
    const present = presentSlides({ file, order: [] })
    const front: SlideCommand = {
      slide: "move",
      id: file[3] as SlideId,
      key: orderKeyBetween(null, present[0]?.key ?? null),
    }
    expect(listed({ file, order: [front] })[0]?.slides).toEqual(["259", "256", "257"])
    const second: SlideCommand = {
      slide: "move",
      id: file[2] as SlideId,
      key: orderKeyBetween(null, present[0]?.key ?? null),
    }
    expect(listed({ file, order: [front, second] })).toEqual([
      { name: "Opening", slides: ["258", "259", "256", "257"] },
      { name: "Numbers", slides: [] },
    ])
  })
})

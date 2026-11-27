import * as doom from "@airdesign/doom"
import { createDoomDeck, memoryDoomRemote, memoryStorage } from "@airdesign/live"
import { describe, expect, it } from "vitest"
import { deleteWrites } from "./delete-writes"
import { ungroupWrites } from "./group-writes"
import { geometryOf } from "./slide-geometry"
import { deleteSlideWrites } from "./slide-writes"
import { draftWrites, leaveEmptyWrites, leaveWrites } from "./text-leave"
import { testTheme } from "@airdesign/doom/testing"

const id = doom.nodeId
const [deckId, row, first, second, text, group, child, holder, toText, toGroup, toOther, other] = [
  "d:1",
  "d:2",
  "d:3",
  "d:4",
  "d:5",
  "d:6",
  "d:7",
  "d:8",
  "d:9",
  "d:10",
  "d:11",
  "d:12",
].map(id) as [
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
  doom.NodeId,
]

const estimate = doom.measureWith({})
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })

let keyed: doom.OrderKey | null = null
function at(parent: doom.NodeId) {
  keyed = doom.orderKeyBetween(keyed, null)
  return { id: parent, at: keyed }
}

const joined = (node: doom.NodeId, type: string, parent: doom.NodeId, props: readonly [string, unknown][] = []) =>
  [
    { node, prop: "type", value: type },
    { node, prop: "parent", value: at(parent) },
    ...props.map(([prop, value]) => ({ node, prop, value })),
  ] as doom.Write[]

const connector = (node: doom.NodeId, to: doom.NodeId) =>
  joined(node, "shape", holder, [
    ["box", box(0, 0, 10, 10)],
    [
      "geometry",
      {
        kind: "line",
        start: { node: to, site: "r" },
        end: { x: 10, y: 10 },
        route: "straight",
        arrows: ["none", "none"],
      },
    ],
  ])

const start: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckId, prop: "type", value: "deck" },
    { node: deckId, prop: "theme", value: testTheme },
    { node: deckId, prop: "size", value: { w: 1920, h: 1080 } },
    ...joined(row, "slideRow", deckId),
    ...joined(first, "slide", row),
    ...joined(second, "slide", row),
    ...joined(text, "shape", first, [
      ["box", box(300, 200, 120, 40)],
      ["text", { ...doom.textFromMarkdown("Hello", "body"), resize: "height" }],
    ]),
    ...joined(group, "frame", first, [["box", box(300, 300, 140, 80)]]),
    ...joined(child, "shape", group, [["box", box(0, 0, 100, 50)]]),
    ...joined(other, "shape", second, [["box", box(50, 50, 100, 50)]]),
    ...joined(holder, "frame", first, [["box", box(100, 100, 400, 200)]]),
    ...connector(toText, text),
    ...connector(toGroup, group),
    ...connector(toOther, other),
  ],
}

const drifting: doom.Edit = {
  once: "start",
  author: { kind: "person", id: "start" },
  writes: [
    { node: deckId, prop: "type", value: "deck" },
    { node: deckId, prop: "theme", value: testTheme },
    { node: deckId, prop: "size", value: { w: 1920, h: 1080 } },
    ...joined(row, "slideRow", deckId),
    ...joined(first, "slide", row),
    ...joined(group, "frame", first, [
      ["box", box(100, 50, 1, 1)],
      ["layout", { mode: "row", gap: 10, padding: { t: 20, r: 20, b: 20, l: 20 }, align: "top-left" }],
      ["sizing", { w: "hug", h: "hug" }],
    ]),
    ...joined(text, "shape", group, [
      ["box", box(0, 0, 200, 100)],
      ["sizing", { w: "hug", h: "hug" }],
      ["text", { ...doom.textFromMarkdown("Hello world hello", "body"), resize: "widthAndHeight" }],
    ]),
    ...joined(child, "shape", group, [["box", box(0, 0, 100, 50)]]),
    ...joined(toText, "shape", first, [
      ["box", box(0, 0, 10, 10)],
      [
        "geometry",
        {
          kind: "line",
          start: { node: child, site: "l" },
          end: { x: 5, y: 5 },
          route: "straight",
          arrows: ["none", "none"],
        },
      ],
    ]),
  ],
}

async function opened(by: doom.Measure = estimate, seed: doom.Edit = start) {
  const made = await createDoomDeck(memoryDoomRemote(seed), "freed", {
    once: (() => {
      let next = 0
      return () => `once-${(next += 1)}`
    })(),
    client: "a",
    storage: memoryStorage(),
    pause: () => Promise.resolve(),
    measure: () => by,
  })
  if (!made.ok) throw new Error(JSON.stringify(made))
  return { deck: made.deck, client: made.deck }
}

function startOf(view: doom.Doom, line: doom.NodeId, by: doom.Measure = estimate): doom.Point {
  const walk = (nodes: readonly doom.Resolved[], x: number, y: number): doom.Point | null => {
    for (const node of nodes) {
      const atX = x + node.box.x
      const atY = y + node.box.y
      if (node.id === line && node.geometry?.kind === "line")
        return { x: atX + node.geometry.from.x, y: atY + node.geometry.from.y }
      const inside = walk(node.children, atX, atY)
      if (inside !== null) return inside
    }
    return null
  }
  const found = walk(doom.resolveSlide(view, first, by), 0, 0)
  if (found === null) throw new Error("line not painted")
  return found
}

function endOf(view: doom.Doom, line: doom.NodeId) {
  const geometry = doom.propOf(view.nodes.get(line), "geometry")
  if (geometry?.kind !== "line") throw new Error("not a line")
  return geometry.start
}

const emptied = (view: doom.Doom) =>
  leaveEmptyWrites({
    node: text,
    keeps: false,
    draft: { ...doom.textFromMarkdown("", "body"), resize: "height" },
    pushed: JSON.stringify(doom.propOf(view.nodes.get(text), "text")),
  })

const ungrouped = (view: doom.Doom) => {
  const made = ungroupWrites(view, geometryOf(doom.resolveSlide(view, first, estimate)), [group])
  if (made === null) throw new Error("nothing to ungroup")
  return made.writes
}

const cases = [
  { name: "emptying a text", line: toText, writes: emptied },
  { name: "deleting a shape", line: toText, writes: (view: doom.Doom) => deleteWrites(view, [text]) },
  { name: "ungrouping a frame", line: toGroup, writes: ungrouped },
  { name: "deleting a slide", line: toOther, writes: (view: doom.Doom) => deleteSlideWrites(view, [second]) },
]

describe("the editor's gestures free a connector end the moment its shape leaves the slide", () => {
  it.each(cases)(
    "$name keeps the end where it painted, and undo and redo move it with the attachment",
    async (made) => {
      const { client, deck } = await opened()
      const seen = startOf(client.view(), made.line)
      expect(seen).not.toEqual({ x: 100, y: 100 })
      expect(client.push(made.writes(client.view())).ok).toBe(true)
      expect("node" in endOf(client.view(), made.line)).toBe(false)
      expect(startOf(client.view(), made.line)).toEqual(seen)
      expect(deck.undo().ok).toBe(true)
      expect("node" in endOf(client.view(), made.line)).toBe(true)
      expect(startOf(client.view(), made.line)).toEqual(seen)
      expect(deck.redo().ok).toBe(true)
      expect("node" in endOf(client.view(), made.line)).toBe(false)
      expect(startOf(client.view(), made.line)).toEqual(seen)
    },
  )

  it("keeps a connector on a shape inside an ungrouped frame attached", async () => {
    const { client } = await opened()
    const onChild = connector(id("d:13"), child)
    client.push(onChild)
    client.push(ungrouped(client.view()))
    expect("node" in endOf(client.view(), id("d:13"))).toBe(true)
  })

  it("frees the end where the real widths painted it, not where the estimate puts it", async () => {
    const wide: doom.Measure = (words, theme, width) => {
      const measured = estimate(words, theme, width)
      return { ...measured, w: measured.w * 1.6 }
    }
    const { client } = await opened(wide, drifting)
    const seen = startOf(client.view(), toText, wide)
    expect(seen.x).not.toBe(startOf(client.view(), toText).x)
    client.push(deleteWrites(client.view(), [child]))
    expect("node" in endOf(client.view(), toText)).toBe(false)
    expect(startOf(client.view(), toText, wide)).toEqual(seen)
  })

  it("paints an emptied text's connector end where leaving the text editor will keep it", async () => {
    const wide: doom.Measure = (words, theme, width) => {
      const measured = estimate(words, theme, width)
      return { ...measured, w: measured.w * 1.6 }
    }
    const hugging: doom.Edit = {
      ...start,
      writes: start.writes.map((write) =>
        write.node === text && write.prop === "text"
          ? { ...write, value: { ...doom.textFromMarkdown("Hello", "body"), resize: "widthAndHeight" } }
          : write,
      ),
    }
    const { client } = await opened(wide, hugging)
    const seen = startOf(client.view(), toText, wide)
    const draft = {
      node: text,
      keeps: false,
      draft: { ...doom.textFromMarkdown("", "body"), resize: "widthAndHeight" as const },
      painted: { ...doom.textFromMarkdown("Hello", "body"), resize: "widthAndHeight" as const },
    }
    const typing = doom.viewOf(client.view(), [
      { once: "typing", author: { kind: "person", id: "typing" }, writes: draftWrites(client.view(), draft, wide) },
    ])
    expect(startOf(typing, toText, wide)).toEqual(seen)
    const leaving = leaveWrites(client.view(), { ...draft, pushed: "" })
    client.push(leaving.writes, { seen: leaving.seen })
    expect(startOf(client.view(), toText, wide)).toEqual(seen)
  })
  it("frees an emptied text's connector end where the last painted draft put it, not where the saved words put it", async () => {
    const wide: doom.Measure = (words, theme, width) => {
      const measured = estimate(words, theme, width)
      return { ...measured, w: measured.w * 1.6 }
    }
    const hugging: doom.Edit = {
      ...start,
      writes: start.writes.map((write) =>
        write.node === text && write.prop === "text"
          ? { ...write, value: { ...doom.textFromMarkdown("Hello world hello", "body"), resize: "widthAndHeight" } }
          : write,
      ),
    }
    const { client } = await opened(wide, hugging)
    const saved = startOf(client.view(), toText, wide)
    const short = { ...doom.textFromMarkdown("Hi", "body"), resize: "widthAndHeight" as const }
    const none = { ...doom.textFromMarkdown("", "body"), resize: "widthAndHeight" as const }
    const typed = doom.viewOf(client.view(), [
      {
        once: "typed",
        author: { kind: "person", id: "typed" },
        writes: draftWrites(client.view(), { node: text, keeps: false, draft: short, painted: short }, wide),
      },
    ])
    const seen = startOf(typed, toText, wide)
    expect(seen.x).not.toBe(saved.x)
    const left = { node: text, keeps: false, draft: none, painted: short, pushed: JSON.stringify(short) }
    const emptying = doom.viewOf(client.view(), [
      { once: "emptying", author: { kind: "person", id: "emptying" }, writes: draftWrites(client.view(), left, wide) },
    ])
    expect(startOf(emptying, toText, wide)).toEqual(seen)
    const leaving = leaveWrites(client.view(), left)
    expect(client.push(leaving.writes, { seen: leaving.seen }).ok).toBe(true)
    expect(doom.parentOf(client.view().nodes.get(text))).toBeNull()
    expect(startOf(client.view(), toText, wide)).toEqual(seen)
  })

  it("keeps an emptied text's connector end still while the empty text holds its place in an auto-layout row", async () => {
    const seed: doom.Edit = {
      ...drifting,
      writes: [
        ...drifting.writes.filter((write) => write.node !== toText),
        ...joined(holder, "frame", group, [["box", box(0, 0, 200, 100)]]),
        ...connector(toText, text),
      ],
    }
    const { client } = await opened(estimate, seed)
    const short: doom.Text = { ...doom.textFromMarkdown("Wi", "body"), resize: "widthAndHeight" }
    const blank: doom.Text = { ...doom.textFromMarkdown("", "body"), resize: "widthAndHeight" }
    const typing = { node: text, keeps: false, draft: short, painted: short }
    const left = { ...typing, draft: blank, pushed: "" }
    const shown = (writes: readonly doom.Write[]) =>
      doom.viewOf(client.view(), [{ once: "preview", author: { kind: "person", id: "typing" }, writes }])
    const seen = startOf(shown(draftWrites(client.view(), typing, estimate)), toText)
    expect(startOf(shown(draftWrites(client.view(), left, estimate)), toText)).toEqual(seen)
    const leaving = leaveWrites(client.view(), left)
    expect(client.push(leaving.writes, { seen: leaving.seen }).ok).toBe(true)
    expect(startOf(client.view(), toText)).toEqual(seen)
  })
})

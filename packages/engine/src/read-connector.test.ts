import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, readSlideId, type DeckIndex, type IndexElement } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { include } from "./call-fixtures.js"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)
const emuPerPoint = 12_700

const square = { cx: 1_000_000, cy: 1_000_000 }
const elements: readonly IndexElement[] = [
  { node: node(3), kind: "shape", value: "", box: { x: 1_000_000, y: 1_000_000, ...square }, grouped: false },
  { node: node(4), kind: "shape", value: "", box: { x: 4_000_000, y: 1_000_000, ...square }, grouped: false },
  {
    node: node(5),
    kind: "connector",
    value: null,
    box: { x: 2_000_000, y: 1_500_000, cx: 1_900_000, cy: 0 },
    grouped: false,
    design: { "connection.start": ["258.3 site 3"], "connection.end": ["258.4 site 1"], geometry: ["line"] },
  },
]

const plan = { x: 1_524_000, y: 2_286_000, cx: 2_286_000, cy: 1_143_000 }
const build = { x: 5_334_000, y: 3_810_000, cx: 2_286_000, cy: 1_143_000 }

function indexed(files: readonly IndexElement[] = elements): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: files.length,
    slides: [{ id: "258", position: 0, size, free: 9 }],
    elements: files,
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function edit(deck: Deck, ...changes: readonly object[]): Deck {
  return landed(call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes }))
}

function set(deck: Deck, target: string, change: object): Deck {
  const started = landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: target }] }))
  return landed(
    call("edit_deck", started, agent, {
      deck: "deck",
      base: started.revision,
      changes: [{ op: "set", target, ...change }],
    }),
  )
}

function read(deck: Deck, shape: number) {
  const answer = readDeckPage(deck, { runId: "run", slide: "258" })
  return answer.elements.find((each) => each.node === `258.${String(shape)}`)
}

describe("an agent reads a connector where it paints", () => {
  it("reads an untouched connector at its file box, even where its ends miss their sites", () => {
    expect(read(indexed(), 5)?.box).toEqual({ x: 157.5, y: 118.1, w: 149.6, h: 0 })
  })

  it("reads a connector between its sites once an agent moves the shape it ends on, flipped when it climbs, and back at its file box after Undo", () => {
    const moved = set(indexed(), "258.4", { box: { y: 254_000 / emuPerPoint } })
    expect(read(moved, 5)?.box).toEqual({ x: 157.5, y: 59.4, w: 157.5, h: 58.7 })
    expect(read(moved, 5)?.design).toContain("box.flipV")
    const undone = landed(call("undo_run", moved, person, { deck: "deck", runId: "run" }))
    expect(read(undone, 5)?.box).toEqual({ x: 157.5, y: 118.1, w: 149.6, h: 0 })
    expect(read(undone, 5)?.design ?? "").not.toContain("box.flip")
  })

  it("follows a person's resize of the shape it starts on", () => {
    const deck = indexed()
    const decision = decide(include(deck.register, node(3)), {
      command: "person",
      node: node(3),
      property: "box",
      value: { x: 1_000_000, y: 1_000_000, cx: 1_500_000, cy: 1_000_000 },
    })
    if (decision.decision !== "apply") throw new Error(decision.code)
    const moved = { ...deck, revision: deck.revision + 1, register: decision.register }
    expect(read(moved, 5)?.box).toEqual({ x: 196.9, y: 118.1, w: 118.1, h: 0 })
    expect(read(moved, 5)?.design ?? "").not.toContain("box.flip")
  })

  it("follows a diagram's shape when an agent moves it up", () => {
    const made = edit(indexed(), {
      op: "diagram",
      slide: "258",
      labels: ["Plan", "Build"],
      box: { x: 72, y: 300, w: 576, h: 100 },
    })
    const plan = read(made, 9)?.box
    if (plan == null) throw new Error("no diagram")
    const moved = set(made, "258.10", { box: { y: 100 } })
    const build = read(moved, 10)?.box
    if (build == null) throw new Error("no build")
    const start = { x: plan.x + plan.w, y: plan.y + plan.h / 2 }
    const end = { x: build.x, y: build.y + build.h / 2 }
    const arrow = read(moved, 11)?.box
    const wanted = { x: start.x, y: end.y, w: end.x - start.x, h: start.y - end.y }
    for (const side of ["x", "y", "w", "h"] as const) expect(arrow?.[side]).toBeCloseTo(wanted[side], 0)
    expect(read(moved, 11)?.design).toContain("box.flipV")
  })

  it("lets an agent attach to a site an ellipse a person drew has and a rectangle lacks", () => {
    const deck = indexed()
    const ellipse = {
      node: node(9),
      kind: "shape",
      value: null,
      box: { x: 6_000_000, y: 1_000_000, ...square },
      grouped: false,
    } as const
    const slide = readSlideId("258")
    if (slide === undefined) throw new Error("no slide")
    const drawn = decide(deck.register, {
      command: "slide",
      file: [slide],
      edit: { slide: "element-add", id: slide, element: ellipse, geometry: "ellipse" },
    })
    if (drawn.decision !== "apply") throw new Error(drawn.code)
    const attached = set({ ...deck, revision: deck.revision + 1, register: drawn.register }, "258.5", {
      connection: { end: { shape: { node: "258.9", site: 6 } } },
    })
    expect(read(attached, 5)?.design).toContain("connection.end 258.9 site 6")
  })

  it("routes the file's two elbows with kept geometry where the canvas paints them when an agent moves Build up", () => {
    const rounded = { fills: ["accent1"], geometry: ["roundRect"] } as const
    const elbow = { geometry: ["bentConnector3"], "border.tail": ["triangle"] } as const
    const file: readonly IndexElement[] = [
      { node: node(2), kind: "shape", value: "Plan", box: plan, grouped: false, design: rounded },
      { node: node(3), kind: "shape", value: "Build", box: build, grouped: false, design: rounded },
      {
        node: node(4),
        kind: "connector",
        value: null,
        box: { x: 3_810_000, y: 2_857_500, cx: 1_524_000, cy: 1_524_000 },
        grouped: false,
        design: { ...elbow, "connection.start": ["258.2 site 3"], "connection.end": ["258.3 site 1"] },
        kept: ["geometry"],
      },
      {
        node: node(5),
        kind: "connector",
        value: null,
        box: { x: 3_810_000, y: 2_286_000, cx: 1_524_000, cy: 3_810_000 },
        grouped: false,
        design: {
          ...elbow,
          "box.rot": [270],
          "box.flipH": [true],
          "connection.start": ["258.2 site 2"],
          "connection.end": ["258.3 site 2"],
        },
        kept: ["geometry"],
      },
    ]
    const moved = set(indexed(file), "258.3", { box: { y: 60 } })
    expect(read(moved, 4)?.box).toEqual({ x: 300, y: 105, w: 120, h: 120 })
    expect(read(moved, 4)?.design).toContain("box.flipV")
    expect(read(moved, 5)?.box).toEqual({ x: 300, y: 60, w: 120, h: 300 })
    expect(read(moved, 5)?.design).toContain("box.rot 90 · box.flipH · box.flipV")
    const behind = set(indexed(file), "258.3", { box: { x: 0, y: 360 } })
    expect(read(behind, 4)?.design).toContain("geometry bentConnector5")
    expect(read(behind, 5)?.design).toContain("geometry bentConnector3")
  })
})

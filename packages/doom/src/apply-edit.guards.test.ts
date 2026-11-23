import { describe, expect, it } from "vitest"
import { limits } from "./limits.js"
import { orderKeyBetween } from "./order-key.js"
import { applyEdit, emptyDoom, isRefusal, nodeId, rev, type Doom, type Write } from "./index.js"
import {
  agent,
  create,
  hex,
  ids,
  land,
  once,
  person,
  revOf,
  sampleDeck,
  textOf,
  theme,
  tryLand,
} from "./sample-deck.js"

const refusedWith = (result: unknown, refused: string, node?: string, prop?: string) => {
  expect(isRefusal(result)).toBe(true)
  expect(result).toMatchObject({
    refused,
    ...(node === undefined ? {} : { node }),
    ...(prop === undefined ? {} : { prop }),
  })
}

describe("compare and set", () => {
  const typed = () =>
    land(sampleDeck(), [
      {
        node: ids.title,
        prop: "text",
        value: textOf("Revenue 2"),
        base: revOf(sampleDeck(), ids.title, "text")!,
      },
    ])

  it("refuses a text write whose base is older than the prop's rev", () => {
    const doom = sampleDeck()
    const base = revOf(doom, ids.title, "text")
    const first = land(doom, [{ node: ids.title, prop: "text", value: textOf("A"), base: base! }])
    refusedWith(
      tryLand(first, [{ node: ids.title, prop: "text", value: textOf("B"), base: base! }]),
      "stale",
      ids.title,
      "text",
    )
    const second = land(first, [
      {
        node: ids.title,
        prop: "text",
        value: textOf("B"),
        base: revOf(first, ids.title, "text")!,
      },
    ])
    expect(second.nodes.get(ids.title)).toMatchObject({ text: { chars: "B" } })
  })

  it("refuses a text, notes or list write that names no base once the prop has a rev", () => {
    const doom = sampleDeck()
    refusedWith(tryLand(doom, [{ node: ids.title, prop: "text", value: textOf("B") }]), "stale", ids.title, "text")
    const filled = land(doom, [{ node: ids.card, prop: "fills", value: [] }])
    refusedWith(tryLand(filled, [{ node: ids.card, prop: "fills", value: [] }]), "stale", ids.card, "fills")
    const noted = land(doom, [{ node: ids.slide, prop: "notes", value: textOf("n") }])
    refusedWith(tryLand(noted, [{ node: ids.slide, prop: "notes", value: textOf("m") }]), "stale", ids.slide, "notes")
  })

  it("lets a first write of a guarded prop name no base", () => {
    expect(isRefusal(tryLand(sampleDeck(), [{ node: ids.card, prop: "strokes", value: [] }]))).toBe(false)
  })

  it("checks a base on any prop that names one, and ignores it when it is current or newer", () => {
    const doom = land(sampleDeck(), [{ node: ids.card, prop: "opacity", value: 0.5 }])
    const current = revOf(doom, ids.card, "opacity")!
    refusedWith(
      tryLand(doom, [{ node: ids.card, prop: "opacity", value: 1, base: rev(current - 1) }]),
      "stale",
      ids.card,
      "opacity",
    )
    expect(isRefusal(tryLand(doom, [{ node: ids.card, prop: "opacity", value: 1, base: current }]))).toBe(false)
    expect(isRefusal(tryLand(doom, [{ node: ids.card, prop: "opacity", value: 1, base: rev(current + 3) }]))).toBe(
      false,
    )
  })

  it("judges each write against the revs the edit started from, so two writes of one prop in one edit land", () => {
    const doom = sampleDeck()
    const base = revOf(doom, ids.title, "text")!
    const result = land(doom, [
      { node: ids.title, prop: "text", value: textOf("A"), base },
      { node: ids.title, prop: "text", value: textOf("B"), base },
    ])
    expect(result.nodes.get(ids.title)).toMatchObject({ text: { chars: "B" } })
  })

  it("lands none of an edit when one write is stale", () => {
    const doom = typed()
    const stale = tryLand(doom, [
      { node: ids.card, prop: "name", value: "Card" },
      {
        node: ids.title,
        prop: "text",
        value: textOf("C"),
        base: revOf(sampleDeck(), ids.title, "text")!,
      },
    ])
    refusedWith(stale, "stale")
    expect(doom.nodes.get(ids.card)).not.toHaveProperty("name")
  })
})

describe("agent runs", () => {
  const start = (doom: Doom, run: string, extra: readonly Write[] = []) =>
    applyEdit(doom, {
      once: once(),
      author: agent(run),
      writes: extra,
      phase: "start",
      rev: rev(doom.rev + 1),
    })
  const stop = (doom: Doom, run: string) =>
    applyEdit(doom, {
      once: once(),
      author: agent(run),
      writes: [],
      phase: "stop",
      rev: rev(doom.rev + 1),
    })

  it("fences an agent write that names no run, an unstarted run or a stopped run", () => {
    const doom = sampleDeck()
    const write = [{ node: ids.card, prop: "name" as const, value: "Aira" }]
    refusedWith(tryLand(doom, write, { kind: "agent", id: "aira" }), "run-fenced")
    refusedWith(tryLand(doom, write, agent("r1")), "run-fenced")
    const running = start(doom, "r1") as Doom
    expect(isRefusal(tryLand(running, write, agent("r1")))).toBe(false)
    const stopped = stop(running, "r1") as Doom
    refusedWith(tryLand(stopped, write, agent("r1")), "run-fenced")
  })

  it("never reuses a run id and never stops a run that is not running", () => {
    const running = start(sampleDeck(), "r1") as Doom
    refusedWith(start(running, "r1"), "run-fenced")
    const stopped = stop(running, "r1") as Doom
    refusedWith(start(stopped, "r1"), "run-fenced")
    refusedWith(stop(stopped, "r1"), "run-fenced")
    refusedWith(stop(sampleDeck(), "r1"), "run-fenced")
  })

  it("lets a person start nothing: a phase needs an agent with a run", () => {
    const doom = sampleDeck()
    refusedWith(
      applyEdit(doom, {
        once: once(),
        author: person,
        writes: [],
        phase: "start",
        rev: rev(doom.rev + 1),
      }),
      "shape",
    )
  })

  it("protects a node a person wrote during the run, for that run only", () => {
    const running = start(sampleDeck(), "r1") as Doom
    const touched = land(running, [{ node: ids.card, prop: "name", value: "Mine" }])
    refusedWith(tryLand(touched, [{ node: ids.card, prop: "opacity", value: 0.5 }], agent("r1")), "person", ids.card)
    expect(isRefusal(tryLand(touched, [{ node: ids.side, prop: "opacity", value: 0.5 }], agent("r1")))).toBe(false)
    const second = start(touched, "r2") as Doom
    expect(isRefusal(tryLand(second, [{ node: ids.card, prop: "opacity", value: 0.5 }], agent("r2")))).toBe(false)
  })

  it("does not protect a node a person wrote before the run started", () => {
    const touched = land(sampleDeck(), [{ node: ids.card, prop: "name", value: "Mine" }])
    const running = start(touched, "r1") as Doom
    expect(isRefusal(tryLand(running, [{ node: ids.card, prop: "opacity", value: 0.5 }], agent("r1")))).toBe(false)
  })

  const claude = (run: string) => ({
    kind: "agent" as const,
    id: "claude",
    run,
  })
  const startBy = (doom: Doom, author: ReturnType<typeof claude>) =>
    applyEdit(doom, {
      once: once(),
      author,
      writes: [],
      phase: "start",
      rev: rev(doom.rev + 1),
    })

  it("keeps a run to the agent that started it: another agent can neither write into it nor stop it", () => {
    const running = start(sampleDeck(), "r1") as Doom
    expect(running.runs.get("r1")).toMatchObject({
      agent: "aira",
      started: running.rev,
    })
    const write = [{ node: ids.card, prop: "name" as const, value: "Claude" }]
    refusedWith(tryLand(running, write, claude("r1")), "run-fenced")
    refusedWith(
      applyEdit(running, {
        once: once(),
        author: claude("r1"),
        writes: [],
        phase: "stop",
        rev: rev(running.rev + 1),
      }),
      "run-fenced",
    )
    expect(isRefusal(tryLand(running, write, agent("r1")))).toBe(false)
  })

  it("stops an agent's running run when the same agent starts another, in the same edit", () => {
    const first = start(sampleDeck(), "r1") as Doom
    const second = start(first, "r2") as Doom
    expect(second.runs.get("r1")?.phase).toBe("stopped")
    expect(second.runs.get("r2")?.phase).toBe("running")
    refusedWith(tryLand(second, [{ node: ids.card, prop: "name", value: "late" }], agent("r1")), "run-fenced")
  })

  it("leaves another agent's run running when an agent starts its own", () => {
    const mine = start(sampleDeck(), "r1") as Doom
    const both = startBy(mine, claude("c1")) as Doom
    expect(both.runs.get("r1")?.phase).toBe("running")
    expect(both.runs.get("c1")).toMatchObject({
      phase: "running",
      agent: "claude",
    })
  })

  it("records the rev a run last wrote at", () => {
    const running = start(sampleDeck(), "r1") as Doom
    const wrote = land(running, [{ node: ids.card, prop: "name", value: "A" }], agent("r1"))
    expect(wrote.runs.get("r1")).toMatchObject({
      started: running.rev,
      wrote: wrote.rev,
    })
    const stopped = stop(wrote, "r1") as Doom
    expect(stopped.runs.get("r1")).toMatchObject({ wrote: wrote.rev })
  })

  it("lets a start edit carry its first writes and a stop edit its last", () => {
    const doom = start(sampleDeck(), "r1", [{ node: ids.card, prop: "name", value: "First" }]) as Doom
    expect(doom.nodes.get(ids.card)).toMatchObject({ name: "First" })
    const done = applyEdit(doom, {
      once: once(),
      author: agent("r1"),
      writes: [{ node: ids.card, prop: "name", value: "Last" }],
      phase: "stop",
      rev: rev(doom.rev + 1),
    }) as Doom
    expect(done.nodes.get(ids.card)).toMatchObject({ name: "Last" })
    expect(done.runs.get("r1")?.phase).toBe("stopped")
  })
})

describe("theme keys", () => {
  it("writes one colour without touching another, and bumps the theme's own rev too", () => {
    const doom = land(sampleDeck(), [{ node: ids.deck, prop: "theme.colors.accent1", value: hex(0xff0000) }])
    expect(doom.nodes.get(ids.deck)).toMatchObject({
      theme: {
        colors: { accent1: hex(0xff0000), accent2: theme().colors.accent2 },
      },
    })
    expect(revOf(doom, ids.deck, "theme.colors.accent1")).toBe(doom.rev)
    expect(revOf(doom, ids.deck, "theme")).toBe(doom.rev)
    expect(revOf(doom, ids.deck, "theme.colors.accent2")).toBeLessThan(doom.rev)
  })

  it("lets a whole theme write bump every key", () => {
    const doom = land(sampleDeck(), [
      {
        node: ids.deck,
        prop: "theme",
        value: theme(),
        base: revOf(sampleDeck(), ids.deck, "theme")!,
      },
    ])
    for (const key of ["theme.colors.accent1", "theme.fonts.body", "theme.textStyles.title", "theme.effectStyles.soft"])
      expect(revOf(doom, ids.deck, key)).toBe(doom.rev)
  })

  it("keeps two edits of different variables from colliding", () => {
    const start = sampleDeck()
    const one = land(start, [{ node: ids.deck, prop: "theme.colors.accent1", value: hex(0x111111) }])
    const two = land(one, [{ node: ids.deck, prop: "theme.colors.accent2", value: hex(0x222222) }])
    expect(two.nodes.get(ids.deck)).toMatchObject({
      theme: { colors: { accent1: hex(0x111111), accent2: hex(0x222222) } },
    })
  })

  it("refuses a key on a deck with no theme, a key of another type of node and a bad value", () => {
    const bare = land(emptyDoom, create(ids.deck, "deck", null))
    refusedWith(tryLand(bare, [{ node: ids.deck, prop: "theme.colors.accent1", value: hex(0xff0000) }]), "missing")
    refusedWith(
      tryLand(sampleDeck(), [{ node: ids.card, prop: "theme.colors.accent1", value: hex(0xff0000) }]),
      "shape",
    )
    refusedWith(tryLand(sampleDeck(), [{ node: ids.deck, prop: "theme.colors.accent1", value: "red" }]), "shape")
  })
})

describe("deck limits", () => {
  const shapes = (count: number): Write[] => {
    const writes: Write[] = []
    let key = null as ReturnType<typeof orderKeyBetween> | null
    for (let index = 0; index < count; index += 1) {
      key = orderKeyBetween(key, null)
      const node = nodeId(`m:${index}`)
      writes.push({ node, prop: "type", value: "shape" }, { node, prop: "parent", value: { id: ids.slide, at: key } })
    }
    return writes
  }

  it("refuses more elements than the limit, and lands the limit exactly", () => {
    const doom = sampleDeck()
    const room =
      limits.elements - [...doom.nodes.values()].filter((node) => (node as { parent?: unknown }).parent != null).length
    expect(isRefusal(tryLand(doom, shapes(room)))).toBe(false)
    refusedWith(tryLand(doom, shapes(room + 1)), "limit")
  })

  it("refuses one slide more than the limit and lands an edit at the limit", () => {
    const slides = (count: number): Write[] =>
      Array.from({ length: count }, (_, index) => create(nodeId(`s:${index}`), "slide", ids.row)).flat()
    const full = land(sampleDeck(), slides(limits.slides - 1))
    refusedWith(tryLand(full, create(nodeId("s:900"), "slide", ids.row)), "limit")
    expect(isRefusal(tryLand(full, [{ node: ids.card, prop: "name", value: "ok" }]))).toBe(false)
    const gone = land(full, [{ node: nodeId("s:0"), prop: "parent", value: null }])
    expect(isRefusal(tryLand(gone, create(nodeId("s:900"), "slide", ids.row)))).toBe(false)
  })

  it("does not count slides in a hidden row", () => {
    const hiddenRow = land(sampleDeck(), [
      ...create(nodeId("h:0"), "slideRow", ids.deck),
      { node: nodeId("h:0"), prop: "hidden", value: true },
    ])
    const layouts = Array.from({ length: limits.slides + 5 }, (_, index) =>
      create(nodeId(`l:${index}`), "slide", nodeId("h:0")),
    ).flat()
    expect(isRefusal(tryLand(hiddenRow, layouts))).toBe(false)
  })

  it("refuses an edit that leaves the deck with no slide", () => {
    const second = land(sampleDeck(), create(nodeId("s:1"), "slide", ids.row))
    const gone = (slide: string) => [{ node: nodeId(slide), prop: "parent" as const, value: null }]
    const one = land(second, gone("s:1"))
    refusedWith(tryLand(one, gone(ids.slide)), "last-slide")
    expect(
      isRefusal(tryLand(second, [...gone("s:1"), ...gone(ids.slide), ...create(nodeId("s:2"), "slide", ids.row)])),
    ).toBe(false)
    refusedWith(tryLand(second, [...gone("s:1"), ...gone(ids.slide)]), "last-slide")
  })

  it("refuses a value over the value limit and a name over the name limit", () => {
    refusedWith(
      tryLand(sampleDeck(), [{ node: ids.card, prop: "name", value: "a".repeat(limits.name + 1) }]),
      "limit",
      ids.card,
      "name",
    )
    refusedWith(
      tryLand(sampleDeck(), [
        {
          node: ids.title,
          prop: "text",
          value: textOf("a".repeat(limits.valueBytes + 1)),
          base: rev(99),
        },
      ]),
      "limit",
      ids.title,
      "text",
    )
  })
})

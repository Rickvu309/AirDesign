import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { agentArrivals, agentSlide, agentSlides } from "./agent-arrivals"

const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [
    {
      children: [
        { type: "shape", name: "Title" },
        { type: "frame", name: "Card" },
      ],
    },
  ],
})
const slide = grown.slides[0]!
const [title, card] = grown.doom.children.get(slide)!
const agent = (phase?: "start"): doom.Author => ({
  kind: "agent",
  id: "claude",
  run: "c1",
  ...(phase === undefined ? {} : { name: "Claude Code" }),
})
const person: doom.Author = { kind: "person", id: "quan" }

let once = 0
function landed(fold: doom.Doom, edit: Omit<doom.Edit, "once" | "rev">): doom.Doom {
  once += 1
  const next = doom.applyEdit(fold, { ...edit, once: `e${String(once)}`, rev: doom.rev(fold.rev + 1) })
  if (doom.isRefusal(next)) throw new Error(next.refused)
  return next
}

const made = (id: string, parent: doom.NodeId): readonly doom.Write[] => [
  { node: doom.nodeId(id), prop: "type", value: "shape" },
  { node: doom.nodeId(id), prop: "parent", value: { id: parent, at: doom.orderKeyBetween(null, null) } },
]
const named = (node: doom.NodeId, value: string): doom.Write => ({ node, prop: "name", value })
const started = landed(grown.doom, { author: agent("start"), phase: "start", writes: [named(title!, "Started")] })

describe("what an agent just put on the deck", () => {
  it("names the layers an agent made and the layers it changed in its latest edit", () => {
    const next = landed(started, { author: agent(), writes: [...made("t:1", slide), named(title!, "Agenda")] })
    expect(agentArrivals(started, next, grown.doom.rev)).toEqual({ made: new Set(["t:1"]), changed: new Set([title]) })
    expect(agentArrivals(started, next, next.rev)).toEqual({ made: new Set(), changed: new Set() })
  })

  it("names nothing for a person's edit while the agent's run is open", () => {
    const next = landed(started, { author: person, writes: [...made("t:2", slide), named(title!, "Mine")] })
    expect(agentArrivals(started, next, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set() })
  })

  it("names nothing when a person undoes the agent's run", () => {
    const wrote = landed(started, { author: agent(), writes: [named(title!, "Agenda")] })
    const undone = landed(wrote, {
      author: person,
      runUndo: { run: "c1", undone: true },
      writes: [named(title!, "Started")],
    })
    expect(agentArrivals(wrote, undone, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set() })
  })

  it("names nothing when the view did not move", () => {
    expect(agentArrivals(started, started, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set() })
  })

  it("names only the agent's edit when a person's edit lands in the same view after it", () => {
    const wrote = landed(started, { author: agent(), writes: [named(card!, "Agenda")] })
    const after = landed(wrote, { author: person, writes: [named(title!, "Mine")] })
    expect(agentArrivals(started, after, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set([card]) })
  })

  it("names nothing again when the same agent edit moves to a new rev as the server orders it", () => {
    const shownFirst = landed(started, { author: agent(), writes: [named(card!, "Agenda")] })
    const confirmed = doom.applyEdit(landed(started, { author: person, writes: [named(title!, "Mine")] }), {
      once: [...shownFirst.onces].find(([, at]) => at === shownFirst.rev)![0],
      author: agent(),
      writes: [named(card!, "Agenda")],
      rev: doom.rev(shownFirst.rev + 1),
    })
    if (doom.isRefusal(confirmed)) throw new Error(confirmed.refused)
    expect(agentArrivals(shownFirst, confirmed, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set() })
  })

  it("names a made frame once, not every layer the agent made inside it", () => {
    const frame = doom.nodeId("t:3")
    const next = landed(started, {
      author: agent(),
      writes: [
        { node: frame, prop: "type", value: "frame" },
        { node: frame, prop: "parent", value: { id: slide, at: doom.orderKeyBetween(null, null) } },
        ...made("t:4", frame),
        named(card!, "Agenda"),
        ...made("t:5", card!),
      ],
    })
    expect(agentArrivals(started, next, grown.doom.rev)).toEqual({
      made: new Set([frame, "t:5"]),
      changed: new Set([card]),
    })
  })

  it("names the layers of the edit that stops the run", () => {
    const stopped = landed(started, { author: agent(), phase: "stop", writes: [named(card!, "Done")] })
    expect(agentArrivals(started, stopped, grown.doom.rev)).toEqual({ made: new Set(), changed: new Set([card]) })
  })

  const home = doom.parentOf(grown.doom.nodes.get(slide))!
  const slideMade = (id: string, after: doom.OrderKey | null = home.at): readonly doom.Write[] => [
    { node: doom.nodeId(id), prop: "type", value: "slide" },
    { node: doom.nodeId(id), prop: "parent", value: { id: home.id, at: doom.orderKeyBetween(after, null) } },
  ]

  it("names the slide an agent just made, and no slide for a person's or one already caught up", () => {
    const next = landed(started, { author: agent(), writes: [...slideMade("s:9"), ...made("t:9", doom.nodeId("s:9"))] })
    expect(agentSlide(started, next, grown.doom.rev)).toBe("s:9")
    expect(agentSlide(started, next, next.rev)).toBeUndefined()
    const mine = landed(started, { author: person, writes: slideMade("s:8") })
    expect(agentSlide(started, mine, grown.doom.rev)).toBeUndefined()
    const filled = landed(next, { author: agent(), writes: made("t:6", doom.nodeId("s:9")) })
    expect(agentSlide(started, filled, grown.doom.rev)).toBe("s:9")
    const theirs = landed(landed(started, { author: person, writes: slideMade("s:5") }), {
      author: agent(),
      writes: made("t:5", slide),
    })
    expect(agentSlide(started, theirs, grown.doom.rev)).toBeUndefined()
    const text = landed(started, { author: agent(), writes: made("t:7", slide) })
    expect(agentSlide(started, text, grown.doom.rev)).toBeUndefined()
  })

  it("names every fresh agent-made slide, and none for a person, undo, caught-up, or re-ordered edit", () => {
    const firstKey = doom.orderKeyBetween(home.at, null)
    const pair = landed(started, { author: agent(), writes: [...slideMade("s:9"), ...slideMade("s:10", firstKey)] })
    expect(agentSlides(started, pair, grown.doom.rev)).toEqual(new Set(["s:9", "s:10"]))
    expect(agentSlides(started, pair, pair.rev)).toEqual(new Set())
    expect(agentSlides(started, started, grown.doom.rev)).toEqual(new Set())

    const other: doom.Author = { kind: "agent", id: "aira", run: "a1", name: "Aira" }
    const first = landed(started, { author: agent(), writes: slideMade("s:9") })
    const second = landed(first, { author: other, phase: "start", writes: slideMade("s:10", firstKey) })
    expect(agentSlides(started, second, grown.doom.rev)).toEqual(new Set(["s:9", "s:10"]))
    expect(agentSlide(started, second, grown.doom.rev)).toBe("s:10")

    const mine = landed(started, { author: person, writes: slideMade("s:8") })
    expect(agentSlides(started, mine, grown.doom.rev)).toEqual(new Set())

    const theirs = landed(landed(started, { author: person, writes: slideMade("s:5") }), {
      author: agent(),
      writes: made("t:5", slide),
    })
    expect(agentSlides(started, theirs, grown.doom.rev)).toEqual(new Set())

    const undone = landed(first, {
      author: person,
      runUndo: { run: "c1", undone: true },
      writes: [{ node: doom.nodeId("s:9"), prop: "parent", value: null }],
    })
    expect(agentSlides(first, undone, grown.doom.rev)).toEqual(new Set())

    const confirmed = doom.applyEdit(landed(started, { author: person, writes: [named(title!, "Mine")] }), {
      once: [...first.onces].find(([, at]) => at === first.rev)![0],
      author: agent(),
      writes: slideMade("s:9"),
      rev: doom.rev(first.rev + 1),
    })
    if (doom.isRefusal(confirmed)) throw new Error(confirmed.refused)
    expect(agentSlides(first, confirmed, grown.doom.rev)).toEqual(new Set())
  })
})

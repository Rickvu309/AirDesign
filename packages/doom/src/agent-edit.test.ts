import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentEdit } from "./agent-edit.js"
import { agentDeck, minter, runName, started } from "./testing/agent-fixtures.js"
import { richDeck } from "./testing/rich-deck.js"
import { type Doom, type NodeId, type Rev, type RevisionKey, applyEdit, isRefusal, nodeId, rev } from "./index.js"
import { agent, create, ids, land, person, revOf, sampleDeck, textOf } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

const change = (value: Record<string, unknown>) => value as AgentChange

function readingOf(doom: Doom, base: number): Doom {
  const at = rev(base)
  const revs = new Map<NodeId, ReadonlyMap<RevisionKey, Rev>>()
  for (const [node, props] of doom.revs)
    revs.set(node, new Map([...props].map(([key, was]) => [key, was > at ? at : was])))
  return { ...doom, rev: at, revs }
}
const by = (more: Record<string, unknown> = {}) => ({
  author: agent(runName),
  once: "agent-1",
  mint: minter(),
  placement,
  starts,
  ...more,
})
const landEdit = (doom: Doom, edit: { once: string; author: ReturnType<typeof agent>; writes: readonly never[] }) =>
  applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })

describe("compileAgentEdit", () => {
  it("makes one edit of the agent's run from several changes, and the doom takes it", () => {
    const doom = agentDeck()
    const result = compileAgentEdit(
      doom,
      [
        change({ op: "add", kind: "text", slide: ids.slide, text: "Board update", textStyle: "title" }),
        change({ op: "set", target: `${ids.slide}.title`, text: "Board update **Q3**" }),
        change({ op: "add", kind: "shape", slide: ids.slide, box: { x: 0, y: 0, w: 10, h: 10 } }),
      ],
      by(),
    )
    if ("refused" in result) throw new Error(JSON.stringify(result))
    expect(result.edit).toMatchObject({ once: "agent-1", author: { kind: "agent", id: "aira", run: runName } })
    expect(result.added).toEqual([
      { id: "a:1", change: 0, kind: "text" },
      { id: "a:2", change: 2, kind: "shape" },
    ])
    const landed = landEdit(doom, result.edit as never)
    expect(isRefusal(landed)).toBe(false)
    expect(propOf((landed as Doom).nodes.get(result.added[0]!.id)!, "text")?.chars).toBe("Board update Q3")
  })

  it("names the delete that left no slide when it is not the first change", () => {
    const result = compileAgentEdit(
      agentDeck(),
      [change({ op: "set", target: ids.title, text: "A" }), change({ op: "slide", delete: ids.slide })],
      by(),
    )
    expect(result).toMatchObject({ refused: "last-slide", change: "slide delete", at: 1 })
  })

  it("labels a slide added with its change and the kind slide", () => {
    const result = compileAgentEdit(
      agentDeck(),
      [change({ op: "set", target: ids.title, text: "A" }), change({ op: "slide", add: {} })],
      by(),
    )
    if ("refused" in result) throw new Error(JSON.stringify(result))
    expect(result.added).toEqual([{ id: "a:1", change: 1, kind: "slide" }])
  })

  it("lets a later change use what an earlier one made: the title it set is the one it added", () => {
    const result = compileAgentEdit(
      agentDeck(),
      [
        change({ op: "add", kind: "text", slide: ids.slide, text: "A", textStyle: "title" }),
        change({ op: "set", target: `${ids.slide}.title`, text: "B" }),
      ],
      by(),
    )
    expect("refused" in result).toBe(false)
  })

  it("lands none of it when one change is refused, and names the change and its place in the batch", () => {
    const result = compileAgentEdit(
      agentDeck(),
      [
        change({ op: "add", kind: "text", slide: ids.slide, text: "A" }),
        change({ op: "set", target: "z:9", text: "B" }),
        change({ op: "add", kind: "text", slide: ids.slide, text: "C" }),
      ],
      by(),
    )
    expect(result).toEqual({ refused: "missing", node: "z:9", field: "target", change: "set z:9", at: 1 })
  })

  it("refuses a move into a layer under a frame an earlier change of the same edit deleted", () => {
    const [inner, innermost] = [nodeId("t:90"), nodeId("t:91")]
    const nested = started(
      land(sampleDeck(), [...create(inner, "frame", ids.card), ...create(innermost, "frame", inner)]),
    )
    const result = compileAgentEdit(
      nested,
      [change({ op: "delete", nodes: [inner] }), change({ op: "move", node: ids.card, into: innermost })],
      by(),
    )
    expect(result).toEqual({ refused: "missing", node: ids.card, prop: "parent", change: `move ${ids.card}`, at: 1 })
  })

  it("is refused run-fenced for a run that has not started, naming the first change", () => {
    const result = compileAgentEdit(
      sampleDeck(),
      [change({ op: "add", kind: "text", slide: ids.slide, text: "A" })],
      by(),
    )
    expect(result).toMatchObject({ refused: "run-fenced", change: "add text", at: 0 })
  })

  it("is refused person for a node a person changed during the run", () => {
    const open = richDeck()
    const during = land(
      open,
      [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(open, ids.title, "text")! }],
      person,
    )
    const result = compileAgentEdit(during, [change({ op: "set", target: ids.title, text: "A" })], by())
    expect(result).toMatchObject({ refused: "person", node: ids.title, change: `set ${ids.title}`, at: 0 })
  })

  it("is refused stale for text the agent read before a person changed it, and lands after a fresh read", () => {
    const read = sampleDeck()
    const typed = started(
      land(
        read,
        [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(read, ids.title, "text")! }],
        person,
      ),
    )
    const ask = [
      change({ op: "set", target: ids.title, text: "Agent" }),
      change({ op: "set", target: ids.card, name: "Card" }),
    ]
    expect(compileAgentEdit(typed, ask, by({ read }))).toMatchObject({
      refused: "stale",
      node: ids.title,
      prop: "text",
      change: `set ${ids.title}`,
      at: 0,
    })
    expect("refused" in compileAgentEdit(typed, ask, by({ read: typed }))).toBe(false)
  })

  it("does not refuse its own two writes to one text, though both rest on what the agent read", () => {
    const result = compileAgentEdit(
      richDeck(),
      [change({ op: "set", target: ids.title, text: "One" }), change({ op: "set", target: ids.title, text: "Two" })],
      by(),
    )
    if ("refused" in result) throw new Error(JSON.stringify(result))
    expect(result.edit.writes.map((write) => write.base)).toEqual([expect.any(Number), expect.any(Number)])
  })

  it("leaves out each value the node already holds, so a run never lands or undoes a write that changes nothing", () => {
    const ask = [
      change({ op: "set", target: ids.card, name: "Card", opacity: 0.5 }),
      change({ op: "set", target: ids.title, text: "Revenue" }),
    ]
    const first = compileAgentEdit(agentDeck(), ask, by())
    if ("refused" in first) throw new Error(JSON.stringify(first))
    const after = landEdit(agentDeck(), first.edit as never) as Doom
    const again = compileAgentEdit(after, [...ask, change({ op: "set", target: ids.card, name: "Kept" })], by())
    if ("refused" in again) throw new Error(JSON.stringify(again))
    expect(again.edit.writes).toEqual([{ node: ids.card, prop: "name", value: "Kept" }])
  })

  it("compiles to no writes when the deck already holds every value the agent sets", () => {
    const ask = [change({ op: "set", target: ids.card, name: "Card", opacity: 0.5 })]
    const first = compileAgentEdit(agentDeck(), ask, by())
    if ("refused" in first) throw new Error(JSON.stringify(first))
    const after = landEdit(agentDeck(), first.edit as never) as Doom
    const again = compileAgentEdit(after, ask, by())
    if ("refused" in again) throw new Error(JSON.stringify(again))
    expect(again.edit.writes).toEqual([])
  })

  it("is refused person for a value a person set during the run, even when the agent sets that same value", () => {
    const open = richDeck()
    const during = land(
      open,
      [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(open, ids.title, "text")! }],
      person,
    )
    const result = compileAgentEdit(
      during,
      [change({ op: "set", target: ids.title, text: "Typed" }), change({ op: "set", target: ids.card, name: "Kept" })],
      by(),
    )
    expect(result).toMatchObject({ refused: "person", node: ids.title, prop: "text", at: 0 })
  })

  it("names the change whose write was refused, not an earlier change that set the value already there", () => {
    const read = sampleDeck()
    const typed = started(
      land(
        read,
        [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(read, ids.title, "text")! }],
        person,
      ),
    )
    const ask = [
      change({ op: "set", target: ids.title, text: "Typed" }),
      change({ op: "set", target: ids.title, text: "Agent" }),
    ]
    expect(compileAgentEdit(typed, ask, by({ read }))).toMatchObject({
      refused: "stale",
      node: ids.title,
      prop: "text",
      at: 1,
    })
  })

  it("refuses an empty batch", () => {
    expect(compileAgentEdit(agentDeck(), [], by())).toEqual({
      refused: "shape",
      change: "changes",
      field: "changes",
      fault: "missing",
      expect: { code: "batch" },
    })
  })
})

describe("compileAgentEdit starting a run", () => {
  it("starts the run in the edit that carries the first changes, and the doom takes it", () => {
    const doom = sampleDeck()
    const result = compileAgentEdit(
      doom,
      [
        change({ op: "add", kind: "text", slide: ids.slide, text: "A" }),
        change({ op: "set", target: ids.title, text: "B" }),
      ],
      by({ phase: "start" }),
    )
    if ("refused" in result) throw new Error(JSON.stringify(result))
    expect(result.edit.phase).toBe("start")
    const landed = landEdit(doom, result.edit as never)
    if (isRefusal(landed)) throw new Error(JSON.stringify(landed))
    expect((landed as Doom).runs.get(runName)?.phase).toBe("running")
  })

  it("refuses a start for a run the doom already holds", () => {
    expect(
      compileAgentEdit(
        agentDeck(),
        [change({ op: "add", kind: "text", slide: ids.slide, text: "A" })],
        by({ phase: "start" }),
      ),
    ).toMatchObject({ refused: "run-fenced", at: 0 })
  })
})

describe("readingOf", () => {
  it("keeps the revisions the agent saw and lowers newer ones to the one it read at", () => {
    const read = sampleDeck()
    const typed = land(
      read,
      [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(read, ids.title, "text")! }],
      person,
    )
    const seen = readingOf(typed, read.rev)
    expect(revOf(seen, ids.title, "text")).toBe(read.rev)
    expect(revOf(seen, ids.card, "box")).toBe(revOf(read, ids.card, "box"))
    expect(seen.nodes).toBe(typed.nodes)
  })

  it("lets the first change in a run refuse text a person changed after the read", () => {
    const read = sampleDeck()
    const typed = land(
      read,
      [{ node: ids.title, prop: "text", value: textOf("Typed"), base: revOf(read, ids.title, "text")! }],
      person,
    )
    const result = compileAgentEdit(
      typed,
      [change({ op: "set", target: ids.title, text: "A" })],
      by({ phase: "start", read: readingOf(typed, read.rev) }),
    )
    expect(result).toMatchObject({ refused: "stale", node: ids.title, prop: "text" })
  })
})

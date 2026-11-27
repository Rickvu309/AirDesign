import fc from "fast-check"
import { expect, it } from "vitest"
import { orderKeyBetween } from "./order-key.js"
import { minter, runName, started, titledSlide } from "./testing/agent-fixtures.js"
import { agentBatches, resolveRefs } from "./testing/intents.js"
import { richDeck } from "./testing/rich-deck.js"
import {
  applyEdit,
  deckOf,
  measureWith,
  measureWithLayout,
  readFold,
  readLanded,
  resolveSlide,
  slideBackground,
  isRefusal,
  nodeId,
  rev,
  viewOf,
  type Edit,
  type Landed,
  type NodeId,
  type PropName,
  type Doom,
  type Text,
  type Write,
} from "./index.js"
import { invert } from "./invert.js"
import { type Intent, readIntent } from "./intent-read.js"
import { compileIntents } from "./intent-edit.js"
import { foldToJson } from "./fold-json.js"
import { agent, box, create, ids, once, person, revOf, sampleDeck, textOf, tryLand } from "./sample-deck.js"
import { valuesOf } from "./testing/values-of.js"
import { placement } from "./testing/placement-rules.js"
import { starts as startRules } from "./testing/start-rules.js"

type Pick = {
  readonly node: NodeId
  readonly prop: PropName
  readonly value: unknown
}

const frames = fc.constantFrom(ids.card, ids.side)
const shapes = fc.constantFrom(ids.title, ids.caption)
const words = fc.string({ minLength: 1, maxLength: 12 }).filter((name) => name.trim() !== "")

const picks: fc.Arbitrary<Pick> = fc.oneof(
  fc.record({ node: frames, prop: fc.constant("name" as const), value: words }),
  fc.record({
    node: frames,
    prop: fc.constant("hidden" as const),
    value: fc.boolean(),
  }),
  fc.record({
    node: frames,
    prop: fc.constant("clip" as const),
    value: fc.boolean(),
  }),
  fc.record({
    node: frames,
    prop: fc.constant("radius" as const),
    value: fc.integer({ min: 0, max: 40 }),
  }),
  fc.record({
    node: frames,
    prop: fc.constant("opacity" as const),
    value: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
  fc.record({
    node: frames,
    prop: fc.constant("fills" as const),
    value: fc.array(
      fc.constantFrom("accent1", "accent2", "text").map((name) => ({ kind: "solid", color: { var: name } })),
      { maxLength: 3 },
    ),
  }),
  fc.record({
    node: shapes,
    prop: fc.constant("box" as const),
    value: fc.integer({ min: 0, max: 1500 }).map((x) => box(x)),
  }),
  fc.record({
    node: shapes,
    prop: fc.constant("text" as const),
    value: words.map(textOf),
  }),
  fc.record({
    node: shapes,
    prop: fc.constant("opacity" as const),
    value: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
)

const keyOf = (pick: { readonly node: NodeId; readonly prop: string }) => `${pick.node}/${pick.prop}`
const distinct = (max: number) => fc.uniqueArray(picks, { selector: keyOf, minLength: 1, maxLength: max })

function write(doom: Doom, pick: Pick): Write {
  const base = revOf(doom, pick.node, pick.prop)
  return {
    ...pick,
    ...(base === undefined || !guarded.has(pick.prop) ? {} : { base }),
  }
}

const guarded = new Set<PropName>(["text", "fills"])

const valueOf = (doom: Doom, pick: { readonly node: NodeId; readonly prop: PropName }) =>
  (doom.nodes.get(pick.node) as Record<string, unknown> | undefined)?.[pick.prop]

function fold(start: Doom, edits: readonly (readonly Write[])[]): Doom {
  let doom = start
  for (const writes of edits) {
    const next = applyEdit(doom, {
      once: once(),
      author: person,
      writes,
      rev: rev(doom.rev + 1),
    })
    if (isRefusal(next)) throw new Error(`refused ${JSON.stringify(next)}`)
    doom = next
  }
  return doom
}

it("folds edits of different props to the same values in any order", () => {
  fc.assert(
    fc.property(distinct(12), fc.array(fc.nat(1000), { minLength: 12, maxLength: 12 }), (items, noise) => {
      const start = sampleDeck()
      const edits = items.map((pick) => [write(start, pick)])
      const shuffled = edits
        .map((each, index) => ({ each, order: noise[index] ?? 0 }))
        .sort((left, right) => left.order - right.order)
        .map(({ each }) => each)
      expect(valuesOf(fold(start, shuffled))).toEqual(valuesOf(fold(start, edits)))
    }),
  )
})

it("lets the last writer in server order win on one prop", () => {
  fc.assert(
    fc.property(fc.array(words, { minLength: 1, maxLength: 10 }), (names) => {
      let doom = sampleDeck()
      for (const name of names) doom = fold(doom, [[{ node: ids.card, prop: "name", value: name }]])
      expect(valueOf(doom, { node: ids.card, prop: "name" })).toBe(names.at(-1))
    }),
  )
})

it("applies an edit twice to the same doom as once", () => {
  fc.assert(
    fc.property(distinct(4), (items) => {
      const start = sampleDeck()
      const edit: Landed = {
        once: once(),
        author: person,
        writes: items.map((pick) => write(start, pick)),
        rev: rev(start.rev + 1),
      }
      const once1 = applyEdit(start, edit)
      expect(isRefusal(once1)).toBe(false)
      const twice = applyEdit(once1 as Doom, {
        ...edit,
        rev: rev(start.rev + 2),
      })
      expect(twice).toBe(once1)
      expect(valuesOf(twice as Doom)).toEqual(valuesOf(once1 as Doom))
    }),
  )
})

it("never makes a cycle of parents, and refuses exactly the reparents that would, and a move into a deleted frame unless it takes back a delete", () => {
  const nodes = Array.from({ length: 6 }, (_, index) => nodeId(`c:${index}`))
  const start = fold(sampleDeck(), [nodes.flatMap((node) => create(node, "frame", ids.slide))])
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          node: fc.integer({ min: 0, max: 5 }),
          target: fc.integer({ min: -2, max: 5 }),
          restore: fc.boolean(),
          first: fc.boolean(),
        }),
        {
          maxLength: 30,
        },
      ),
      (steps) => {
        let doom = start
        const parents: (number | "slide" | null)[] = nodes.map(() => "slide")
        for (const { node, target, restore, first } of steps) {
          const underNode = (from: number) => {
            for (let at: number | "slide" | null = from; typeof at === "number"; at = parents[at] ?? null)
              if (at === node) return true
            return false
          }
          const parent = target === -2 ? null : target === -1 ? ids.slide : nodes[target]!
          const liveTarget = target === -1 || (target >= 0 && parents[target] !== null)
          const stays = parents[node] === null && !restore && target !== -2 && liveTarget
          const expected = stays
            ? "ok"
            : target >= 0 &&
                ((parents[target] === null && !(restore && parents[node] === null)) ||
                  (first && parents[node] !== null && underNode(target)))
              ? "missing"
              : target >= 0 && underNode(target)
                ? "cycle"
                : "ok"
          const result = tryLand(doom, [
            ...(first ? [{ node: nodes[node]!, prop: "parent" as const, value: null }] : []),
            {
              node: nodes[node]!,
              prop: "parent",
              value: parent === null ? null : { id: parent, at: orderKeyBetween(null, null) },
              ...(restore ? { base: doom.revs.get(nodes[node]!)!.get("parent")! } : {}),
            },
          ])
          if (expected === "ok") {
            expect(isRefusal(result)).toBe(false)
            doom = result as Doom
            if (!stays) parents[node] = target === -2 ? null : target === -1 ? "slide" : target
          } else {
            expect(result).toMatchObject({ refused: expected })
          }
          for (const [index, id] of nodes.entries()) {
            const own = parents[index]!
            const stored = (doom.nodes.get(id) as { parent: { id: NodeId } | null }).parent
            expect(stored === null ? null : stored.id).toBe(
              own === null ? null : own === "slide" ? ids.slide : nodes[own]!,
            )
            let hops = 0
            for (
              let at: NodeId | null = id;
              at !== null && doom.nodes.get(at) && "parent" in doom.nodes.get(at)!;
              hops += 1
            ) {
              expect(hops).toBeLessThan(nodes.length + 10)
              at = (doom.nodes.get(at) as { parent: { id: NodeId } | null }).parent?.id ?? null
            }
          }
          const listed = [...doom.children.values()].flat()
          expect(new Set(listed).size).toBe(listed.length)
          for (const [parentId, kids] of doom.children)
            for (const kid of kids) expect((doom.nodes.get(kid) as { parent: { id: NodeId } }).parent.id).toBe(parentId)
        }
      },
    ),
  )
})

it("refuses a text write based on an older rev, or on none, and nothing else", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          base: fc.constantFrom("current", "older", "none", "newer"),
          chars: words,
        }),
        {
          maxLength: 15,
        },
      ),
      (steps) => {
        let doom = sampleDeck()
        for (const { base, chars } of steps) {
          const current = revOf(doom, ids.title, "text")!
          const given =
            base === "current" ? current : base === "older" ? current - 1 : base === "newer" ? current + 2 : undefined
          const result = tryLand(doom, [
            {
              node: ids.title,
              prop: "text",
              value: textOf(chars),
              ...(given === undefined ? {} : { base: rev(given) }),
            },
          ])
          if (base === "older" || base === "none") {
            expect(result).toMatchObject({
              refused: "stale",
              node: ids.title,
              prop: "text",
            })
          } else {
            expect(isRefusal(result)).toBe(false)
            doom = result as Doom
            expect(valueOf(doom, { node: ids.title, prop: "text" })).toMatchObject({ chars })
          }
        }
      },
    ),
  )
})

it("undoes an edit on exactly the props nobody wrote since", () => {
  fc.assert(
    fc.property(fc.array(distinct(3), { minLength: 1, maxLength: 8 }), fc.nat(100), (batches, chosen) => {
      const folds: Doom[] = [sampleDeck()]
      const edits: Landed[] = []
      for (const items of batches) {
        const before = folds.at(-1)!
        const edit: Landed = {
          once: once(),
          author: person,
          writes: items.map((pick) => write(before, pick)),
          rev: rev(before.rev + 1),
        }
        const after = applyEdit(before, edit)
        expect(isRefusal(after)).toBe(false)
        folds.push(after as Doom)
        edits.push(edit)
      }
      const index = chosen % edits.length
      const edit = edits[index]!
      const current = folds.at(-1)!
      const undone = tryLand(current, invert(folds[index]!, current, edit))
      expect(isRefusal(undone)).toBe(false)
      const wrote = (each: Landed, pick: { node: NodeId; prop: PropName }) =>
        each.writes.some((one) => keyOf(one) === keyOf(pick))
      for (const pick of batches.flat()) {
        const since = edits.slice(index + 1).some((each) => wrote(each, pick))
        const expected = wrote(edit, pick) && !since ? valueOf(folds[index]!, pick) : valueOf(current, pick)
        expect(valueOf(undone as Doom, pick)).toEqual(expected)
      }
    }),
  )
})

it("shows the server's doom with the pending edits folded on top, as the fold itself would", () => {
  fc.assert(
    fc.property(
      fc.array(distinct(2), { maxLength: 4 }),
      fc.array(
        fc.record({
          items: distinct(2),
          base: fc.constantFrom("current", "older", "none"),
          again: fc.boolean(),
        }),
        { maxLength: 6 },
      ),
      (landedBatches, pendingBatches) => {
        let server = sampleDeck()
        const landedEdits: Edit[] = []
        for (const items of landedBatches) {
          const edit: Edit = {
            once: once(),
            author: person,
            writes: items.map((pick) => write(server, pick)),
          }
          server = applyEdit(server, {
            ...edit,
            rev: rev(server.rev + 1),
          }) as Doom
          landedEdits.push(edit)
        }
        const pending: Edit[] = pendingBatches.map(({ items, base, again }, index) =>
          again && landedEdits[index] !== undefined
            ? landedEdits[index]!
            : {
                once: once(),
                author: person,
                writes: items.map((pick) => {
                  const known = revOf(server, pick.node, pick.prop)
                  return {
                    ...pick,
                    ...(known === undefined || base === "none"
                      ? {}
                      : { base: rev(base === "older" ? known - 1 : known) }),
                  }
                }),
              },
        )
        const view = viewOf(server, pending)
        let folded = server
        for (const edit of pending) {
          const writes = edit.writes.map((each) => {
            const was = revOf(folded, each.node, each.prop)
            const { base: _sent, ...rest } = each
            return was === undefined ? rest : { ...rest, base: was }
          })
          const next = applyEdit(folded, {
            ...edit,
            writes,
            rev: rev(folded.rev + 1),
          })
          if (!isRefusal(next)) folded = next
        }
        expect(view).toEqual(folded)
        expect(server.rev).toBe(rev(server.rev))
      },
    ),
  )
})

const estimate = measureWith({})
const face = { family: "Inter", weight: 400, style: "normal", variations: "" } as const
const wordPerLine = measureWithLayout(({ text }) => {
  const ends = [...text.matchAll(/\S+\s*/gu)].map((word) => (word.index ?? 0) + word[0].length)
  const lines = (ends.length === 0 ? [text.length] : ends).map((end, at, all) => {
    const start = at === 0 ? 0 : all[at - 1]!
    return { start, end, advance: (end - start) * 10, faces: [{ start, end, face }] }
  })
  return { direction: "ltr", lines }
})
const starts = [started(sampleDeck()), richDeck(), titledSlide().doom]

function opens(doom: Doom) {
  const stored = readFold(JSON.parse(JSON.stringify(foldToJson(doom))))
  expect(stored).toBeDefined()
  expect(foldToJson(stored!)).toEqual(foldToJson(doom))
  const { theme } = deckOf(doom)
  for (const node of doom.nodes.values()) {
    if (node.type === "slide") {
      for (const measure of [estimate, wordPerLine]) resolveSlide(doom, node.id, measure)
      slideBackground(doom, node.id)
    }
    const own = node as { readonly text?: Text; readonly notes?: Text; readonly box?: { readonly w: number } }
    for (const text of [own.text, own.notes]) {
      if (text === undefined) continue
      for (const measure of [estimate, wordPerLine]) {
        measure(text, theme, null)
        if (own.box !== undefined) measure(text, theme, own.box.w, "two-lines")
      }
    }
  }
}

function landsAgentEdits(start: Doom, batches: readonly (readonly unknown[])[]): number {
  let doom = start
  let accepted = 0
  const mint = minter("p")
  for (const [index, batch] of batches.entries()) {
    const read = (JSON.parse(JSON.stringify(resolveRefs(doom, batch))) as readonly unknown[]).map(readIntent)
    const changes = read.filter((each): each is Intent => !("refused" in each))
    if (changes.length === 0 || changes.length < read.length) continue
    const result = compileIntents(doom, changes, {
      placement,
      starts: startRules,
      author: agent(runName),
      once: `p-${index}`,
      mint,
      read: doom,
    })
    if ("refused" in result) continue
    accepted += 1
    if (result.edit.writes.length === 0 && result.edit.phase === undefined) {
      expect(result.after).toBe(doom)
      continue
    }
    const replayed = readLanded(JSON.parse(JSON.stringify({ ...result.edit, rev: doom.rev + 1 })), doom)
    if (isRefusal(replayed)) throw new Error(`the tab refuses what the server took: ${JSON.stringify(replayed)}`)
    const next = applyEdit(doom, replayed)
    if (isRefusal(next)) throw new Error(`the tab refuses what the server took: ${JSON.stringify(next)}`)
    expect(foldToJson(next)).toEqual(foldToJson(result.after))
    opens(next)
    doom = next
  }
  return accepted
}

const found: readonly (readonly [string, number, readonly (readonly unknown[])[]])[] = [
  ["a line break in agent text", 0, [[{ op: "insert", kind: "text", parent: ids.slide, text: "Line one\nLine two" }]]],
  [
    "a table with words in its cells",
    0,
    [
      [
        {
          op: "insert",
          kind: "frame",
          parent: ids.slide,
          rows: [
            ["Metric", "Q3"],
            ["Revenue\nnet", "**$4.2M**"],
          ],
        },
      ],
    ],
  ],
  [
    "text on a slide the run added",
    2,
    [[{ op: "insert", kind: "slide" }], [{ op: "insert", kind: "text", parent: "p:1", text: "- one\n- two" }]],
  ],
  [
    "paragraph JSON sent as words",
    0,
    [[{ op: "update", target: ids.title, text: JSON.stringify({ paras: [{ from: -1, runs: [{ text: "x" }] }] }) }]],
  ],
  [
    "a box moved to a y of -0",
    0,
    [
      [{ op: "update", target: ids.caption, box: { x: 0, y: 0, w: 0, h: 0 } }],
      [{ op: "move", targets: [ids.caption], parent: ids.slide, box: { x: 1, y: -5e-324, w: 0, h: 0 } }],
    ],
  ],
]

it.each(found)("opens the deck after %s", (_name, start, batches) => {
  expect(landsAgentEdits(starts[start]!, batches)).toBe(batches.length)
})

it("leaves every deck it takes an agent edit for able to open, measure and paint", () => {
  let accepted = 0
  fc.assert(
    fc.property(fc.nat(starts.length - 1), agentBatches, (start, batches) => {
      accepted += landsAgentEdits(starts[start]!, batches)
    }),
  )
  expect(accepted).toBeGreaterThan(0)
})

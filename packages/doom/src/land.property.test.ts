import fc from "fast-check"
import { expect, it } from "vitest"
import { type Intent, readIntent } from "./intent-read.js"
import { compileIntent } from "./intent-compile.js"
import { applyEdit, applyStep } from "./apply-edit.js"
import { changingWrites } from "./changing-writes.js"
import { nameFromTitleWrites } from "./deck-name-from-title.js"
import type { Author, Doom, Edit, Write } from "./doom.js"
import { doomFromTree } from "./doom-tree.js"
import { foldToJson } from "./fold-json.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { type NodeId, rev } from "./ids.js"
import { type Landing, land } from "./land.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import { type Refusal, isRefusal } from "./refusal.js"
import { ids, sampleDeck } from "./sample-deck.js"
import { agentBatches, resolveRefs } from "./testing/intents.js"
import { minter, runName, titledSlide } from "./testing/agent-fixtures.js"
import { measure, plainTheme, spot, words } from "./testing/doom-fixtures-art.js"
import { attached } from "./testing/line-end-fixtures.js"
import { placement } from "./testing/placement-rules.js"
import { richDeck } from "./testing/rich-deck.js"
import { starts } from "./testing/start-rules.js"
import { onTop } from "./view-of.js"

const person: Author = { kind: "person", id: "p" }
const agent: Author = { kind: "agent", id: "aira", run: runName }

type Composed = { readonly after: Doom; readonly writes: readonly Write[] } | "unchanged" | Refusal

function personBefore(fold: Doom, asked: readonly Write[], once: string): Composed {
  const given = changingWrites(fold, asked)
  if (given.length === 0) return "unchanged"
  const derived = nameFromTitleWrites(fold, given, starts)
  const writes = freeLineEnds(fold, [...given, ...derived], measure)
  const edit: Edit = { once, author: person, writes }
  const after = applyEdit(fold, { ...onTop(fold, edit), rev: rev(fold.rev + 1) })
  return isRefusal(after) ? after : { after, writes }
}

function agentBefore(fold: Doom, asked: readonly Write[], view: Doom, once: string, phase?: "start"): Composed {
  const named = nameFromTitleWrites(fold, asked, starts, view)
  const writes = changingWrites(fold, [...asked, ...named])
  if (writes.length === 0 && phase === undefined) return "unchanged"
  const after = applyEdit(fold, { once, author: agent, writes, ...(phase ? { phase } : {}), rev: rev(fold.rev + 1) })
  return isRefusal(after) ? after : { after, writes }
}

function shown(landing: Landing | Refusal): Composed {
  if (isRefusal(landing)) return landing
  return { after: landing.after, writes: landing.edit.writes }
}

const sameAs = (composed: Composed, landing: Landing | Refusal) => {
  const now = shown(landing)
  if (now === "unchanged") throw new Error("land answers a landing or a refusal")
  if (composed === "unchanged") {
    expect(isRefusal(now) ? now : now.writes).toEqual([])
    return
  }
  if (isRefusal(composed) || isRefusal(now)) {
    expect(now).toEqual(composed)
    return
  }
  expect(now.writes).toEqual(composed.writes)
  expect(foldToJson(now.after)).toEqual(foldToJson(composed.after))
}

function lineDeck(name: string) {
  return doomFromTree({
    theme: plainTheme,
    name,
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "title",
            props: { role: "title", box: spot(80, 60, 900, 120), text: words(starts.title.chars) },
          },
          { type: "shape", name: "t", props: { box: spot(300, 300, 100, 50) } },
          {
            type: "frame",
            name: "j",
            props: { box: spot(100, 100, 400, 200) },
            children: [{ type: "shape", name: "l", props: attached }],
          },
        ],
      },
      {
        name: "two",
        children: [
          { type: "shape", name: "second", props: { role: "title", box: spot(80, 60, 900, 120), text: words("Plan") } },
        ],
      },
    ],
  })
}

const titles = fc.constantFrom(starts.title.chars, "Q3 board update", "Plan", "Revenue\nby region", "")

function personWrites(grown: ReturnType<typeof lineDeck>): fc.Arbitrary<readonly Write[]> {
  const { ids, slides } = grown
  const deck = [...grown.doom.nodes.values()].find((node) => node.type === "deck")!.id
  const row = [...grown.doom.children.get(deck)!][0]!
  const node = (name: string) => ids[name]!
  const first = (grown.doom.nodes.get(slides[0]!) as { parent: { at: OrderKey } }).parent.at
  const write = (id: NodeId, prop: string, value: unknown): Write => ({ node: id, prop: prop as never, value })
  const one: fc.Arbitrary<Write> = fc.oneof(
    titles.map((chars) => write(node("title"), "text", words(chars))),
    titles.map((chars) => write(node("second"), "text", words(chars))),
    fc.constantFrom(starts.deckName, "Board pack", "Plan").map((name) => write(deck, "name", name)),
    fc.integer({ min: 0, max: 1500 }).map((x) => write(node("t"), "box", spot(x, 300, 100, 50))),
    fc.integer({ min: 0, max: 900 }).map((x) => write(node("j"), "box", spot(x, 100, 400, 200))),
    fc.constantFrom("t", "j", "title", "l").map((name) => write(node(name), "parent", null)),
    fc.constant(write(node("t"), "parent", { id: slides[1]!, at: orderKeyBetween(null, null) })),
    fc.constant(write(slides[0]!, "parent", null)),
    fc.constant(write(slides[1]!, "parent", { id: row, at: orderKeyBetween(null, first) })),
  )
  return fc.array(one, { minLength: 1, maxLength: 4 })
}

const holds = (fold: Doom, write: Write) =>
  JSON.stringify((fold.nodes.get(write.node) as Record<string, unknown> | undefined)?.[write.prop]) ===
  JSON.stringify(write.value)

const sentByEditor = (fold: Doom, write: Write) =>
  !((write.prop === "name" || write.prop === "text") && holds(fold, write))

it("lands a person's writes as the editor composed them: what changes, the name that follows the title, freed line ends", () => {
  const decks = [lineDeck(starts.deckName), lineDeck("Board pack")]
  const seen = { named: 0, freed: 0, refused: 0 }
  fc.assert(
    fc.property(
      fc
        .nat(decks.length - 1)
        .chain((at) =>
          fc.tuple(fc.constant(decks[at]!), fc.array(personWrites(decks[at]!), { minLength: 1, maxLength: 3 })),
        ),
      ([grown, batches]) => {
        let fold = grown.doom
        for (const [index, batch] of batches.entries()) {
          const asked = batch.filter((write) => sentByEditor(fold, write))
          const once = `p-${index}`
          const before = personBefore(fold, asked, once)
          const landing = land(fold, asked, { author: person, once, measure, starts })
          sameAs(before, landing)
          if (isRefusal(landing)) seen.refused += 1
          else {
            if (landing.named.length > 0) seen.named += 1
            if (landing.edit.writes.some((write) => write.prop === "geometry")) seen.freed += 1
            fold = landing.after
          }
        }
      },
    ),
  )
  expect(seen.named).toBeGreaterThan(0)
  expect(seen.freed).toBeGreaterThan(0)
  expect(seen.refused).toBeGreaterThan(0)
})

function agentWrites(
  fold: Doom,
  changes: readonly Intent[],
  mint: () => NodeId,
  once: string,
  phase: "start" | undefined,
) {
  const all: Write[] = []
  let view = fold
  for (const [at, change] of changes.entries()) {
    const compiled = compileIntent(view, change, mint, placement, starts, { read: fold })
    if ("refused" in compiled) return undefined
    const edit: Edit = {
      once: `${once}#${at}`,
      author: agent,
      writes: compiled,
      ...(phase !== undefined && at === 0 ? { phase } : {}),
    }
    const next = applyStep(view, { ...onTop(view, edit), rev: rev(view.rev + 1) })
    if (isRefusal(next)) return undefined
    view = next
    all.push(...compiled)
  }
  return { all, view }
}

it("lands an agent's compiled writes as its session composed them", () => {
  const titled = titledSlide()
  const linked = lineDeck(starts.deckName)
  const decks = [sampleDeck(), richDeck(), titled.doom, linked.doom]
  const rawBatches: fc.Arbitrary<readonly (readonly unknown[])[]> = agentBatches
  const seen = { compared: 0, named: 0, freed: 0, refused: 0 }
  fc.assert(
    fc.property(fc.nat(decks.length - 1), rawBatches, (start, batches) => {
      let fold = decks[start]!
      const mint = minter("p")
      for (const [index, batch] of batches.entries()) {
        const read = (JSON.parse(JSON.stringify(resolveRefs(fold, batch))) as readonly unknown[]).map(readIntent)
        const changes = read.filter((each): each is Intent => !("refused" in each))
        if (changes.length === 0 || changes.length < read.length) continue
        const once = `p-${index}`
        const phase = fold.runs.has(runName) ? undefined : ("start" as const)
        const compiled = agentWrites(fold, changes, mint, once, phase)
        if (compiled === undefined) continue
        const before = agentBefore(fold, compiled.all, compiled.view, once, phase)
        const landing = land(fold, compiled.all, { author: agent, once, measure, starts, ...(phase ? { phase } : {}) })
        sameAs(before, landing)
        seen.compared += 1
        if (isRefusal(landing)) seen.refused += 1
        else {
          if (landing.named.length > 0) seen.named += 1
          if (landing.edit.writes.some((write) => write.prop === "geometry")) seen.freed += 1
          fold = landing.after
        }
      }
    }),
    {
      numRuns: 300,
      examples: [
        [2, [[{ op: "update", target: `${titled.on}.title`, text: "Board update" }]]],
        [3, [[{ op: "remove", targets: [linked.ids.t] }]]],
        [0, [[{ op: "remove", targets: [ids.slide] }]]],
      ],
    },
  )
  expect(seen.compared).toBeGreaterThan(0)
  expect(seen.named).toBeGreaterThan(0)
  expect(seen.freed).toBeGreaterThan(0)
  expect(seen.refused).toBeGreaterThan(0)
})

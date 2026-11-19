import { randomBytes } from "node:crypto"
import { createServer } from "node:http"

import { notifyKey, readDeckId, readDeckIndex } from "@airdesign/catalog"
import { decide, elementId, measureOwed, type Command, type Register } from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"

import { DeckListen } from "./listen.js"
import { indexSaved } from "./index-saved.js"
import { finish, mcpSteps, revisionOf, wholeCall, type McpSteps, type Owned, type Stores } from "./mcp-steps.js"
import { postgresInfo } from "./harness.js"
import { openPool } from "./pool.js"
import { openSaved, readSaved, writeRevision } from "./saved.js"

const top = elementId("256.2")
const next = elementId("256.3")
const tall = 900_000
const gap = 203_200

let stores: Stores
let steps: McpSteps
let listen: DeckListen

beforeAll(async () => {
  const info = await postgresInfo()
  stores = { deck: openPool(info.deck, "mcp-measure-deck"), session: openPool(info.session, "mcp-measure-session") }
  listen = new DeckListen(info.listen)
  await listen.open()
  steps = await mcpSteps(createServer)
})

afterAll(async () => {
  await steps.close()
  await listen.close()
  await Promise.all([stores.deck.end(), stores.session.end()])
})

async function cards(
  following: boolean,
  waiting: () => void = () => undefined,
): Promise<Owned & { readonly revision: number }> {
  const parsed = readDeckId(`measure-${randomBytes(6).toString("hex")}`)
  if (!parsed.ok) throw new Error(parsed.refusal)
  const email = `measure-${randomBytes(6).toString("hex")}@example.com`
  await stores.session.query("insert into session.account (email) values ($1)", [email])
  const made = await openSaved(stores.deck, parsed, email)
  if (!made.ok) throw new Error(made.refusal)
  const card = (node: string, y: number) => ({
    node,
    kind: "shape",
    value: "A card line",
    box: { x: 1_000_000, y, cx: 3_000_000, cy: 400_000 },
    grouped: false,
  })
  const page = readDeckIndex({
    deck: parsed.deck,
    once: "index",
    offset: 0,
    total: 2,
    slides: [{ id: "256", position: 0, layout: [], free: 20, animated: [] }],
    elements: [card(top, 1_000_000), card(next, 1_600_000)],
  })
  if (!page.ok) throw new Error(page.refusal)
  const indexed = await indexSaved(stores.deck, page, email)
  if (!indexed.ok) throw new Error(indexed.refusal)
  const watched = {
    ready: () => listen.ready(),
    wait: (signal: AbortSignal) => {
      const woken = listen.wait(signal)
      waiting()
      return woken
    },
  }
  const measures = { listen: watched, following: () => following, limit: 3_000 }
  return { stores, deck: parsed.deck, email, revision: indexed.revision, measures }
}

async function stored(owned: Owned) {
  const saved = await readSaved(stores.deck, owned.deck)
  if (saved === undefined || saved.register === null) throw new Error("deck")
  return saved
}

async function framedAndTyped(owned: Owned & { readonly revision: number }) {
  const framed = await wholeCall(steps, owned, "run", "edit_deck", {
    deck: owned.deck,
    base: owned.revision,
    changes: [{ op: "frame", elements: [top, next] }],
  })
  const typed = await wholeCall(steps, owned, "run", "edit_deck", {
    deck: owned.deck,
    base: revisionOf(framed),
    changes: [
      { op: "set", target: top, text: { value: "A card line\nthat an agent made two lines longer\nand longer" } },
    ],
  })
  revisionOf(typed)
  expect(measureOwed((await stored(owned)).register)).toEqual([top])
}

function applied(register: Register, commands: readonly Command[]): Register {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    current = decision.register
  }
  return current
}

async function deviceMeasures(owned: Owned): Promise<void> {
  const saved = await stored(owned)
  const register = applied(saved.register, [
    { command: "person", node: top, v: 13, patch: { box: { h: { set: tall } } } },
  ])
  const key = notifyKey(owned.deck, saved.revision + 1)
  if (!key.ok) throw new Error("key")
  const wrote = await writeRevision(stores.deck, {
    id: owned.deck,
    revision: saved.revision + 1,
    register,
    storedIndex: saved.storedIndex,
    expected: saved.revision,
    key: key.key,
  })
  expect(wrote).toBe(true)
}

type ReadBox = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

function boxes(body: Record<string, unknown> | undefined): ReadonlyMap<string, ReadBox> {
  const elements = (body?.elements ?? []) as readonly { readonly node: string; readonly box: ReadBox }[]
  return new Map(elements.map((each) => [each.node, each.box]))
}

it("answers an agent's read after its own text edit with the frame laid out at the height the open tab measured", async () => {
  let waiting = () => undefined as void
  const waited = new Promise<void>((resolve) => {
    waiting = resolve
  })
  const owned = await cards(true, () => waiting())
  await framedAndTyped(owned)
  const reading = finish(await steps.start(owned, "run", "read_deck", { deck: owned.deck }))
  await waited
  await deviceMeasures(owned)
  const read = boxes((await reading).body)
  expect(read.get(top)?.cy).toBe(tall)
  expect(read.get(next)?.y).toBe(1_000_000 + tall + gap)
})

it("answers at once with the heights last measured when no tab follows the deck", async () => {
  const owned = await cards(false)
  await framedAndTyped(owned)
  const read = boxes((await wholeCall(steps, owned, "run", "read_deck", { deck: owned.deck })).body)
  expect(read.get(top)?.cy).toBe(400_000)
  expect(read.get(next)?.y).toBe(1_000_000 + 400_000 + gap)
})

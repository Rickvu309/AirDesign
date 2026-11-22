import { readFileSync } from "node:fs"
import path from "node:path"
import { deckRoutes } from "@airdesign/catalog"
import {
  beforeOf,
  elementId,
  format,
  landedPatch,
  readRegister,
  undoOf,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { account, deckOf, startAgents, stores, address, type Account } from "./agents-drive.js"
import { ask } from "./harness.js"

type Row = { readonly v?: number; readonly patch?: Readonly<Record<string, unknown>> }
type Body = { readonly landed: readonly Row[] }
type Saved = {
  readonly register: { readonly elements: Readonly<Record<string, Body>>; readonly order: readonly unknown[] }
  readonly index: unknown
  readonly device: { readonly entries: readonly { readonly value: Readonly<Record<string, unknown>> | null }[] }
}

const saved = JSON.parse(
  readFileSync(path.join(process.cwd(), "packages/document/src/format-58-deck.json"), "utf8"),
) as Saved

const borderFormat = 64

let stop = async () => {}
beforeAll(async () => {
  stop = await startAgents()
})
afterAll(async () => stop())

async function stored(deck: string): Promise<{ readonly register: Saved["register"]; readonly import_index: unknown }> {
  const found = await stores.deck.query<{ register: Saved["register"]; import_index: unknown }>(
    "select register, import_index from deck.saved where id = $1",
    [deck],
  )
  const row = found.rows[0]
  if (row === undefined) throw new Error("missing deck")
  return row
}

async function plant(owner: Account): Promise<string> {
  const deck = await deckOf(owner)
  await stores.deck.query("update deck.saved set register = $2::jsonb, import_index = $3::jsonb where id = $1", [
    deck,
    JSON.stringify({ ...saved.register, route: deck }),
    JSON.stringify(saved.index),
  ])
  return deck
}

async function opened(
  owner: Account,
  deck: string,
): Promise<{ readonly format?: number; readonly register: Register }> {
  const answer = (await ask(address.base, "POST", deckRoutes.open.path, { deck }, owner.cookie)).json as {
    readonly ok: boolean
    readonly register: { readonly format?: number }
  }
  expect(answer.ok).toBe(true)
  const read = readRegister(answer.register)
  if (!read.ok) throw new Error(read.refusal)
  const answered = answer.register.format
  return { ...(answered === undefined ? {} : { format: answered }), register: read.value }
}

function traits(register: { readonly elements: Readonly<Record<string, Body | undefined>> }): readonly string[] {
  return Object.values(register.elements).flatMap((body) =>
    (body?.landed ?? []).flatMap((row) => Object.keys(row.patch ?? {})),
  )
}

function shown(register: Register, node: string) {
  const body = register.elements[node as ElementId]
  return body === undefined ? {} : landedPatch(body, "text")
}

async function commit(owner: Account, deck: string, batch: readonly unknown[]) {
  return (await ask(address.base, "POST", deckRoutes.commit.path, { deck, batch }, owner.cookie)).json
}

it("opens a deck a format 58 build saved with every border under border, and keeps its stored rows and index", async () => {
  const owner = await account()
  const deck = await plant(owner)
  expect(traits(saved.register)).toContain("line")
  const { format: answered, register } = await opened(owner, deck)
  expect(answered).toBe(format)
  expect(traits(register)).not.toContain("line")
  for (const [node, body] of Object.entries(saved.register.elements)) {
    const rows = register.elements[node as ElementId]?.landed ?? []
    expect(rows.map((row) => (row.v === undefined ? row : { v: row.v, patch: row.patch }))).toEqual(
      body.landed.map((row) =>
        row.patch === undefined || !Object.hasOwn(row.patch, "line")
          ? { v: row.v, patch: row.patch }
          : {
              v: borderFormat,
              patch: Object.fromEntries(
                Object.entries(row.patch).map(([trait, fields]) => [trait === "line" ? "border" : trait, fields]),
              ),
            },
      ),
    )
  }
  expect(JSON.stringify(register.order)).not.toContain('"line":')
  expect(JSON.stringify(register.index)).not.toContain('"line.')
  expect(JSON.stringify(register.index)).toContain('"border.width"')
  const kept = await stored(deck)
  expect(kept.register.elements).toEqual(saved.register.elements)
  expect(kept.import_index).toEqual(saved.index)
})

it("takes a person's border on that deck, undoes it to the old border, and lands the edit that build left unsent", async () => {
  const owner = await account()
  const deck = await plant(owner)
  const plan = elementId("256.2")
  const before = await opened(owner, deck)
  const old = shown(before.register, plan)
  expect(old.border).toMatchObject({ width: { set: 50_800 }, dash: { set: "dash" } })
  const patch = { border: { width: { set: 76_200 } } }
  expect(await commit(owner, deck, [{ node: plan, v: format, patch, floor: "" }])).toMatchObject({ ok: true })
  const edited = await opened(owner, deck)
  expect(shown(edited.register, plan).border?.width).toEqual({ set: 76_200 })

  const body = before.register.elements[plan]
  if (body === undefined) throw new Error("no Plan")
  const undo = undoOf(edited.register, {
    steps: [{ node: plan, before: beforeOf(landedPatch(body, "text"), patch), after: patch }],
  })
  if (!undo.ok) throw new Error("undo")
  const rows = undo.commands.map((command) => {
    if (command.command !== "person" || command.v === undefined) throw new Error("a border undo is a row")
    return { node: command.node, v: command.v, patch: command.patch, floor: "" }
  })
  expect(await commit(owner, deck, rows)).toMatchObject({ ok: true })
  expect(shown((await opened(owner, deck)).register, plan)).toEqual(old)

  const unsent = saved.device.entries.find((entry) => entry.value?.kind === "pending")?.value
  if (unsent === undefined || unsent === null) throw new Error("no unsent row")
  expect(Object.keys(unsent.patch ?? {})).toEqual(["line"])
  const sent = await commit(owner, deck, [{ node: unsent.node, v: unsent.v, patch: unsent.patch, floor: "" }])
  expect(sent).toMatchObject({ ok: true })
  const after = await stored(deck)
  expect(traits(after.register)).not.toContain("line")
  expect(after.register.elements["256.2"]?.landed.at(-1)).toMatchObject({
    v: borderFormat,
    patch: { border: { fill: { set: { solid: { scheme: "tx1" } } }, dash: { set: "dot" } } },
  })
  expect(after.import_index).toEqual(saved.index)
  expect(shown((await opened(owner, deck)).register, plan).border?.dash).toEqual({ set: "dot" })
})

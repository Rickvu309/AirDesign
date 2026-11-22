import { readFileSync } from "node:fs"
import path from "node:path"
import { deckRoutes } from "@airdesign/catalog"
import {
  currentValue,
  elementId,
  format,
  openingElement,
  readRegister,
  readTextValue,
  undoOf,
  writeTextValue,
  type Command,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { account, address, deckOf, startAgents, stores, type Account } from "./agents-drive.js"
import { ask } from "./harness.js"

type Saved = {
  readonly format: number
  readonly register: { readonly elements: Record<string, { readonly landed: readonly unknown[] }> }
  readonly index: unknown
  readonly shown: Record<string, readonly (number | null)[] | string | null>
  readonly plain: { readonly elements: Record<string, { readonly landed: readonly { readonly value?: string }[] }> }
}

const saved = JSON.parse(
  readFileSync(path.join(process.cwd(), "scripts/pptx-fixtures/saved-before-line-height.json"), "utf8"),
) as Saved

let stop = async () => {}
beforeAll(async () => {
  stop = await startAgents()
})
afterAll(async () => stop())

async function stored(deck: string): Promise<{ readonly register: unknown; readonly import_index: unknown }> {
  const found = await stores.deck.query<{ register: unknown; import_index: unknown }>(
    "select register, import_index from deck.saved where id = $1",
    [deck],
  )
  const row = found.rows[0]
  if (row === undefined) throw new Error("missing deck")
  return row
}

async function plant(owner: Account, register: unknown, index: unknown): Promise<string> {
  const deck = await deckOf(owner)
  await stores.deck.query("update deck.saved set register = $2::jsonb, import_index = $3::jsonb where id = $1", [
    deck,
    JSON.stringify({ ...(register as object), route: deck }),
    index === null ? null : JSON.stringify(index),
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

function shownText(register: Register, node: ElementId): string | null {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  return body === undefined ? (openingElement(register, node)?.value ?? null) : currentValue(body)
}

function lineHeights(register: Register, node: ElementId): readonly (number | null)[] | string | null {
  const value = shownText(register, node)
  if (value === null) return null
  return readTextValue(value)?.map((paragraph) => paragraph.lineHeight ?? null) ?? value
}

async function commit(owner: Account, deck: string, batch: readonly unknown[]) {
  return (await ask(address.base, "POST", deckRoutes.commit.path, { deck, batch }, owner.cookie)).json
}

it("opens a deck the build before line height stored, shows each line height it showed, and keeps every stored text and its index as they were", async () => {
  const owner = await account()
  const deck = await plant(owner, saved.register, saved.index)
  const { register } = await opened(owner, deck)
  const nodes = Object.entries(saved.shown).filter(([node]) => node.includes("."))
  expect(nodes.length).toBe(9)
  for (const [node, shown] of nodes) expect(lineHeights(register, elementId(node))).toEqual(shown)
  for (const [node, body] of Object.entries(saved.register.elements))
    expect(register.elements[node as ElementId]?.landed).toEqual(body.landed)
  expect((await stored(deck)).import_index).toEqual(saved.index)
})

it("edits, undoes and applies a stored text style on that deck", async () => {
  const owner = await account()
  const deck = await plant(owner, saved.register, saved.index)
  const title = elementId("256.2")
  const before = await opened(owner, deck)
  const old = shownText(before.register, title) ?? ""
  const retyped = writeTextValue(
    (readTextValue(old) ?? []).map((paragraph) => ({
      ...paragraph,
      runs: paragraph.runs.map((run) => ({ ...run, text: "Yearly plan" })),
    })),
  )
  const patch = { text: { value: { set: retyped } } }
  expect(await commit(owner, deck, [{ node: title, v: format, patch, floor: "" }])).toMatchObject({ ok: true })
  const edited = await opened(owner, deck)
  expect(edited.format).toBe(format)
  expect(readTextValue(shownText(edited.register, title) ?? "")?.[0]).toMatchObject({ lineHeight: 150_000 })

  const undo = undoOf(edited.register, {
    steps: [{ node: title, before: { text: { value: { set: old } } }, after: patch }],
  })
  if (!undo.ok) throw new Error("undo")
  const rows = undo.commands.map((command: Command) => {
    if (command.command !== "person" || command.v !== undefined || command.property !== undefined)
      throw new Error("a text undo is a stored text")
    return { node: command.node, value: command.value, floor: "" }
  })
  expect(await commit(owner, deck, rows)).toMatchObject({ ok: true })
  expect(shownText((await opened(owner, deck)).register, title)).toBe(old)

  expect((await stored(deck)).import_index).toEqual(saved.index)
})

it("keeps a stored plain string that only looks like JSON as the same plain text", async () => {
  const owner = await account()
  const deck = await plant(owner, saved.plain, saved.index)
  const plain = saved.plain.elements["256.2"]?.landed.at(-1)?.value
  expect(plain).toBe('[{"from":0,"lineSpacing":120000}]')
  const { register } = await opened(owner, deck)
  expect(shownText(register, elementId("256.2"))).toBe(plain)
  expect(readTextValue(plain ?? "")).toBeNull()
})

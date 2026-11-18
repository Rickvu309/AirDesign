import { readFileSync } from "node:fs"
import path from "node:path"
import { deckRoutes } from "@airdesign/catalog"
import {
  beforeOf,
  format,
  landedPatch,
  readRegister,
  templateStyleNode,
  templateStylesNode,
  undoOf,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { account, connected, deckOf, grant, startAgents, stores, address, type Account } from "./agents-drive.js"
import { ask } from "./harness.js"

type Row = { readonly v?: number; readonly patch?: Readonly<Record<string, unknown>> }
type Body = { readonly landed: readonly Row[] }
type Saved = {
  readonly register: { readonly elements: Readonly<Record<string, Body>>; readonly order: readonly unknown[] }
  readonly index: {
    readonly templates?: readonly unknown[]
    readonly slides?: readonly { readonly template?: string }[]
  }
  readonly device: {
    readonly entries: readonly {
      readonly value: {
        readonly kind?: string
        readonly node?: string
        readonly v?: number
        readonly patch?: Row["patch"]
      } | null
    }[]
  }
}

function hashed(digits: string): `#${string}` {
  return `#${digits}`
}

const saved = JSON.parse(
  readFileSync(path.join(process.cwd(), "packages/document/src/format-64-deck.json"), "utf8"),
) as Saved

let stop = async () => {}
beforeAll(async () => {
  stop = await startAgents()
})
afterAll(async () => stop())

async function stored(
  deck: string,
): Promise<{ readonly register: Saved["register"]; readonly import_index: Saved["index"] }> {
  const found = await stores.deck.query<{ register: Saved["register"]; import_index: Saved["index"] }>(
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

function shown(register: Register, node: string) {
  const body = register.elements[node as ElementId]
  return body === undefined ? {} : landedPatch(body, "text")
}

async function commit(owner: Account, deck: string, batch: readonly unknown[]) {
  return (await ask(address.base, "POST", deckRoutes.commit.path, { deck, batch }, owner.cookie)).json
}

it("opens a deck main saved under theme, and leaves that stored row untouched", async () => {
  const owner = await account()
  const deck = await plant(owner)
  expect(Object.keys(saved.register.elements)).toContain("deck.theme")
  expect(saved.index.templates).toBeDefined()
  const { format: answered, register } = await opened(owner, deck)
  expect(answered).toBe(format)
  expect(shown(register, templateStylesNode).templateStyle).toEqual({ accent3: { set: "7030A0" } })
  expect(shown(register, templateStyleNode(0)).templateStyle).toMatchObject({
    accent1: { set: "C00000" },
    major: { set: "Georgia" },
  })
  expect(shown(register, "256.slide").templateStyle).toMatchObject({ id: { set: expect.any(String) } })
  expect(register.index?.slides.some((slide) => slide.templateStyle === "ppt/theme/theme2.xml")).toBe(true)
  expect(Object.keys(register.elements).join(" ")).not.toMatch(/deck\.(theme|template\d)/)
  expect(JSON.stringify(register.index)).not.toMatch(/"templates?":/)
  expect(register.index?.templateStyles?.length).toBe(saved.index.templates?.length)
  const kept = await stored(deck)
  expect(kept.register.elements).toEqual(saved.register.elements)
  expect(kept.import_index).toEqual(saved.index)
})

it("takes the template colour that build left unsent, undoes a new one, and stores both under templateStyle", async () => {
  const owner = await account()
  const deck = await plant(owner)
  const node = templateStyleNode(1)
  const before = await opened(owner, deck)
  const old = shown(before.register, node)
  const patch = { templateStyle: { accent6: { set: "ABCDEF" } } }
  expect(await commit(owner, deck, [{ node, v: format, patch, floor: "" }])).toMatchObject({ ok: true })
  const edited = await opened(owner, deck)
  expect(shown(edited.register, node).templateStyle).toMatchObject({ accent6: { set: "ABCDEF" } })

  const body = before.register.elements[node]
  if (body === undefined) throw new Error("no template style")
  const undo = undoOf(edited.register, {
    steps: [{ node, before: beforeOf(landedPatch(body, "text"), patch), after: patch }],
  })
  if (!undo.ok) throw new Error("undo")
  const rows = undo.commands.map((command) => {
    if (command.command !== "person" || command.v === undefined) throw new Error("a template colour undo is a row")
    return { node: command.node, v: command.v, patch: command.patch, floor: "" }
  })
  expect(await commit(owner, deck, rows)).toMatchObject({ ok: true })
  const undone = shown((await opened(owner, deck)).register, node).templateStyle
  expect(undone).toMatchObject(old.templateStyle ?? {})
  expect(undone).not.toMatchObject({ accent6: { set: "ABCDEF" } })

  const unsent = saved.device.entries.find((entry) => entry.value?.kind === "pending")?.value
  if (unsent?.patch === undefined || unsent.node === undefined) throw new Error("no unsent row")
  expect(Object.keys(unsent.patch)).toEqual(["theme"])
  expect(unsent.node).toBe("deck.template2")
  expect(await commit(owner, deck, [{ node: unsent.node, v: unsent.v, patch: unsent.patch, floor: "" }])).toMatchObject(
    {
      ok: true,
    },
  )
  const after = await stored(deck)
  expect(after.register.elements[node]?.landed.at(-1)).toMatchObject({
    v: format,
    patch: { templateStyle: { accent4: { set: "123456" } } },
  })
  expect(JSON.stringify(after.register.elements[node])).not.toContain('"theme"')
  expect(shown((await opened(owner, deck)).register, node).templateStyle).toMatchObject({ accent4: { set: "123456" } })
})

it("answers an agent that still says deck.theme, and reads the template styles under their new names", async () => {
  const owner = await account()
  const deck = await plant(owner)
  const agent = await connected({ authorization: `Bearer ${await grant(owner, "claude")}` })
  const read = await agent.call("read_deck", { deck })
  expect(read.ok, read.said).toBe(true)
  const styles = read.body.templateStyles as readonly {
    readonly node: string
    readonly palette: { readonly slots: { readonly accent3: string } }
  }[]
  expect(styles.map((style) => style.node)).toEqual([templateStyleNode(0), templateStyleNode(1)])
  expect(styles.every((style) => style.palette.slots.accent3 === "7030A0")).toBe(true)
  expect(read.said).not.toContain("deck.theme")
  const aliased = await agent.call("edit_deck", {
    deck,
    base: read.body.revision,
    changes: [{ op: "set", target: "deck.theme", theme: { accent2: hashed("00B050"), minor: "Verdana" } }],
  })
  expect(aliased.ok, aliased.said).toBe(true)
  const runId = aliased.body.runId
  expect(typeof runId).toBe("string")
  const stopped = await agent.call("stop_run", { deck, runId })
  expect(stopped.ok, stopped.said).toBe(true)
  const both = await agent.call("edit_deck", {
    deck,
    base: stopped.body.revision ?? aliased.body.revision,
    changes: [
      {
        op: "set",
        target: "deck.templateStyles",
        theme: { accent2: hashed("FF0000") },
        templateStyle: { accent2: hashed("00FF00") },
      },
    ],
  })
  expect(both.ok).toBe(false)
  const { register } = await opened(owner, deck)
  for (const node of [templateStyleNode(0), templateStyleNode(1)]) {
    expect(shown(register, node).templateStyle).toMatchObject({
      accent2: { set: "00B050" },
      minor: { set: "Verdana" },
    })
  }
  const kept = await stored(deck)
  const flat = JSON.stringify(kept.register.elements)
  expect(flat).toContain('"accent2":{"set":"00B050"}')
  expect(flat).toContain('"minor":{"set":"Verdana"}')
  expect(flat).not.toMatch(/"(theme|template)":/)
  expect(flat).not.toMatch(/deck\.(theme|template\d)/)
})

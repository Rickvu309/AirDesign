import { readFile } from "node:fs/promises"
import { deckRoutes, signInRoutes } from "@airdesign/catalog"
import { format } from "@airdesign/document"
import type { Pool } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, cookieFrom, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./account/sign-in-mail.js"

type Landed = { readonly v?: number; readonly patch?: Readonly<Record<string, unknown>> }
type Body = { readonly route: string; readonly landed: readonly Landed[] }
type Stored = {
  readonly route: string
  readonly index: Record<string, unknown>
  readonly elements: Readonly<Record<string, Body>>
  readonly order: readonly unknown[]
}
type Written = {
  readonly register: Stored
  readonly device: { readonly rows: readonly Readonly<Record<string, unknown>>[] }
}

let base = ""
let close = async () => {}
let saved: Pool
const mails: Mail[] = []
let cookie = ""
let written: Written

beforeAll(async () => {
  written = JSON.parse(
    await readFile(new URL("../../../packages/document/src/format-53-deck.json", import.meta.url), "utf8"),
  ) as Written
  const info = await postgresInfo()
  const session = openPool(info.session)
  saved = openPool(info.deck)
  const listen = new DeckListen(info.listen)
  const served = await serve({
    session,
    deck: saved,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  close = async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), saved.end()])
  }
  const email = "fills-stored@example.com"
  await ask(base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(mails.find((mail) => mail.to === email)?.text ?? "")
  const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
  cookie = cookieFrom(signed.headers) ?? ""
})
afterAll(async () => close())

async function stored(deck: string): Promise<{ revision: number; register: Stored; import_index: unknown }> {
  const found = await saved.query<{ revision: number; register: Stored; import_index: unknown }>(
    "select revision, register, import_index from deck.saved where id = $1",
    [deck],
  )
  const row = found.rows[0]
  if (row === undefined) throw new Error("missing deck")
  return row
}

async function plant(deck: string): Promise<{ readonly register: Stored; readonly index: unknown }> {
  const { index, ...register } = written.register
  expect((await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json).toMatchObject({ ok: true })
  await saved.query("update deck.saved set register = $2::jsonb, import_index = $3::jsonb where id = $1", [
    deck,
    JSON.stringify(register),
    JSON.stringify(index),
  ])
  return { register: register as Stored, index }
}

function traits(register: Stored): readonly string[] {
  return Object.values(register.elements).flatMap((body) => body.landed.flatMap((row) => Object.keys(row.patch ?? {})))
}

it("opens and edits a deck a format 53 build saved, and an edit that build left unsent lands as fills", async () => {
  const deck = "fills-stored-53"
  const planted = await plant(deck)
  expect(traits(planted.register)).toContain("fill")

  const opened = (await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json as {
    readonly ok: boolean
    readonly register: Stored & { readonly format: number }
  }
  expect(opened.ok).toBe(true)
  expect(opened.register.format).toBe(format)
  expect(traits(opened.register)).not.toContain("fill")
  expect(opened.register.elements["382.3"]?.landed).toEqual([
    { actor: "agent", runId: expect.any(String), visible: true, v: 57, patch: { fills: { p0: "inherit" } } },
  ])
  expect(JSON.stringify(opened.register.order)).not.toContain('"fill":')
  expect(JSON.stringify(opened.register.index)).not.toContain('"fill":')

  const unsent = written.device.rows.find((row) => row.kind === "pending")
  if (unsent === undefined) throw new Error("no unsent row")
  const { node, floor, v, patch } = unsent
  const edited = await ask(base, "POST", deckRoutes.commit.path, { deck, batch: [{ node, floor, v, patch }] }, cookie)
  expect(edited.json).toMatchObject({ ok: true, revision: 1 })

  const after = await stored(deck)
  expect(after.revision).toBe(1)
  expect(after.import_index).toEqual(planted.index)
  expect(traits(after.register)).not.toContain("fill")
  expect(after.register.elements["471.4"]?.landed.at(-1)).toEqual({
    actor: "person",
    visible: true,
    v: 57,
    patch: {
      fills: { p0: { set: { pattern: { preset: "pct5", fg: { scheme: "accent1" }, bg: { scheme: "accent1" } } } } },
    },
  })
  const reopened = (await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json as {
    readonly register: Stored
  }
  expect(reopened.register.elements["471.4"]?.landed).toEqual(after.register.elements["471.4"]?.landed)
})

import { deckRoutes, signInRoutes } from "@airdesign/catalog"
import { elementId, format, type IndexElement } from "@airdesign/document"
import { afterAll, beforeAll, expect, it } from "vitest"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

let base = ""
let close = async () => {}
const mails: Mail[] = []
let cookie = ""
const deck = "index-format"
const box = { x: 10, y: 20, cx: 30, cy: 40 }
const slides = [{ id: "258", position: 0 }]
const elements: IndexElement[] = [1, 2].map((n) => ({
  node: elementId(`258.${String(n)}`),
  kind: "shape",
  value: `Title ${String(n)}`,
  box,
  grouped: false,
}))
const designed = elements.map((element) => ({
  ...element,
  role: "body" as const,
  design: { "text.size": [18, "master"] },
}))
const palettes = [{ slots: { accent1: "4472C4" }, map: { tx1: "dk1" } }]

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session)
  const saved = openPool(info.deck)
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
  const email = "index-format@example.com"
  await ask(base, "POST", signInRoutes.email.path, { email })
  const { code } = readSignInMail(mails.find((mail) => mail.to === email)?.text ?? "")
  const signed = await ask(base, "POST", signInRoutes.code.path, { email, code })
  cookie = cookieFrom(signed.headers) ?? ""
})
afterAll(async () => close())

type Opened = { readonly register: { readonly format?: number; readonly index?: Record<string, unknown> } }

async function opened(): Promise<Opened["register"]> {
  return ((await ask(base, "POST", deckRoutes.open.path, { deck }, cookie)).json as Opened).register
}

it("keeps a stored format 1 index whole while a newer device sends it again beside it, then swaps it in", async () => {
  await opened()
  const older = { deck, once: "older", offset: 0, total: 2, slides, elements }
  expect((await ask(base, "POST", deckRoutes.index.path, older, cookie)).json).toEqual({ ok: true, deck, revision: 0 })
  const page = (offset: number) => ({
    deck,
    format,
    once: `newer-${String(offset)}`,
    offset,
    total: 2,
    palettes,
    slides,
    elements: [designed[offset]],
  })
  expect((await ask(base, "POST", deckRoutes.index.path, page(0), cookie)).json).toEqual({
    ok: true,
    deck,
    revision: 0,
  })
  const half = await opened()
  expect(half.format).toBe(format)
  expect(half.index).toMatchObject({ total: 2, elements })
  expect(half.index).not.toHaveProperty("next")
  expect(half.index).not.toHaveProperty("format")
  const edited = await ask(
    base,
    "POST",
    deckRoutes.commit.path,
    { deck, batch: [{ node: elements[0]!.node, value: "Edited", floor: elements[0]!.value }] },
    cookie,
  )
  expect(edited.json).toMatchObject({ ok: true, revision: 1 })
  expect((await ask(base, "POST", deckRoutes.index.path, page(1), cookie)).json).toEqual({
    ok: true,
    deck,
    revision: 1,
  })
  const whole = await opened()
  expect(whole.format).toBe(format)
  expect(whole.index).toMatchObject({ format, palettes, elements: designed })
  expect((await ask(base, "POST", deckRoutes.index.path, older, cookie)).json).toEqual({
    ok: false,
    refusal: "present",
  })
  const changed = { ...page(0), once: "drift", elements: [{ ...designed[0], value: "Read another way" }] }
  expect((await ask(base, "POST", deckRoutes.index.path, changed, cookie)).json).toEqual({
    ok: false,
    refusal: "present",
  })
})

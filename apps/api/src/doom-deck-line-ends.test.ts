import { randomBytes } from "node:crypto"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import type { Pool } from "pg"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { postgresInfo } from "./testing/harness.js"
import { openPool } from "./index.js"
import { createDoom, editDoom, openDoom, sinceDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"

let admin = new Client()
let pool: Pool
let email = ""
let edits = 0

beforeAll(async () => {
  const info = await postgresInfo()
  pool = openPool(info.deck, "doom-deck-line-ends")
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  email = `ends${randomBytes(4).toString("hex")}@example.com`
  await admin.query("insert into session.account (email) values ($1)", [email])
})

afterAll(async () => {
  await Promise.all([pool.end(), admin.end()])
})

const [target, line] = [doom.nodeId("c2:1"), doom.nodeId("c2:2")]
const lineOf = (start: unknown, end: unknown = { x: 10, y: 10 }) => ({
  kind: "line",
  start,
  end,
  route: "straight",
  arrows: ["none", "none"],
})
const onTarget = { node: target, site: "r" }

async function stored(deck: string): Promise<doom.Doom> {
  const opened = await openDoom(pool, { deck: deck as never }, email)
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  const fold = doom.readFold(opened.fold)
  if (fold === undefined) throw new Error("unreadable fold")
  return fold
}

async function send(deck: string, writes: readonly unknown[]) {
  const edit = { once: `ends-${String((edits += 1))}`, author: { kind: "person", id: "tab-1" }, writes }
  const landed = await editDoom(pool, { deck: deck as never, edit }, email)
  expect(landed).toMatchObject({ ok: true })
}

it("lands a line end on a shape the edit does not touch, and keeps the end the line holds over one that names a deleted shape", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const first = orderKeyBetween(null, null)
  await send(deck, [
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: target, prop: "box", value: { x: 300, y: 200, w: 100, h: 50, rotation: 0, flipH: false, flipV: false } },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: line, prop: "geometry", value: lineOf({ x: 0, y: 0 }) },
  ])
  await send(deck, [{ node: line, prop: "geometry", value: lineOf(onTarget) }])
  expect(doom.propOf((await stored(deck)).nodes.get(line), "geometry")).toEqual(lineOf(onTarget))
  await send(deck, [
    { node: target, prop: "parent", value: null },
    { node: line, prop: "geometry", value: lineOf({ x: 400, y: 225 }) },
  ])
  await send(deck, [{ node: line, prop: "geometry", value: lineOf(onTarget, { x: 40, y: 10 }) }])
  const fold = await stored(deck)
  expect(doom.propOf(fold.nodes.get(line), "geometry")).toEqual(lineOf({ x: 400, y: 225 }, { x: 40, y: 10 }))
  const logged = await sinceDoom(pool, { deck: deck as never, rev: 0 }, email)
  if (!logged.ok) throw new Error(JSON.stringify(logged))
  let replayed: doom.Doom = doom.emptyDoom
  for (const raw of logged.edits) {
    const landed = doom.readLanded(raw, replayed)
    if (doom.isRefusal(landed)) throw new Error(JSON.stringify(landed))
    const next = doom.applyEdit(replayed, landed)
    if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
    replayed = next
  }
  expect(doom.foldToJson(replayed)).toEqual(doom.foldToJson(fold))
})

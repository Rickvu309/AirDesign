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

async function sent(deck: string, writes: readonly unknown[]) {
  const edit = { once: `ends-${String((edits += 1))}`, author: { kind: "person", id: "tab-1" }, writes }
  return editDoom(pool, { deck: deck as never, edit }, email)
}

async function send(deck: string, writes: readonly unknown[]) {
  expect(await sent(deck, writes)).toMatchObject({ ok: true })
}

const measure = doom.measureWith({})
const placed = (x: number, y: number, w = 100, h = 50) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const gone = (node: doom.NodeId): doom.Write => ({ node, prop: "parent", value: null })

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
  await send(deck, doom.freeLineEnds(await stored(deck), [gone(target)], measure))
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

async function asWhole(deck: string, writes: readonly doom.Write[]) {
  const before = await stored(deck)
  const whole = doom.applyEdit(before, {
    once: "whole",
    author: { kind: "person", id: "tab-1" },
    writes,
    rev: doom.rev(before.rev + 1),
  })
  if (doom.isRefusal(whole)) throw new Error(JSON.stringify(whole))
  await send(deck, writes)
  const after = await stored(deck)
  expect(doom.propOf(after.nodes.get(line), "geometry")).toEqual(doom.propOf(whole.nodes.get(line), "geometry"))
  return after
}

const startOf = async (deck: string) => doom.propOf((await stored(deck)).nodes.get(line), "geometry")

it("lands a delete that leaves a line it does not name on a shape inside the frame it deletes, freed where the shape's stored box paints", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const [holder, first] = [doom.nodeId("c2:3"), orderKeyBetween(null, null)]
  await send(deck, [
    { node: holder, prop: "type", value: "frame" },
    { node: holder, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: holder, prop: "box", value: placed(100, 100, 400, 200) },
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: holder, at: first } },
    { node: target, prop: "box", value: placed(300, 100) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: line, prop: "geometry", value: lineOf(onTarget) },
  ])
  await asWhole(deck, [gone(holder)])
  expect(await startOf(deck)).toEqual(lineOf({ x: 500, y: 225 }))
})

it("lands a freed end read before another tab moved its shape, where the deleting tab painted it", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const first = orderKeyBetween(null, null)
  await send(deck, [
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: target, prop: "box", value: placed(300, 200) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: line, prop: "geometry", value: lineOf(onTarget) },
  ])
  const late = doom.freeLineEnds(await stored(deck), [gone(target)], measure)
  await send(deck, [{ node: target, prop: "box", value: placed(550, 200) }])
  await send(deck, late)
  expect(await startOf(deck)).toEqual(lineOf({ x: 400, y: 225 }))
})

it("frees a line on a shape a move puts inside a frame already off the deck, as the whole deck does", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const [shelf, inner, first] = [doom.nodeId("c2:3"), doom.nodeId("c2:4"), orderKeyBetween(null, null)]
  await send(deck, [
    { node: shelf, prop: "type", value: "frame" },
    { node: shelf, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: inner, prop: "type", value: "frame" },
    { node: inner, prop: "parent", value: { id: shelf, at: first } },
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: target, prop: "box", value: placed(300, 200) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: line, prop: "geometry", value: lineOf(onTarget) },
  ])
  await send(deck, [gone(shelf)])
  await asWhole(deck, [{ node: target, prop: "parent", value: { id: inner, at: first } }])
  expect(await startOf(deck)).toEqual(lineOf({ x: 400, y: 225 }))
})

it("lands a batch that deletes a shape and draws a new line onto it, freed where the shape painted", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const first = orderKeyBetween(null, null)
  await send(deck, [
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: target, prop: "box", value: placed(300, 200) },
  ])
  await asWhole(deck, [
    gone(target),
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: line, prop: "geometry", value: lineOf(onTarget) },
  ])
  expect(await startOf(deck)).toEqual(lineOf({ x: 400, y: 225 }))
})

it("frees a start a geometry write alone puts on a deleted shape, where the shape's stored box paints", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const first = orderKeyBetween(null, null)
  await send(deck, [
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: { id: startIds.slide, at: first } },
    { node: target, prop: "box", value: placed(300, 200) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: line, prop: "box", value: placed(0, 0) },
  ])
  await send(deck, [gone(target)])
  await asWhole(deck, [{ node: line, prop: "geometry", value: lineOf(onTarget) }])
  expect(await startOf(deck)).toEqual(lineOf({ x: 400, y: 225 }))
})

it("frees the end of a line a restored frame brings back onto the deck after its shape was deleted", async () => {
  const deck = `ends${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  const [holder, first] = [doom.nodeId("c2:3"), orderKeyBetween(null, null)]
  const onSlide = { id: startIds.slide, at: first }
  await send(deck, [
    { node: target, prop: "type", value: "shape" },
    { node: target, prop: "parent", value: onSlide },
    { node: target, prop: "box", value: placed(300, 200) },
    { node: holder, prop: "type", value: "frame" },
    { node: holder, prop: "parent", value: { id: startIds.slide, at: orderKeyBetween(first, null) } },
    { node: holder, prop: "box", value: placed(100, 100, 400, 200) },
    { node: line, prop: "type", value: "shape" },
    { node: line, prop: "parent", value: { id: holder, at: first } },
    { node: line, prop: "geometry", value: lineOf(onTarget) },
  ])
  await send(deck, [gone(holder)])
  await send(deck, [gone(target)])
  const fold = await stored(deck)
  const parentRev = fold.revs.get(holder)?.get("parent")
  if (parentRev === undefined) throw new Error("the holder has no parent rev")
  await asWhole(deck, [{ node: holder, prop: "parent", value: onSlide, base: parentRev }])
  expect(await startOf(deck)).toEqual(lineOf({ x: 300, y: 125 }))
})

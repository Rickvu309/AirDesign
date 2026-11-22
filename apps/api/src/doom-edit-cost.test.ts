import { randomBytes } from "node:crypto"
import { orderKeyBetween, doom } from "@airdesign/document"
import type { Pool } from "pg"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import { openPool, type Sql } from "./index.js"
import { createDoom, editDoom } from "./doom-deck.js"
import { startIds } from "./doom-start.js"

type Traffic = { statements: number; rows: number; bytes: number }

let admin = new Client()
let pool: Pool
let email = ""

const person: doom.Author = { kind: "person", id: "tab-1" }
const nodeAt = (id: string) => doom.nodeId(id)

function counted(inner: Pool, traffic: Traffic): Sql {
  return new Proxy(inner, {
    get(target, name) {
      if (name !== "query") return Reflect.get(target, name, target) as unknown
      return async (text: string, values?: unknown[]) => {
        const answer = await target.query(text, values)
        traffic.statements += 1
        traffic.rows += answer.rows.length
        traffic.bytes += JSON.stringify(values ?? []).length + JSON.stringify(answer.rows).length
        return answer
      }
    },
  }) as unknown as Sql
}

beforeAll(async () => {
  const info = await postgresInfo()
  pool = openPool(info.deck, "doom-edit-cost")
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  email = `cost${randomBytes(4).toString("hex")}@example.com`
  await admin.query("insert into session.account (email) values ($1)", [email])
})

afterAll(async () => {
  await Promise.all([pool.end(), admin.end()])
})

async function boardOf(slides: number): Promise<{ deck: string; target: doom.NodeId }> {
  const deck = `cost${randomBytes(6).toString("hex")}`
  await createDoom(pool, { deck: deck as never }, email)
  let slideKey: string | null = null
  const groups: unknown[][] = []
  for (let slide = 0; slide < slides; slide += 1) {
    const writes: unknown[] = []
    groups.push(writes)
    const id = `b:${String(slide + 10)}`
    slideKey = orderKeyBetween(slideKey as never, null)
    writes.push(
      { node: id, prop: "type", value: "slide" },
      { node: id, prop: "parent", value: { id: startIds.row, at: slideKey } },
    )
    let shapeKey: string | null = null
    for (let shape = 0; shape < 10; shape += 1) {
      const child = `c:${String(slide * 100 + shape + 1000)}`
      shapeKey = orderKeyBetween(shapeKey as never, null)
      writes.push(
        { node: child, prop: "type", value: "shape" },
        { node: child, prop: "parent", value: { id, at: shapeKey } },
        { node: child, prop: "name", value: `Shape ${String(shape)} on slide ${String(slide)}` },
        { node: child, prop: "box", value: { x: 10, y: 20, w: 300, h: 100, rotation: 0, flipH: false, flipV: false } },
      )
    }
  }
  for (let from = 0; from < groups.length; from += 5) {
    const landed = await editDoom(
      pool,
      {
        deck: deck as never,
        edit: { once: `board-${String(from)}`, author: person, writes: groups.slice(from, from + 5).flat() },
      },
      email,
    )
    if (!landed.ok) throw new Error(JSON.stringify(landed))
  }
  return { deck, target: nodeAt(`c:${String(Math.min(1, slides - 1) * 100 + 1001)}`) }
}

async function trafficOfOneEdit(slides: number): Promise<Traffic> {
  const { deck, target } = await boardOf(slides)
  const traffic: Traffic = { statements: 0, rows: 0, bytes: 0 }
  const landed = await editDoom(
    counted(pool, traffic),
    {
      deck: deck as never,
      edit: { once: "move-one", author: person, writes: [{ node: target, prop: "name", value: "Moved" }] },
    },
    email,
  )
  expect(landed.ok).toBe(true)
  return traffic
}

describe("what one edit reads and writes", () => {
  it("is the same on a 40-slide deck as on a 5-slide deck", async () => {
    const small = await trafficOfOneEdit(5)
    const large = await trafficOfOneEdit(40)
    expect(large.statements).toBe(small.statements)
    expect(large.rows).toBe(small.rows)
    expect(large.bytes).toBeLessThan(small.bytes * 1.2)
  })

  it("keeps an edit's cost to a few statements and a few kilobytes on a 40-slide deck", async () => {
    const large = await trafficOfOneEdit(40)
    expect(large.statements).toBeLessThanOrEqual(3)
    expect(large.bytes).toBeLessThan(8_000)
  })

  it("renames the deck without reading any other node", async () => {
    const { deck } = await boardOf(40)
    const traffic: Traffic = { statements: 0, rows: 0, bytes: 0 }
    const landed = await editDoom(
      counted(pool, traffic),
      {
        deck: deck as never,
        edit: { once: "rename", author: person, writes: [{ node: startIds.deck, prop: "name", value: "Named" }] },
      },
      email,
    )
    expect(landed.ok).toBe(true)
    expect(traffic.bytes).toBeLessThan(40_000)
    const row = await admin.query("select name from deck.doom where id = $1", [deck])
    expect(row.rows).toEqual([{ name: "Named" }])
  })
})

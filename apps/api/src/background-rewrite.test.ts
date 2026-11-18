import { deckRoutes } from "@airdesign/catalog"
import {
  answeredRegister,
  decide,
  elementId,
  landedPatch,
  openRegister,
  openingElement,
  orderKeyBetween,
  slideId,
  type Register,
} from "@airdesign/document"
import { Client, type Notification } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { migrations } from "./migrations.js"
import { startEmptyCluster, type EmptyCluster } from "./postgres-setup.js"
import { createRole } from "./provision.js"
import { applySchema } from "./schema.js"

const owner = "owner@example.com"
const file = [slideId("256"), slideId("257")]
const navy = { rgb: "0F2433" } as const
const accent = { scheme: "accent1" } as const
const first = orderKeyBetween(null, null)
const second = orderKeyBetween(first, null)
const third = orderKeyBetween(second, null)
const fourth = orderKeyBetween(third, null)
const fifth = orderKeyBetween(fourth, null)
const ownNode = { node: "904.slide", kind: "slide", value: null, box: null, grouped: false }

let cluster: EmptyCluster
let db: Client
let listener: Client
let heard: string[] = []
const opened: Client[] = []
let counter = 0
const latest = migrations.length
const atBackup = 14
const backgroundCommand = "select id from deck.saved where register->'order' @> '[{\"slide\": \"background\"}]'"

function stored(order: readonly unknown[], base: Register = openRegister("", "deck")): string {
  return JSON.stringify({ ...base, file, order })
}

function withSlideRow(): Register {
  const node = elementId("256.slide")
  const opened = decide({ ...openRegister("", "deck"), file }, { command: "add", node, floor: "", route: "deck" })
  if (opened.decision !== "apply") throw new Error(opened.code)
  const body = opened.register.elements[node]
  if (body === undefined) throw new Error(node)
  const written = { actor: "person", visible: true, v: 28, patch: { fill: { value: { set: { solid: accent } } } } }
  return {
    ...opened.register,
    elements: { ...opened.register.elements, [node]: { ...body, landed: [written] } },
  } as never
}

async function insert(id: string, register: string | null, extra = ""): Promise<void> {
  const deleted = register === null ? "now()" : "null"
  await db.query(
    `insert into deck.saved (id, revision, register, owner, deleted) values ($1, 5, $2::jsonb, $3, ${deleted}) ${extra}`,
    [id, register, owner],
  )
}

async function read(id: string): Promise<{ revision: number; register: Register }> {
  const found = await db.query<{ revision: number; register: unknown }>(
    "select revision, register from deck.saved where id = $1",
    [id],
  )
  const row = found.rows[0]
  if (row === undefined) throw new Error(id)
  const register = answeredRegister(row.register as Register)
  const answer = deckRoutes.open.result({ ok: true, deck: id, revision: row.revision, register })
  if (!answer.ok) throw new Error(`${id} does not open: ${answer.refusal}`)
  return { revision: row.revision, register: answer.register }
}

function fillOf(register: Register, node: string) {
  const body = register.elements[elementId(node)]
  return body === undefined ? undefined : landedPatch(body, "text").fills?.p0
}

function row(color: unknown, runId?: string) {
  const value = color === null ? "opening" : { set: { solid: color } }
  const actor = runId === undefined ? { actor: "person" } : { actor: "agent", runId }
  return { ...actor, visible: true, v: 57, patch: { fills: { p0: value } } }
}

async function open(database: string): Promise<Client> {
  const client = new Client({ connectionString: `postgres://postgres@127.0.0.1:${String(cluster.port)}/${database}` })
  await client.connect()
  opened.push(client)
  return client
}

async function useDatabase(applied: number): Promise<void> {
  counter += 1
  const database = `rewrite_${String(counter)}`
  await (await open("postgres")).query(`create database ${database}`)
  db = await open(database)
  if (applied > 0) {
    expect(await applySchema(db, migrations.slice(0, applied))).toEqual({ applied, at: applied })
    await db.query("insert into session.account (email) values ($1)", [owner])
  }
  heard = []
  listener = await open(database)
  listener.on("notification", (message: Notification) => heard.push(message.payload ?? ""))
  await listener.query("listen deck")
}

async function storeOldDecks(): Promise<string> {
  const painted = stored([
    { slide: "background", id: "256", color: navy },
    { slide: "clone", id: "900", source: "256", key: first },
    { slide: "background", id: "256", color: null },
    { slide: "clone", id: "901", source: "900", key: second },
    { slide: "background", id: "900", color: accent },
    { slide: "background", id: "900", color: null },
    { slide: "background", id: "257", color: accent, runId: "run" },
    { slide: "clone", id: "902", source: "257", key: third, runId: "run" },
    { slide: "clone", id: "903", source: "256", key: fourth },
    { slide: "remove", id: "903" },
    { slide: "clone", id: "904", source: "256", key: fifth, floor: [ownNode] },
  ])
  await insert("painted", painted)
  await insert("kept", stored([{ slide: "background", id: "256", color: navy }], withSlideRow()))
  await insert("plain", stored([{ slide: "clone", id: "900", source: "256", key: first }]))
  await insert("trashed", stored([{ slide: "background", id: "257", color: navy }]))
  await db.query("update deck.saved set trashed = now() where id = 'trashed'")
  await insert("gone", null)
  for (let at = 0; at < 3; at += 1) {
    await insert(`bulk-${String(at)}`, stored([{ slide: "background", id: "256", color: accent }]))
  }
  return painted
}

async function decks(): Promise<unknown[]> {
  return (await db.query("select id, revision, register from deck.saved order by id")).rows
}

async function schemaOf(client: Client): Promise<unknown[]> {
  const queries = [
    `select table_schema, table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_schema in ('session', 'deck', 'setup')
     order by table_schema, table_name, column_name`,
    `select schemaname, tablename, indexdef from pg_indexes where schemaname in ('session', 'deck', 'setup')
     order by schemaname, indexname`,
    `select n.nspname, c.conrelid::regclass::text as on_table, c.conname, pg_get_constraintdef(c.oid) as definition
     from pg_constraint c join pg_namespace n on n.oid = c.connamespace
     where n.nspname in ('session', 'deck', 'setup') order by n.nspname, on_table, c.conname`,
    `select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments, md5(p.prosrc) as body
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('session', 'deck', 'setup') order by n.nspname, p.proname, arguments`,
    `select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants
     where grantee in ('session', 'deck', 'listen') order by grantee, table_schema, table_name, privilege_type`,
  ]
  const all: unknown[] = []
  for (const query of queries) all.push((await client.query(query)).rows)
  return all
}

beforeAll(async () => {
  cluster = await startEmptyCluster()
  const admin = await open("postgres")
  for (const role of ["session", "deck", "listen"]) await createRole(admin, role, "local-test")
})

afterAll(async () => {
  await Promise.all(opened.map((client) => client.end().catch(() => undefined)))
  await cluster.stop()
})

it("rewrites each stored background command into fill rows on a database that never had migration 14", async () => {
  await useDatabase(13)
  await storeOldDecks()

  expect(await applySchema(db)).toEqual({ applied: latest - 13, at: latest })

  const view = await read("painted")
  expect(view.revision).toBe(6)
  expect(view.register.order).toEqual([
    {
      slide: "clone",
      id: "900",
      source: "256",
      key: first,
      floor: [{ ...ownNode, node: "900.slide", opening: { fills: { p0: { set: { solid: navy } } } } }],
    },
    {
      slide: "clone",
      id: "901",
      source: "900",
      key: second,
      floor: [{ ...ownNode, node: "901.slide", opening: { fills: { p0: { set: { solid: navy } } } } }],
    },
    {
      slide: "clone",
      id: "902",
      source: "257",
      key: third,
      runId: "run",
      floor: [{ ...ownNode, node: "902.slide", opening: { fills: { p0: { set: { solid: accent } } } } }],
    },
    { slide: "clone", id: "903", source: "256", key: fourth },
    { slide: "remove", id: "903" },
    { slide: "clone", id: "904", source: "256", key: fifth, floor: [ownNode] },
  ])
  expect(view.register.nodes).toEqual([...openRegister("", "deck").nodes, "256.slide", "900.slide", "257.slide"])
  expect(view.register.elements[elementId("256.slide")]?.landed).toEqual([row(navy), row(null)])
  expect(view.register.elements[elementId("900.slide")]?.landed).toEqual([row(accent), row(null)])
  expect(view.register.elements[elementId("257.slide")]).toEqual({
    route: "deck",
    floor: "",
    landed: [row(accent, "run")],
    phase: "idle",
    runId: null,
    readAt: null,
    guarded: false,
    claimed: null,
    stoppedAt: null,
    slides: 1,
    bytes: 0,
  })
  expect(fillOf(view.register, "256.slide")).toBe("opening")
  expect(fillOf(view.register, "257.slide")).toEqual({ set: { solid: accent } })
  expect(openingElement(view.register, elementId("903.slide"))).toBeUndefined()

  const kept = await read("kept")
  expect(kept.register.nodes).toEqual(withSlideRow().nodes)
  expect(kept.register.elements[elementId("256.slide")]?.landed).toEqual([row(navy), row(accent)])
  expect(fillOf(kept.register, "256.slide")).toEqual({ set: { solid: accent } })
  expect(fillOf((await read("trashed")).register, "257.slide")).toEqual({ set: { solid: navy } })
  expect(await read("plain")).toEqual({
    revision: 5,
    register: JSON.parse(stored([{ slide: "clone", id: "900", source: "256", key: first }])),
  })
  expect((await db.query(backgroundCommand)).rows).toEqual([])
  await listener.query("select 1")
  expect(heard).toContain("painted:6")
  expect(heard).toContain("bulk-2:6")
  expect(heard).not.toContain("plain:6")
  expect(heard).not.toContain("gone:6")

  const before = await decks()
  expect(await applySchema(db)).toEqual({ applied: 0, at: latest })
  expect(await decks()).toEqual(before)
}, 60_000)

it("drops the background backup from a database at migration 14 without rewriting a deck again", async () => {
  await useDatabase(atBackup)
  const painted = await storeOldDecks()
  for (;;) {
    const batch = await db.query<{ done: number }>("select deck.rewrite_backgrounds(2) as done")
    if (batch.rows[0]?.done === 0) break
  }
  expect((await db.query("select count(*)::integer as rows from deck.background_backup")).rows).toEqual([{ rows: 6 }])
  expect((await db.query("select register from deck.background_backup where id = 'painted'")).rows).toEqual([
    { register: JSON.parse(painted) },
  ])
  const rewritten = await decks()
  await listener.query("select 1")
  heard = []

  expect(await applySchema(db)).toEqual({ applied: latest - atBackup, at: latest })

  expect(await decks()).toEqual(rewritten)
  await listener.query("select 1")
  expect(heard).toEqual([])
  const left = await db.query<{ backup: string | null; rewrite: string | null; upgrade: string | null }>(
    `select to_regclass('deck.background_backup')::text as backup,
       to_regprocedure('deck.rewrite_backgrounds(integer)')::text as rewrite,
       to_regprocedure('deck.slide_backgrounds(jsonb)')::text as upgrade`,
  )
  expect(left.rows).toEqual([{ backup: null, rewrite: null, upgrade: null }])

  expect(await applySchema(db)).toEqual({ applied: 0, at: latest })
  expect(await decks()).toEqual(rewritten)

  await db.query("select session.delete_account($1)", [owner])
  expect((await db.query("select count(*)::integer as rows from deck.saved where owner = $1", [owner])).rows).toEqual([
    { rows: 0 },
  ])
  expect((await db.query("select count(*)::integer as rows from session.account")).rows).toEqual([{ rows: 0 }])

  const upgraded = await schemaOf(db)
  await useDatabase(0)
  expect(await applySchema(db)).toEqual({ applied: latest, at: latest })
  expect(await schemaOf(db)).toEqual(upgraded)
}, 60_000)

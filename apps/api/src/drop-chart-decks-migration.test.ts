import { randomBytes } from "node:crypto"
import { readDeckId } from "@airdesign/catalog"
import {
  applyEdit,
  columnDefinition,
  defaultTheme,
  doomFromTree,
  isRefusal,
  measureWith,
  nodeId,
  orderKeyBetween,
  placeComponent,
  parentOf,
  readFold,
  regenerateComponent,
  rev,
  textFromMarkdown,
  type Doom,
  type Instance,
} from "@airdesign/doom"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { createDoom, editDoom, openDoom } from "./doom/doom-deck.js"
import { startEmptyCluster, type EmptyCluster } from "./testing/postgres-setup.js"
import { runBootstrap } from "./platform/provision.js"
import { applySchema } from "./platform/schema.js"
import { migrations } from "./platform/testing/migrations.js"

const secrets = {
  session: randomBytes(18).toString("base64url"),
  deck: randomBytes(18).toString("base64url"),
  listen: randomBytes(18).toString("base64url"),
  migrator: randomBytes(18).toString("base64url"),
}
const tables = ["deck.doom", "deck.doom_node", "deck.doom_edit", "session.agent_turn", "deck.media"]
const opened: Client[] = []
let cluster: EmptyCluster

function roleUrl(role: keyof typeof secrets | "postgres", database: string): string {
  const secret = role === "postgres" ? "" : `:${secrets[role]}`
  return `postgres://${role}${secret}@127.0.0.1:${String(cluster.port)}/${database}`
}

async function open(role: keyof typeof secrets | "postgres", database: string): Promise<Client> {
  const client = new Client({ connectionString: roleUrl(role, database) })
  await client.connect()
  opened.push(client)
  return client
}

async function deckRows(client: Client, deck: string): Promise<string[][]> {
  const rows: string[][] = []
  for (const table of tables) {
    const key = table === "deck.doom" ? "id" : "deck"
    const result = await client.query<{ row: string }>(
      `select to_jsonb(t)::text as row from ${table} t where ${key} = $1 order by 1`,
      [deck],
    )
    rows.push(result.rows.map(({ row }) => row))
  }
  return rows
}

function nodeRows(doom: Doom) {
  return [...doom.nodes.values()].map((node) => ({
    id: node.id,
    type: node.type,
    parent: parentOf(node)?.id ?? null,
    node,
    revs: Object.fromEntries(doom.revs.get(node.id) ?? []),
  }))
}

async function insertNodes(client: Client, deck: string, doom: Doom) {
  await client.query(
    `insert into deck.doom_node (deck, id, type, parent, node, revs)
     select $1, id, type, parent, node, revs
     from jsonb_to_recordset($2::jsonb) as row(id text, type text, parent text, node jsonb, revs jsonb)`,
    [deck, JSON.stringify(nodeRows(doom))],
  )
}

async function insertRemovedRowDeck(client: Client) {
  const named = readDeckId("removed-row")
  if (!named.ok) throw new Error(JSON.stringify(named))
  const { deck } = named
  const email = "owner@example.com"
  const stored = async () => {
    const opened = await openDoom(client, { deck }, email)
    const fold = opened.ok ? readFold(opened.fold) : undefined
    if (fold === undefined) throw new Error(JSON.stringify(opened))
    return fold
  }
  const send = async (edit: Readonly<Record<string, unknown>>) => {
    const landed = await editDoom(client, { deck, edit }, email)
    if (!landed.ok) throw new Error(JSON.stringify(landed))
  }
  await createDoom(client, { deck }, email)
  const started = await stored()
  const slide = [...started.nodes.values()].find(({ type }) => type === "slide")
  if (slide === undefined) throw new Error("missing removed row deck slide")
  const measure = measureWith({})
  const frame = nodeId("chart:1")
  const sample = {
    rows: [{ id: "chart", label: "Chart", value: 9 }, ...(columnDefinition.spec.sample?.data.rows ?? [])],
  }
  const placed = placeComponent(started, columnDefinition, {
    frame,
    parent: { id: slide.id, at: orderKeyBetween(null, null) },
    box: { x: 190, y: 210, w: 1200, h: 650, rotation: 0, flipH: false, flipV: false },
    data: sample,
    measure,
  })
  if (isRefusal(placed)) throw new Error(JSON.stringify(placed))
  await send({ once: "place", author: { kind: "person", id: "tab-1" }, writes: placed, readBase: started.rev })
  const linked = (await stored()).nodes.get(frame) as { instance?: Instance } | undefined
  const bar = linked?.instance?.parts.find(({ key }) => key.join() === "bar,chart")?.node
  if (bar === undefined) throw new Error("missing bar for the row named chart")
  const author = { kind: "agent", id: "aira", run: "trim" }
  await send({ once: "trim-start", author, writes: [], phase: "start" })
  await send({
    once: "highlight",
    author,
    writes: [{ node: bar, prop: "fills", value: [{ kind: "solid", color: { var: "accent3" } }] }],
  })
  const highlighted = await stored()
  const trimmed = regenerateComponent(highlighted, frame, { data: { rows: sample.rows.slice(1) } }, measure)
  if (isRefusal(trimmed)) throw new Error(JSON.stringify(trimmed))
  await send({ once: "trim", author, writes: trimmed.writes, readBase: highlighted.rev })
  await client.query(
    "insert into session.agent_turn (email, deck, last_call, revision) select owner, id, 1, rev from deck.doom where id = $1",
    [deck],
  )
  return (
    await client.query<{ replaced: string }>(
      "select replaced::text as replaced from deck.doom_edit where deck = $1 and once = 'trim'",
      [deck],
    )
  ).rows[0]?.replaced
}

async function insertLinkedDeck(client: Client) {
  const { doom, slides, ids, edit } = doomFromTree({
    theme: defaultTheme,
    slides: [{ children: [{ type: "shape", name: "label", props: { text: textFromMarkdown("chart", "body") } }] }],
  })
  const slide = slides[0]
  const label = ids.label
  if (slide === undefined || label === undefined) throw new Error("missing linked deck slide or label")
  const writes = placeComponent(doom, columnDefinition, {
    frame: nodeId("chart:1"),
    parent: { id: slide, at: orderKeyBetween(null, parentOf(doom.nodes.get(label))?.at ?? null) },
    box: { x: 190, y: 210, w: 1200, h: 650, rotation: 0, flipH: false, flipV: false },
    data: columnDefinition.spec.sample?.data,
    measure: measureWith({}),
  })
  if (isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const placed = { once: "place", author: edit.author, writes, readBase: doom.rev, rev: rev(2) }
  const saved = applyEdit(doom, placed)
  if (isRefusal(saved)) throw new Error(JSON.stringify(saved))
  await insertNodes(client, "d", saved)
  await client.query("insert into deck.doom_edit (deck, rev, once, edit) values ('d', 1, $1, $2), ('d', 2, $3, $4)", [
    edit.once,
    edit,
    placed.once,
    placed,
  ])
}

beforeAll(async () => {
  cluster = await startEmptyCluster()
})

afterAll(async () => {
  await Promise.all(opened.map((client) => client.end().catch(() => undefined)))
  await cluster.stop()
})

it("drops decks with chart data, edits or revisions and keeps linked chart decks, even one whose run removed a row named chart", async () => {
  const admin = await open("postgres", "postgres")
  await admin.query("create database cutover")
  expect(
    await runBootstrap(
      {
        ADMIN_DATABASE_URL: roleUrl("postgres", "cutover"),
        SESSION_DATABASE_URL: roleUrl("session", "cutover"),
        DECK_DATABASE_URL: roleUrl("deck", "cutover"),
        LISTEN_DATABASE_URL: roleUrl("listen", "cutover"),
        MIGRATOR_DATABASE_URL: roleUrl("migrator", "cutover"),
      },
      () => undefined,
    ),
  ).toBe(0)
  const migrator = await open("migrator", "cutover")
  await applySchema(
    migrator,
    migrations.filter(({ id }) => id < 29),
  )
  await migrator.query(`
    insert into session.account (email) values ('owner@example.com');
    insert into deck.doom (id, owner, rev)
      select id, 'owner@example.com', 2 from unnest(array['a', 'b', 'c', 'd', 'replaced-only']) as id;
    insert into deck.doom_node (deck, id, type, node, revs) values
      ('a', 'part', 'frame', '{"type":"frame","chart":{"kind":"column","categories":[],"series":[]}}', '{}'),
      ('b', 'slide', 'slide', '{"type":"slide"}', '{}'),
      ('c', 'part', 'frame', '{"type":"frame"}', '{"chart":1}');
    insert into deck.doom_edit (deck, rev, once, edit, replaced) values
      ('a', 1, 'create', '{}', null),
      ('b', 1, 'create', '{"writes":[{"node":"part","prop":"chart","value":{}}]}', null),
      ('b', 2, 'delete', '{"writes":[{"node":"part","prop":"type","value":null}]}', null),
      ('c', 1, 'create', '{}', null),
      ('replaced-only', 1, 'delete', '{}', '[{"node":"part","key":"chart","value":{}}]');
    insert into session.agent_turn (email, deck, last_call, revision)
      select owner, id, 1, rev from deck.doom;
    insert into deck.media (key, deck, sha256, bytes) values
      ('old-media', 'a', 'old-hash', 12),
      ('kept-media', 'd', 'kept-hash', 14);
  `)
  await insertLinkedDeck(migrator)
  expect(await insertRemovedRowDeck(migrator)).toContain('"key": ["bar", "chart"]')
  const kept = { d: await deckRows(migrator, "d"), removedRow: await deckRows(migrator, "removed-row") }

  const throughCutover = migrations.filter(({ id }) => id <= 29)
  expect(await applySchema(migrator, throughCutover)).toEqual({ applied: 1, at: 29 })
  for (const id of ["a", "b", "c", "replaced-only"]) {
    expect(await deckRows(migrator, id)).toEqual([[], [], [], [], []])
  }
  expect({ d: await deckRows(migrator, "d"), removedRow: await deckRows(migrator, "removed-row") }).toEqual(kept)
  expect((await migrator.query("select key, owner from deck.original_delete order by key")).rows).toEqual([
    { key: "old-media", owner: "owner@example.com" },
  ])
  expect(await applySchema(migrator, throughCutover)).toEqual({ applied: 0, at: 29 })
})

import type { DeckId, SceneRefusal } from "@airdesign/catalog"
import { limits, scene } from "@airdesign/document"

import type { Sql } from "./pool.js"
import { uniqueOnce } from "./saved.js"
import { startEdit } from "./scene-start.js"

const readSql = "select id, owner, rev, fold from deck.scene where id = $1"

const insertSql = `
with inserted as (
  insert into deck.scene (id, owner, name, rev, fold) values ($1, $2, $3, $4, $5::jsonb)
  on conflict (id) do nothing
  returning id, rev
),
logged as (
  insert into deck.scene_edit (deck, rev, once, edit) select id, rev, $6, $7::jsonb from inserted returning deck, rev
)
select pg_notify('deck', deck || ':' || rev::text) as notified from logged`

const updateSql = `
with updated as (
  update deck.scene set rev = $2, fold = $3::jsonb, name = $7, edited = now()
  where id = $1 and rev = $4
  returning id, rev
),
logged as (
  insert into deck.scene_edit (deck, rev, once, edit) select id, rev, $5, $6::jsonb from updated returning deck, rev
)
select rev, pg_notify('deck', deck || ':' || rev::text) as notified from logged`

const editsSql =
  "select rev, edit, octet_length(edit::text) as bytes from deck.scene_edit where deck = $1 and rev > $2 order by rev limit $3"

const attempts = 8
const answerEdits = 100

type Stored = { readonly id: string; readonly owner: string; readonly rev: number; readonly fold: unknown }

const refusal = (kind: Exclude<SceneRefusal, { refusal: "edit" }>["refusal"]) => ({ ok: false, refusal: kind }) as const

function editRefusal(refused: scene.Refusal) {
  return { ok: false, refusal: "edit", ...refused } as const
}

type Opened = { readonly ok: true; readonly stored: Stored; readonly fold: scene.Scene } | ReturnType<typeof refusal>

function openedFor(stored: Stored | undefined, email: string): Opened {
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  const fold = scene.readFold(stored.fold)
  return fold === undefined ? refusal("payload") : { ok: true, stored, fold }
}

async function readStored(db: Sql, deck: DeckId): Promise<Stored | undefined> {
  return (await db.query<Stored>(readSql, [deck])).rows[0]
}

function answered(deck: DeckId, stored: Stored) {
  return { ok: true, deck, rev: stored.rev, fold: stored.fold } as const
}

export async function createScene(db: Sql, parsed: { readonly deck: DeckId }, email: string) {
  if ((await readStored(db, parsed.deck)) === undefined) {
    const edit = { ...startEdit(), rev: scene.rev(1) }
    const started = scene.applyEdit(scene.emptyScene, edit)
    if (scene.isRefusal(started)) throw new Error(`the starting scene was refused: ${started.refused}`)
    await db.query(insertSql, [
      parsed.deck,
      email,
      scene.deckName(started),
      1,
      JSON.stringify(scene.foldToJson(started)),
      edit.once,
      JSON.stringify(scene.readEdit({ once: edit.once, author: edit.author, writes: edit.writes }, scene.emptyScene)),
    ])
  }
  return openScene(db, parsed, email)
}

export async function openScene(db: Sql, parsed: { readonly deck: DeckId }, email: string) {
  const opened = openedFor(await readStored(db, parsed.deck), email)
  return opened.ok ? answered(parsed.deck, opened.stored) : opened
}

export async function editScene(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly edit: Readonly<Record<string, unknown>> },
  email: string,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const opened = openedFor(await readStored(db, parsed.deck), email)
    if (!opened.ok) return opened
    const { fold } = opened
    const read = scene.readEdit(parsed.edit, fold)
    if (scene.isRefusal(read)) return editRefusal(read)
    const landed = { ...read, rev: scene.rev(fold.rev + 1) }
    const next = scene.applyEdit(fold, landed)
    if (scene.isRefusal(next)) return editRefusal(next)
    if (next === fold) return { ok: true, deck: parsed.deck, rev: fold.onces.get(read.once) ?? fold.rev } as const
    try {
      const wrote = await db.query(updateSql, [
        parsed.deck,
        landed.rev,
        JSON.stringify(scene.foldToJson(next)),
        fold.rev,
        landed.once,
        JSON.stringify(read),
        scene.deckName(next),
      ])
      if (wrote.rows.length > 0) return { ok: true, deck: parsed.deck, rev: landed.rev } as const
    } catch (error) {
      if (!uniqueOnce(error)) throw error
    }
  }
  return refusal("stale")
}

export async function sinceScene(db: Sql, parsed: { readonly deck: DeckId; readonly rev: number }, email: string) {
  const stored = await readStored(db, parsed.deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (parsed.rev > stored.rev) return refusal("cursor")
  const rows = await db.query<{ rev: number; edit: unknown; bytes: number }>(editsSql, [
    parsed.deck,
    parsed.rev,
    answerEdits,
  ])
  const edits: unknown[] = []
  let bytes = 0
  for (const row of rows.rows) {
    bytes += row.bytes
    if (edits.length > 0 && bytes > limits.body) break
    edits.push({ ...(row.edit as object), rev: row.rev })
  }
  const head = await readStored(db, parsed.deck)
  return { ok: true, deck: parsed.deck, rev: Math.max(head?.rev ?? 0, rows.rows.at(-1)?.rev ?? 0), edits } as const
}

export async function sceneRev(db: Sql, deck: DeckId, email: string) {
  const stored = await readStored(db, deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  return { ok: true, rev: stored.rev } as const
}

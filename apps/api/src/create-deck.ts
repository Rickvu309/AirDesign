import { createHash, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

import { readDeckId, readDeckIndex, type DeckId } from "@airdesign/catalog"
import type { Deck } from "@airdesign/engine"
import type { CreatedDeck } from "@airdesign/mcp"
import { blankTemplate, startIndexFile, templateFile } from "@airdesign/templates"

import { indexSaved } from "./index-saved.js"
import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"
import { deckAccess, openSaved, readSaved } from "./saved.js"

type StartDeck = {
  readonly bytes: Uint8Array
  readonly sha256: string
  readonly pages: readonly Readonly<Record<string, unknown>>[]
}

const locate = createRequire(import.meta.url)
const startDecks = new Map<string, Promise<StartDeck>>()

async function readStartDeck(template: string): Promise<StartDeck> {
  const bytes = new Uint8Array(await readFile(locate.resolve(`@airdesign/templates/${templateFile(template, true)}`)))
  const pages = JSON.parse(
    await readFile(locate.resolve(`@airdesign/templates/${startIndexFile(template)}`), "utf8"),
  ) as StartDeck["pages"]
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), pages }
}

function startDeck(template: string): Promise<StartDeck> {
  const known = startDecks.get(template)
  if (known !== undefined) return known
  const read = readStartDeck(template)
  startDecks.set(template, read)
  return read
}

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

const storeSql = `
update deck.saved set original_key = $3, original_bytes = $4, original_sha256 = $5, original_stored = true
where id = $1 and owner = $2 and deleted is null and not original_stored`

const nameSql = "update deck.saved set name = $3 where id = $1 and owner = $2 and deleted is null and name = ''"

const madeSql = "select name, original_stored from deck.saved where id = $1 and owner = $2 and deleted is null"

export type Created =
  | { readonly ok: true; readonly created: CreatedDeck; readonly deck: Deck; readonly storedIndex: unknown }
  | { readonly ok: false; readonly refusal: "store" | "owner" | "deleted" }

const unstored = { ok: false, refusal: "store" } as const

async function indexed(db: Sql, deck: DeckId, email: string, start: StartDeck): Promise<boolean> {
  for (const raw of start.pages) {
    const page = readDeckIndex({ deck, ...raw })
    if (!page.ok || !(await indexSaved(db, page, email)).ok) return false
  }
  return true
}

export async function createDeck(
  db: Sql,
  store: OriginalStore | undefined,
  email: string,
  asked: { readonly once: string | undefined; readonly name: string },
): Promise<Created> {
  const id = readDeckId(
    asked.once === undefined ? randomUUID().replaceAll("-", "") : digest(`${email}\n${asked.once}`).slice(0, 32),
  )
  if (store === undefined || !id.ok) return unstored
  const start = await startDeck(blankTemplate)
  const key = `originals/${digest(email)}/${id.deck}/start`
  await store.write(key, start.bytes)
  const opened = await openSaved(db, { deck: id.deck }, email)
  if (!opened.ok) {
    const { refusal } = opened
    return refusal === "owner" || refusal === "deleted" ? { ok: false, refusal } : unstored
  }
  await db.query(storeSql, [id.deck, email, key, start.bytes.length, start.sha256])
  if (!(await indexed(db, id.deck, email, start))) return unstored
  await db.query(nameSql, [id.deck, email, asked.name])
  const made = await db.query<{ name: string; original_stored: boolean }>(madeSql, [id.deck, email])
  const saved = await readSaved(db, id.deck)
  const access = saved === undefined ? undefined : deckAccess(saved, email)
  const row = made.rows[0]
  if (access?.ok !== true || row?.original_stored !== true) return unstored
  return {
    ok: true,
    created: { deck: id.deck, name: row.name },
    deck: { id: id.deck, revision: access.saved.revision, register: access.saved.register },
    storedIndex: access.saved.storedIndex,
  }
}

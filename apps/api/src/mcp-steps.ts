import { randomBytes } from "node:crypto"

import { readDeckId, readDeckIndex, type AgentOp, type DeckId } from "@airdesign/catalog"
import { elementId, foldSlides, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { agentCaller, callTool, dropGoneTurn, emptyLog, settleTurn, type Session, type ToolResult } from "@airdesign/mcp"

import { storedTurns, type StoredTurns } from "./agent-turn.js"
import { indexSaved } from "./index-saved.js"
import { commitEdit } from "./mcp.js"
import type { Sql } from "./pool.js"
import { deckAccess, openSaved, readSaved } from "./saved.js"

export const stepNode = elementId("256.2")

export type Stores = { readonly deck: Sql; readonly session: Sql }

export type Owned = { readonly stores: Stores; readonly deck: DeckId; readonly email: string }

export type Request = {
  readonly turns: StoredTurns
  readonly session: Session
  loaded: Deck
  seen: ReturnType<StoredTurns["read"]>
  result: ToolResult | undefined
  op: AgentOp
  pc: "turn" | "deck" | "settle" | "idle"
}

export function request(owned: Owned, runId: string): Request {
  const turns = storedTurns(owned.stores.session, owned.email)
  const session: Session = {
    caller: agentCaller(runId),
    deck: openDeck(owned.deck),
    log: emptyLog(),
    now: 1_000_000,
    turns,
  }
  return { turns, session, loaded: session.deck, seen: undefined, result: undefined, op: "read_deck", pc: "turn" }
}

export async function loadTurn(owned: Owned, req: Request): Promise<void> {
  await req.turns.load(owned.deck)
  req.seen = req.turns.read(owned.deck)
  req.pc = "turn"
}

export async function loadDeck(owned: Owned, req: Request): Promise<void> {
  const saved = await readSaved(owned.stores.deck, owned.deck)
  if (saved === undefined) throw new Error("deck")
  const access = deckAccess(saved, owned.email)
  if (!access.ok) throw new Error(access.refusal)
  req.loaded = { id: owned.deck, revision: access.saved.revision, register: access.saved.register }
  req.session.deck = req.loaded
  dropGoneTurn(req.session, req.seen)
  req.pc = "deck"
}

export async function decide(
  owned: Owned,
  req: Request,
  op: AgentOp,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  req.op = op
  const settled = await commitEdit(owned.stores.deck, req.loaded, callTool(`airdesign_${op}`, args, req.session))
  if (settled.ok) req.session.deck = settled.deck
  req.result = settled
  req.pc = "settle"
  return settled
}

export async function settle(req: Request): Promise<void> {
  if (req.result === undefined) throw new Error("settle")
  settleTurn(req.op, req.result, req.session)
  await req.turns.saved()
  req.pc = "idle"
}

export async function wholeCall(
  owned: Owned,
  runId: string,
  op: AgentOp,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const req = request(owned, runId)
  await loadTurn(owned, req)
  await loadDeck(owned, req)
  const result = await decide(owned, req, op, args)
  await settle(req)
  return result
}

export async function indexedDeck(stores: Stores, name: string): Promise<Owned & { readonly revision: number }> {
  const parsed = readDeckId(`${name}-${randomBytes(6).toString("hex")}`)
  if (!parsed.ok) throw new Error(parsed.refusal)
  const email = `${name}-${randomBytes(6).toString("hex")}@example.com`
  await stores.session.query("insert into session.account (email) values ($1)", [email])
  const made = await openSaved(stores.deck, parsed, email)
  if (!made.ok) throw new Error(made.refusal)
  const page = readDeckIndex({
    deck: parsed.deck,
    once: "index",
    offset: 0,
    total: 1,
    slides: [
      { id: "256", position: 0, layout: [] },
      { id: "257", position: 1, layout: [] },
    ],
    elements: [{ node: stepNode, kind: "shape", value: "Title", box: null, grouped: false }],
  })
  if (!page.ok) throw new Error(page.refusal)
  const indexed = await indexSaved(stores.deck, page, email)
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { stores, deck: parsed.deck, email, revision: indexed.revision }
}

export async function turnRow(owned: Owned) {
  const found = await owned.stores.session.query<{ run_id: string | null; revision: number }>(
    "select run_id, revision from session.agent_turn where email = $1 and deck = $2",
    [owned.email, owned.deck],
  )
  return found.rows[0]
}

export function slidesAddedBy(register: Register, runId: string): readonly string[] {
  const added = new Set(register.order.flatMap((row) => (row.runId === runId && row.slide === "add" ? [row.id] : [])))
  const file = register.file.length > 0 ? register.file : (register.index?.slides.map((slide) => slide.id) ?? [])
  return foldSlides({ file: file as Register["file"], order: register.order })
    .filter((slide) => slide.present && added.has(slide.id))
    .map((slide) => slide.id)
}

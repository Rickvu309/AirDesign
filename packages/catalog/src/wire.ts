import { bytesOf, elementPattern, limits, readElementId, type ElementId } from "@airdesign/document"
import * as z from "zod/v4"

import { storableText, unstorable } from "./storable-text.js"

declare const deckIdBrand: unique symbol

export type DeckId = string & { readonly [deckIdBrand]: true }

export type WireEdit = {
  readonly value: string
  readonly node: ElementId
  readonly floor?: string
  readonly readAt?: never
  readonly actor?: never
  readonly command?: never
  readonly principal?: never
  readonly person?: never
  readonly agent?: never
  readonly surface?: never
  readonly onBehalfOf?: never
}

export type WireChange = {
  readonly value: string
  readonly node: ElementId
  readonly readAt: number
  readonly floor?: string
  readonly actor?: never
  readonly command?: never
  readonly principal?: never
  readonly person?: never
  readonly agent?: never
  readonly surface?: never
  readonly onBehalfOf?: never
}

export type WireRunElement = {
  readonly node: ElementId
  readonly floor?: string
}

export type LiveKey = {
  readonly deck: DeckId
  readonly revision: number
}

const deckPattern = /^[A-Za-z0-9_-]{1,64}$/
const revisionPattern = /^(?:0|[1-9][0-9]*)$/
const redirectCap = 5
const emailCap = 254
const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const codePattern = /^\d{6}$/
const bearerPattern = /^Bearer ([A-Za-z0-9._~+/=-]+)$/i
const challengePattern = /^[A-Za-z0-9_-]{43}$/
const formType = "application/x-www-form-urlencoded"
const hostPattern = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::([0-9]{1,5}))?$/
const portCap = 65_535

export const sessionCookieName = "airdesign.session"

type FieldRefusal = { ok: false; refusal: "field" }
type DeckRefusal = { ok: false; refusal: "deck" }
type BatchRefusal = { ok: false; refusal: "batch" }
type CursorRefusal = { ok: false; refusal: "cursor" }
type BaseRefusal = { ok: false; refusal: "base" }
type PayloadRefusal = { ok: false; refusal: "payload" }
type ResourceRefusal = { ok: false; refusal: "resource" }
type ChallengeRefusal = { ok: false; refusal: "challenge" }
type FormRefusal = { ok: false; refusal: "invalid_request" }
type GrantRefusal = { ok: false; refusal: "unsupported_grant_type" }

const fieldRefusal: FieldRefusal = { ok: false, refusal: "field" }
const deckRefusal: DeckRefusal = { ok: false, refusal: "deck" }
const batchRefusal: BatchRefusal = { ok: false, refusal: "batch" }
const cursorRefusal: CursorRefusal = { ok: false, refusal: "cursor" }
const baseRefusal: BaseRefusal = { ok: false, refusal: "base" }
const payloadRefusal: PayloadRefusal = { ok: false, refusal: "payload" }
const resourceRefusal: ResourceRefusal = { ok: false, refusal: "resource" }
const challengeRefusal: ChallengeRefusal = { ok: false, refusal: "challenge" }
const formRefusal: FormRefusal = { ok: false, refusal: "invalid_request" }
const grantRefusal: GrantRefusal = { ok: false, refusal: "unsupported_grant_type" }

function recordOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function knownKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const key of Object.keys(body)) {
    if (!keys.includes(key)) return false
  }
  return true
}

function whole(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) return undefined
  return raw
}

function readFloor(body: Record<string, unknown>): string | undefined | null {
  if (!Object.hasOwn(body, "floor")) return undefined
  if (!storableText(body.floor)) return null
  return body.floor
}

export function readDeckId(raw: unknown): { ok: true; deck: DeckId } | DeckRefusal {
  if (typeof raw !== "string" || !deckPattern.test(raw)) return deckRefusal
  return { ok: true, deck: raw as DeckId }
}

export function readEdit(raw: unknown): { ok: true; edit: WireEdit } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["value", "node", "floor"]) || !storableText(body.value)) {
    return fieldRefusal
  }
  const node = readElementId(body.node)
  if (node === undefined) return fieldRefusal
  const floor = readFloor(body)
  if (floor === null) return fieldRefusal
  if (floor === undefined) return { ok: true, edit: { value: body.value, node } }
  return { ok: true, edit: { value: body.value, node, floor } }
}

function readEditBatch(raw: unknown): { ok: true; edits: readonly WireEdit[] } | FieldRefusal | BatchRefusal {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > limits.batch) return batchRefusal
  const edits: WireEdit[] = []
  for (const item of raw) {
    const edit = readEdit(item)
    if (!edit.ok) return fieldRefusal
    edits.push(edit.edit)
  }
  return { ok: true, edits }
}

export function readCommit(
  raw: unknown,
): { ok: true; deck: DeckId; batch: readonly WireEdit[]; once?: string } | FieldRefusal | DeckRefusal | BatchRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "batch", "once"]) || !Object.hasOwn(body, "deck")) {
    return fieldRefusal
  }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (!Object.hasOwn(body, "batch")) return batchRefusal
  const batch = readEditBatch(body.batch)
  if (!batch.ok) return batch
  if (!Object.hasOwn(body, "once")) return { ok: true, deck: deck.deck, batch: batch.edits }
  if (typeof body.once !== "string" || !deckPattern.test(body.once)) return fieldRefusal
  return { ok: true, deck: deck.deck, batch: batch.edits, once: body.once }
}

export function readWatch(
  raw: unknown,
): { ok: true; deck: DeckId; cursor: number | null } | FieldRefusal | DeckRefusal | CursorRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "cursor"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  if (!Object.hasOwn(body, "cursor")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (body.cursor === null) return { ok: true, deck: deck.deck, cursor: null }
  const cursor = whole(body.cursor)
  if (cursor === undefined) return cursorRefusal
  return { ok: true, deck: deck.deck, cursor }
}

const deckInput = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Deck id.")
const wholeInput = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const textInput = z.string().regex(new RegExp(`^(?![\\s\\S]*(?:${unstorable.source}))[\\s\\S]*$`))
const changeInput = z.strictObject({
  value: textInput.describe(
    "Text to write. For an element whose file text is a JSON text value, send a JSON text value: [{from, runs: [{from, text}]}]. Each from is an index the file has, and a run from of -1 is a new run.",
  ),
  node: z
    .string()
    .regex(elementPattern)
    .transform((value) => value as ElementId)
    .describe("Element id, <slide>.<shape>, such as 258.7."),
  readAt: wholeInput.describe(
    "Version of that element from your last read. Every answer carries each named element's value and version. 0 for an element nobody has changed.",
  ),
  floor: textInput.exactOptional(),
})

export type WireReader = ((raw: unknown) => { readonly ok: boolean }) & {
  readonly input: z.ZodType
}

function readInput<Shape extends z.ZodRawShape, Refusal extends { ok: false; refusal: string }>(
  input: z.ZodObject<Shape>,
  refuse: (issues: readonly z.core.$ZodIssue[], raw: unknown) => Refusal,
) {
  return Object.assign(
    (raw: unknown) => {
      const parsed = input.safeParse(raw)
      if (!parsed.success) return refuse(parsed.error.issues, raw)
      return { ok: true as const, ...parsed.data }
    },
    { input },
  )
}

function inputRefusal(issues: readonly z.core.$ZodIssue[], raw: unknown): FieldRefusal | DeckRefusal {
  if (issues.some((issue) => issue.path.length === 0)) return fieldRefusal
  const deck = issues.find((issue) => issue.path[0] === "deck")
  if (deck === undefined) return fieldRefusal
  const body = recordOf(raw)
  if (body === undefined || !Object.hasOwn(body, "deck")) return fieldRefusal
  return deckRefusal
}

export const readAgentEdit = readInput(
  z.strictObject({
    deck: deckInput,
    base: wholeInput.describe("Revision the edit was read from."),
    changes: z.array(changeInput).min(1).max(limits.batch).describe("Edits to land."),
  }),
  (issues, raw): FieldRefusal | DeckRefusal | BaseRefusal | BatchRefusal => {
    if (issues.some((issue) => issue.path.length === 0 || issue.path[0] === "deck")) return inputRefusal(issues, raw)
    if (issues.some((issue) => issue.path[0] === "base")) return baseRefusal
    if (issues.some((issue) => issue.path.length === 1 && issue.path[0] === "changes")) return batchRefusal
    return fieldRefusal
  },
)

function readRunId(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !deckPattern.test(raw)) return undefined
  return raw
}

function readRunElement(raw: unknown): { ok: true; element: WireRunElement } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["node", "floor"])) return fieldRefusal
  const node = readElementId(body.node)
  if (node === undefined) return fieldRefusal
  const floor = readFloor(body)
  if (floor === null) return fieldRefusal
  if (floor === undefined) return { ok: true, element: { node } }
  return { ok: true, element: { node, floor } }
}

function readRunElementBatch(
  raw: unknown,
): { ok: true; elements: readonly WireRunElement[] } | FieldRefusal | BatchRefusal {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > limits.batch) return batchRefusal
  const elements: WireRunElement[] = []
  for (const item of raw) {
    const element = readRunElement(item)
    if (!element.ok) return fieldRefusal
    elements.push(element.element)
  }
  return { ok: true, elements }
}

export function readRunStart(
  raw: unknown,
):
  | { ok: true; deck: DeckId; runId: string; elements: readonly WireRunElement[] }
  | FieldRefusal
  | DeckRefusal
  | BatchRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "runId", "elements"]) || !Object.hasOwn(body, "deck")) {
    return fieldRefusal
  }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  const runId = readRunId(body.runId)
  if (runId === undefined) return fieldRefusal
  if (!Object.hasOwn(body, "elements")) return batchRefusal
  const elements = readRunElementBatch(body.elements)
  if (!elements.ok) return elements
  return { ok: true, deck: deck.deck, runId, elements: elements.elements }
}

export const readRun = readInput(
  z.strictObject({
    deck: deckInput,
    runId: z.string().regex(deckPattern).describe("The runId your edit answers carried."),
  }),
  inputRefusal,
)

export const readCapture = readInput(z.strictObject({ deck: deckInput }), inputRefusal)

export function readNamedDeck(raw: unknown): { ok: true; deck: DeckId } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !Object.hasOwn(body, "deck")) return fieldRefusal
  return readCapture({ deck: body.deck })
}

export function readOriginalUpload(
  raw: unknown,
): { ok: true; deck: DeckId; bytes: number; sha256: string } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "bytes", "sha256"]) || !Object.hasOwn(body, "deck"))
    return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  const bytes = whole(body.bytes)
  if (bytes === undefined || typeof body.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(body.sha256))
    return fieldRefusal
  return { ok: true, deck: deck.deck, bytes, sha256: body.sha256.toLowerCase() }
}

export function readNoFields(raw: unknown): { ok: true } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || Object.keys(body).length > 0) return fieldRefusal
  return { ok: true }
}

function readDeckName(raw: unknown): string | undefined {
  if (!storableText(raw)) return undefined
  const name = raw.trim()
  const size = [...name].length
  if (size < 1 || size > limits.name) return undefined
  return name
}

export function readRename(raw: unknown): { ok: true; deck: DeckId; name: string } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "name"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  const name = readDeckName(body.name)
  if (name === undefined) return fieldRefusal
  return { ok: true, deck: deck.deck, name }
}

export function readDecks(raw: unknown): { ok: true; decks: readonly DeckId[] } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["decks"]) || !Array.isArray(body.decks)) return fieldRefusal
  const ids: unknown[] = body.decks
  if (ids.length < 1 || ids.length > limits.delete) return fieldRefusal
  const decks: DeckId[] = []
  for (const id of ids) {
    const deck = readDeckId(id)
    if (!deck.ok) return deckRefusal
    if (!decks.includes(deck.deck)) decks.push(deck.deck)
  }
  return { ok: true, decks }
}

function exactKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  const present = Object.keys(body)
  return present.length === keys.length && keys.every((key) => present.includes(key))
}

function readAddress(raw: unknown): string | undefined {
  if (!storableText(raw)) return undefined
  const email = raw.trim().toLowerCase()
  if (email.length === 0 || email.length > emailCap || !emailPattern.test(email)) return undefined
  return email
}

export function readEmail(raw: unknown): { ok: true; email: string } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !exactKeys(body, ["email"])) return fieldRefusal
  const email = readAddress(body.email)
  if (email === undefined) return fieldRefusal
  return { ok: true, email }
}

export function readCode(raw: unknown): { ok: true; email: string; code: string } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !exactKeys(body, ["email", "code"])) return fieldRefusal
  const email = readAddress(body.email)
  if (email === undefined || typeof body.code !== "string" || !codePattern.test(body.code)) return fieldRefusal
  return { ok: true, email, code: body.code }
}

function decodedCookie(raw: string): string | undefined {
  try {
    const token = decodeURIComponent(raw)
    return token.length > 0 && storableText(token) ? token : undefined
  } catch {
    return undefined
  }
}

export function readSessionCookie(header: unknown): string | undefined {
  if (typeof header !== "string") return undefined
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const split = trimmed.indexOf("=")
    if (split <= 0) continue
    if (trimmed.slice(0, split) !== sessionCookieName) continue
    return decodedCookie(trimmed.slice(split + 1))
  }
  return undefined
}

export function readBearer(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  return bearerPattern.exec(raw)?.[1]
}

export function readHost(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const matched = hostPattern.exec(raw)
  if (matched === null || Number(matched[1] ?? 0) > portCap) return undefined
  return raw
}

export function readLinkToken(raw: unknown): string | undefined {
  if (!storableText(raw) || raw.length === 0) return undefined
  return raw
}

function readClientAddress(raw: unknown): raw is string {
  return storableText(raw) && raw.length <= limits.address && !raw.includes("#")
}

export function readClientMetadata(
  raw: unknown,
): { ok: true; redirectUris: readonly string[]; name: string | null } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined) return fieldRefusal
  const uris: unknown = body.redirect_uris
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > redirectCap) return fieldRefusal
  if (!uris.every(readClientAddress)) return fieldRefusal
  const name = body.client_name
  if (name === undefined) return { ok: true, redirectUris: uris, name: null }
  if (!storableText(name) || name.length > limits.clientName) return fieldRefusal
  return { ok: true, redirectUris: uris, name }
}

type ClientRequest = {
  readonly clientId: string
  readonly redirectUri: string
  readonly resource: string | undefined
}

function readClientFields(
  body: Record<string, unknown>,
): ({ ok: true } & ClientRequest) | FieldRefusal | ResourceRefusal {
  const { client_id: clientId, redirect_uri: redirectUri, resource } = body
  if (!storableText(clientId) || !storableText(redirectUri)) return fieldRefusal
  if (resource === undefined) return { ok: true, clientId, redirectUri, resource }
  if (typeof resource !== "string") return resourceRefusal
  if (!storableText(resource)) return fieldRefusal
  return { ok: true, clientId, redirectUri, resource }
}

export function readClientRequest(raw: unknown): ({ ok: true } & ClientRequest) | FieldRefusal | ResourceRefusal {
  const body = recordOf(raw)
  if (body === undefined) return fieldRefusal
  return readClientFields(body)
}

export function readApprovalRequest(
  raw: unknown,
):
  | ({ ok: true; challenge: string; state: string | undefined } & ClientRequest)
  | FieldRefusal
  | ResourceRefusal
  | ChallengeRefusal {
  const body = recordOf(raw)
  if (body === undefined) return fieldRefusal
  const client = readClientFields(body)
  if (!client.ok) return client
  const { code_challenge: challenge, code_challenge_method: method, state } = body
  if (method !== "S256" || typeof challenge !== "string" || !challengePattern.test(challenge)) return challengeRefusal
  if (state !== undefined && !storableText(state)) return fieldRefusal
  return { ...client, challenge, state }
}

export type FormPairs = Iterable<readonly [string, string]>

function readForm(contentType: unknown, pairs: FormPairs): Map<string, string> | undefined {
  if (typeof contentType !== "string" || contentType.split(";")[0]?.trim().toLowerCase() !== formType) return undefined
  const fields = new Map<string, string>()
  for (const [name, value] of pairs) {
    if (fields.has(name) || !storableText(name) || !storableText(value)) return undefined
    fields.set(name, value)
  }
  return fields
}

export type TokenRequest =
  | {
      readonly ok: true
      readonly grant: "authorization_code"
      readonly code: string
      readonly verifier: string
      readonly clientId: string
      readonly redirectUri: string
      readonly resource: string | undefined
    }
  | {
      readonly ok: true
      readonly grant: "refresh_token"
      readonly secret: string
      readonly clientId: string
      readonly resource: string | undefined
    }

export function readTokenRequest(contentType: unknown, pairs: FormPairs): TokenRequest | FormRefusal | GrantRefusal {
  const form = readForm(contentType, pairs)
  const grant = form?.get("grant_type")
  if (form === undefined || grant === undefined) return formRefusal
  const clientId = form.get("client_id")
  const resource = form.get("resource")
  if (grant === "authorization_code") {
    const code = form.get("code")
    const verifier = form.get("code_verifier")
    const redirectUri = form.get("redirect_uri")
    if (code === undefined || verifier === undefined || clientId === undefined || redirectUri === undefined) {
      return formRefusal
    }
    return { ok: true, grant, code, verifier, clientId, redirectUri, resource }
  }
  if (grant === "refresh_token") {
    const secret = form.get("refresh_token")
    if (secret === undefined || clientId === undefined) return formRefusal
    return { ok: true, grant, secret, clientId, resource }
  }
  return grantRefusal
}

export function readRevokeRequest(
  contentType: unknown,
  pairs: FormPairs,
): { ok: true; token: string | undefined } | FormRefusal {
  const form = readForm(contentType, pairs)
  if (form === undefined) return formRefusal
  return { ok: true, token: form.get("token") }
}

export function notifyKey(deck: string, revision: number): { ok: true; key: string } | PayloadRefusal {
  if (whole(revision) === undefined) return payloadRefusal
  const key = `${deck}:${String(revision)}`
  if (bytesOf(key) >= limits.notify) return payloadRefusal
  return { ok: true, key }
}

export function parseNotifyKey(key: string): ({ ok: true } & LiveKey) | PayloadRefusal {
  if (bytesOf(key) >= limits.notify) return payloadRefusal
  const split = key.indexOf(":")
  if (split <= 0 || key.lastIndexOf(":") !== split) return payloadRefusal
  const deckText = key.slice(0, split)
  const revisionText = key.slice(split + 1)
  const deck = readDeckId(deckText)
  if (!deck.ok || !revisionPattern.test(revisionText)) return payloadRefusal
  const revision = Number(revisionText)
  if (!Number.isSafeInteger(revision) || revision < 0) return payloadRefusal
  return { ok: true, deck: deck.deck, revision }
}

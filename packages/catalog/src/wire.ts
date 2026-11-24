import { limits } from "@airdesign/doom"
import * as z from "zod/v4"

import { storableText } from "./storable-text.js"

declare const deckIdBrand: unique symbol

export type DeckId = string & { readonly [deckIdBrand]: true }

export const deckPattern = /^[A-Za-z0-9_-]{1,64}$/
const redirectCap = 5
const emailCap = 254
const grantIdCap = 128
const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
const codePattern = /^\d{6}$/
const bearerPattern = /^Bearer ([A-Za-z0-9._~+/=-]+)$/i
const challengePattern = /^[A-Za-z0-9_-]{43}$/
const formType = "application/x-www-form-urlencoded"
const hostPattern = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::([0-9]{1,5}))?$/
const portCap = 65_535

export const sessionCookieName = "airdesign.session"
export const accountCookieName = "airdesign.account"
const accountKeyPattern = /^[0-9a-f]{32}$/

export type FieldDetail = {
  readonly field: string
  readonly fault: "missing" | "unknown" | "form"
  readonly form?: string
}
export type FieldRefusal = { readonly ok: false; readonly refusal: "field" } & Partial<FieldDetail>
export type DeckRefusal = { ok: false; refusal: "deck" }
export type BatchRefusal = { readonly ok: false; readonly refusal: "batch" } & Partial<FieldDetail>
export type BaseRefusal = { ok: false; refusal: "base" }
type ResourceRefusal = { ok: false; refusal: "resource" }
type ChallengeRefusal = { ok: false; refusal: "challenge" }
type FormRefusal = { ok: false; refusal: "invalid_request" }
type GrantRefusal = { ok: false; refusal: "unsupported_grant_type" }

export const fieldRefusal: FieldRefusal = { ok: false, refusal: "field" }
const deckRefusal: DeckRefusal = { ok: false, refusal: "deck" }
export const baseRefusal: BaseRefusal = { ok: false, refusal: "base" }
const resourceRefusal: ResourceRefusal = { ok: false, refusal: "resource" }
const challengeRefusal: ChallengeRefusal = { ok: false, refusal: "challenge" }
const formRefusal: FormRefusal = { ok: false, refusal: "invalid_request" }
const grantRefusal: GrantRefusal = { ok: false, refusal: "unsupported_grant_type" }

export function recordOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

export function knownKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const key of Object.keys(body)) {
    if (!keys.includes(key)) return false
  }
  return true
}

function whole(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) return undefined
  return raw
}

export function readDeckId(raw: unknown): { ok: true; deck: DeckId } | DeckRefusal {
  if (typeof raw !== "string" || !deckPattern.test(raw)) return deckRefusal
  return { ok: true, deck: raw as DeckId }
}

export const deckInput = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Deck id.")
export const wholeInput = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export type WireReader = ((raw: unknown) => { readonly ok: boolean }) & {
  readonly input: z.ZodType
}

export function readInput<Shape extends z.ZodRawShape, Refusal extends { ok: false; refusal: string }>(
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

export function inputRefusal(issues: readonly z.core.$ZodIssue[], raw: unknown): FieldRefusal | DeckRefusal {
  if (issues.some((issue) => issue.path.length === 0)) return fieldRefusal
  const deck = issues.find((issue) => issue.path[0] === "deck")
  if (deck === undefined) return fieldRefusal
  const body = recordOf(raw)
  if (body === undefined || !Object.hasOwn(body, "deck")) return fieldRefusal
  return deckRefusal
}

export const readRun = readInput(
  z.strictObject({
    deck: deckInput,
    runId: z.string().regex(deckPattern).describe("The runId your edit answers carried."),
  }),
  inputRefusal,
)

export const readCapture = readInput(z.strictObject({ deck: deckInput }), inputRefusal)

const deckForm = "1 to 64 of letters, digits, _ or -."

export function readNamedDeck(raw: unknown): { ok: true; deck: DeckId } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !Object.hasOwn(body, "deck"))
    return { ok: false, refusal: "field", field: "deck", fault: "missing", form: deckForm }
  return readCapture({ deck: body.deck })
}

export function readMediaUpload(
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

export function readMediaRequest(
  raw: unknown,
): { ok: true; deck: DeckId; sha256: string } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "sha256"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (typeof body.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(body.sha256)) return fieldRefusal
  return { ok: true, deck: deck.deck, sha256: body.sha256.toLowerCase() }
}

export function readNoFields(raw: unknown): { ok: true } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || Object.keys(body).length > 0) return fieldRefusal
  return { ok: true }
}

export function readStar(raw: unknown): { ok: true; deck: DeckId; starred: boolean } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "starred"]) || typeof body.starred !== "boolean") {
    return fieldRefusal
  }
  if (!Object.hasOwn(body, "deck")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  return { ok: true, deck: deck.deck, starred: body.starred }
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

export function readGrantId(raw: unknown): { ok: true; id: string } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !exactKeys(body, ["id"])) return fieldRefusal
  const id = body.id
  if (!storableText(id) || id.length === 0 || id.length > grantIdCap) return fieldRefusal
  return { ok: true, id }
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

function readCookie(header: unknown, name: string): string | undefined {
  if (typeof header !== "string") return undefined
  for (const part of header.split(";")) {
    const trimmed = part.trim()
    const split = trimmed.indexOf("=")
    if (split <= 0) continue
    if (trimmed.slice(0, split) !== name) continue
    return decodedCookie(trimmed.slice(split + 1))
  }
  return undefined
}

export function readSessionCookie(header: unknown): string | undefined {
  return readCookie(header, sessionCookieName)
}

export function readAccountCookie(header: unknown): string | undefined {
  const key = readCookie(header, accountCookieName)
  return key !== undefined && accountKeyPattern.test(key) ? key : undefined
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

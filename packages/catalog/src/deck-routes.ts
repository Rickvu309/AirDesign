import { foldRegister, type Refusal, type Register, type StoredRegister } from "@airdesign/document"
import {
  readCapture,
  readCommit,
  readDecks,
  readNoFields,
  readOriginalUpload,
  readRename,
  readWatch,
  type DeckId,
} from "./wire.js"
import { isRegister } from "./register-answer.js"

type Refused<Result> = Result extends { ok: false; refusal: infer Code } ? Code : never

export type CallRefusal = Refusal | Refused<ReturnType<typeof readCommit>> | "base" | "payload"

export type EditRefusal = CallRefusal | "text-from" | "owner" | "deleted" | "store"

export type WireRefusal =
  | EditRefusal
  | "cursor"
  | "session"
  | "storage"
  | "missing"
  | "size"
  | "server"
  | "code"
  | "device"
  | "no-open-tab"
  | "tab-hidden"
  | "tab-timeout"
  | "tab-outdated"

const wireRefusals = {
  stale: true,
  "person-protected": true,
  "run-fenced": true,
  dead: true,
  present: true,
  limit: true,
  field: true,
  deck: true,
  batch: true,
  base: true,
  payload: true,
  cursor: true,
  session: true,
  owner: true,
  deleted: true,
  storage: true,
  missing: true,
  size: true,
  server: true,
  code: true,
  store: true,
  "text-from": true,
  device: true,
  "no-open-tab": true,
  "tab-hidden": true,
  "tab-timeout": true,
  "tab-outdated": true,
} satisfies Record<WireRefusal, true>

export type WireFailure = { readonly ok: false; readonly refusal: WireRefusal }
export type WireResult<Value> = ({ readonly ok: true } & Value) | WireFailure
export type RevisionAnswer = { readonly deck: DeckId; readonly revision: number }
export type OpenResult = WireResult<RevisionAnswer & { readonly register: Register }>
export type CommitResult = WireResult<RevisionAnswer & { readonly key: string }>
export type WatchResult = WireResult<RevisionAnswer>

function recordAnswer(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

function wholeAnswer(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
}

function revisionAnswer(raw: unknown): raw is RevisionAnswer & Record<string, unknown> {
  return recordAnswer(raw) && readCapture({ deck: raw.deck }).ok && wholeAnswer(raw.revision)
}

function decode<Value>(isValue: (raw: unknown) => raw is Value): (raw: unknown) => WireResult<Value> {
  return (raw) => {
    if (recordAnswer(raw)) {
      if (raw.ok === false && typeof raw.refusal === "string" && isWireRefusal(raw.refusal)) {
        return { ok: false, refusal: raw.refusal }
      }
      if (raw.ok === true && isValue(raw)) return { ...raw, ok: true }
    }
    return { ok: false, refusal: "payload" }
  }
}

function isWireRefusal(raw: string): raw is WireRefusal {
  return Object.hasOwn(wireRefusals, raw)
}

function openAnswer(raw: unknown): raw is RevisionAnswer & { readonly register: StoredRegister } {
  return revisionAnswer(raw) && isRegister(raw.register)
}

function decodeOpen(raw: unknown): OpenResult {
  const result = decode(openAnswer)(raw)
  return result.ok ? { ...result, register: foldRegister(result.register) } : result
}

function commitAnswer(raw: unknown): raw is RevisionAnswer & { readonly key: string } {
  return revisionAnswer(raw) && raw.key === `${raw.deck}:${raw.revision}`
}

type Listed = { readonly deck: DeckId; readonly name: string; readonly edited: string; readonly created: string }
type ListedTrash = Listed & { readonly trashed: string }

function listed(raw: unknown): raw is Listed & Record<string, unknown> {
  return (
    recordAnswer(raw) &&
    readCapture({ deck: raw.deck }).ok &&
    typeof raw.name === "string" &&
    typeof raw.edited === "string" &&
    typeof raw.created === "string"
  )
}

function listedTrash(raw: unknown): raw is ListedTrash {
  return listed(raw) && typeof raw.trashed === "string"
}

function listAnswer(raw: unknown): raw is {
  readonly account: { readonly email: string }
  readonly decks: Listed[]
  readonly trash: ListedTrash[]
} {
  return (
    recordAnswer(raw) &&
    recordAnswer(raw.account) &&
    typeof raw.account.email === "string" &&
    Array.isArray(raw.decks) &&
    raw.decks.every(listed) &&
    Array.isArray(raw.trash) &&
    raw.trash.every(listedTrash)
  )
}

function deckAnswer(raw: unknown): raw is { readonly deck: DeckId } & Record<string, unknown> {
  return recordAnswer(raw) && readCapture({ deck: raw.deck }).ok
}

function renameAnswer(raw: unknown): raw is { readonly deck: DeckId; readonly name: string } {
  return deckAnswer(raw) && typeof raw.name === "string"
}

function trashAnswer(raw: unknown): raw is { readonly deck: DeckId; readonly trashed: string } {
  return deckAnswer(raw) && typeof raw.trashed === "string"
}

function deleteAnswer(raw: unknown): raw is { readonly deleted: string[] } {
  return (
    recordAnswer(raw) && Array.isArray(raw.deleted) && raw.deleted.every((id: unknown) => readCapture({ deck: id }).ok)
  )
}

type Signed = { readonly url: string; readonly expires: string }

function signedAnswer(raw: unknown): raw is Signed & Record<string, unknown> {
  return recordAnswer(raw) && typeof raw.url === "string" && typeof raw.expires === "string"
}

function uploadAnswer(raw: unknown): raw is Signed & { readonly headers: Readonly<Record<string, string>> } {
  return (
    signedAnswer(raw) &&
    recordAnswer(raw.headers) &&
    Object.values(raw.headers).every((value) => typeof value === "string")
  )
}

function originalAnswer(raw: unknown): raw is Signed & { readonly bytes: number; readonly sha256: string } {
  return (
    signedAnswer(raw) &&
    wholeAnswer(raw.bytes) &&
    typeof raw.sha256 === "string" &&
    /^[0-9a-fA-F]{64}$/.test(raw.sha256)
  )
}

export const deckRoutes = {
  open: { path: "/decks/open", read: readCapture, result: decodeOpen },
  commit: { path: "/decks/commit", read: readCommit, result: decode(commitAnswer) },
  watch: { path: "/decks/watch", read: readWatch, result: decode(revisionAnswer) },
  list: { path: "/decks/list", read: readNoFields, result: decode(listAnswer) },
  rename: { path: "/decks/rename", read: readRename, result: decode(renameAnswer) },
  trash: { path: "/decks/trash", read: readCapture, result: decode(trashAnswer) },
  restore: { path: "/decks/restore", read: readCapture, result: decode(deckAnswer) },
  delete: { path: "/decks/delete", read: readDecks, result: decode(deleteAnswer) },
  originalUpload: { path: "/decks/original/upload", read: readOriginalUpload, result: decode(uploadAnswer) },
  originalDone: { path: "/decks/original/done", read: readCapture, result: decode(recordAnswer) },
  original: { path: "/decks/original", read: readCapture, result: decode(originalAnswer) },
} as const

export const signInRoutes = {
  email: { path: "/sign-in/email", method: "POST" },
  code: { path: "/sign-in/code", method: "POST" },
  link: { path: "/sign-in/link", method: "GET" },
} as const

export const oauthRoutes = {
  client: { path: "/oauth/client", method: "POST" },
  approve: { path: "/oauth/approve", method: "POST" },
} as const

export const signInPaths: readonly string[] = Object.values(signInRoutes).map((route) => route.path)
export const deckPaths: readonly string[] = Object.values(deckRoutes).map((route) => route.path)
export const oauthPaths: readonly string[] = Object.values(oauthRoutes).map((route) => route.path)

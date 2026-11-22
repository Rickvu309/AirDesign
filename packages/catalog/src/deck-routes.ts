import { creditsRoutes } from "./credits-routes.js"
import { unreachable } from "@airdesign/device"
import { readRegister, readSlideId, refusals, type Register, type SlideId } from "@airdesign/document"
import { readCommit } from "./edit-wire.js"
import { readFindingsReport } from "./findings-wire.js"
import { readDeckIndex } from "./index-wire.js"
import {
  readCapture,
  readDecks,
  readNoFields,
  readMediaRequest,
  readOriginalUpload,
  readRename,
  readRun,
  readStar,
  readWatch,
  type DeckId,
} from "./wire.js"

const callRefusals = [
  ...refusals,
  "field",
  "deck",
  "batch",
  "base",
  "payload",
  "indexing",
  "kept",
  "site",
  "image",
] as const

const editRefusals = [...callRefusals, "text-from", "owner", "deleted", "store", "held"] as const

const wireRefusals = [
  ...editRefusals,
  "cursor",
  "session",
  "storage",
  "missing",
  "size",
  "server",
  "code",
  "device",
  "newer",
  ...unreachable,
] as const

export type CallRefusal = (typeof callRefusals)[number]

export type EditRefusal = (typeof editRefusals)[number]

export type WireRefusal = (typeof wireRefusals)[number]

const decodable: ReadonlySet<string> = new Set(wireRefusals)

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
  return decodable.has(raw)
}

function decodeOpen(raw: unknown): OpenResult {
  const result = decode(revisionAnswer)(raw)
  if (!result.ok) return result
  const read = readRegister(result.register)
  return read.ok ? { ...result, register: read.value } : read
}

function commitAnswer(raw: unknown): raw is RevisionAnswer & { readonly key: string } {
  return revisionAnswer(raw) && raw.key === `${raw.deck}:${raw.revision}`
}

type Listed = {
  readonly deck: DeckId
  readonly name: string
  readonly edited: string
  readonly created: string
  readonly starred?: boolean
  readonly doom?: { readonly rev: number }
}
type ListedTrash = Listed & { readonly trashed: string }

function listed(raw: unknown): raw is Listed & Record<string, unknown> {
  return (
    recordAnswer(raw) &&
    readCapture({ deck: raw.deck }).ok &&
    typeof raw.name === "string" &&
    typeof raw.edited === "string" &&
    typeof raw.created === "string" &&
    (raw.starred === undefined || typeof raw.starred === "boolean") &&
    (raw.doom === undefined || (recordAnswer(raw.doom) && wholeAnswer(raw.doom.rev)))
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

function findingsAnswer(raw: unknown): raw is { readonly deck: DeckId; readonly missing?: readonly SlideId[] } {
  if (!deckAnswer(raw)) return false
  const { missing } = raw
  return missing === undefined || (Array.isArray(missing) && missing.every((slide) => readSlideId(slide) !== undefined))
}

function renameAnswer(raw: unknown): raw is { readonly deck: DeckId; readonly name: string } {
  return deckAnswer(raw) && typeof raw.name === "string"
}

function starAnswer(raw: unknown): raw is { readonly deck: DeckId; readonly starred: boolean } {
  return deckAnswer(raw) && typeof raw.starred === "boolean"
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
  index: { path: "/decks/index", read: readDeckIndex, result: decode(revisionAnswer) },
  watch: { path: "/decks/watch", read: readWatch, result: decode(revisionAnswer) },
  list: { path: "/decks/list", read: readNoFields, result: decode(listAnswer) },
  rename: { path: "/decks/rename", read: readRename, result: decode(renameAnswer) },
  star: { path: "/decks/star", read: readStar, result: decode(starAnswer) },
  trash: { path: "/decks/trash", read: readCapture, result: decode(trashAnswer) },
  restore: { path: "/decks/restore", read: readCapture, result: decode(deckAnswer) },
  delete: { path: "/decks/delete", read: readDecks, result: decode(deleteAnswer) },
  originalUpload: { path: "/decks/original/upload", read: readOriginalUpload, result: decode(uploadAnswer) },
  originalDone: { path: "/decks/original/done", read: readCapture, result: decode(recordAnswer) },
  original: { path: "/decks/original", read: readCapture, result: decode(originalAnswer) },
  mediaUpload: { path: "/decks/media/upload", read: readOriginalUpload, result: decode(uploadAnswer) },
  media: { path: "/decks/media", read: readMediaRequest, result: decode(originalAnswer) },
  undo: { path: "/decks/undo", read: readRun, result: decode(commitAnswer) },
  findings: { path: "/decks/findings", read: readFindingsReport, result: decode(findingsAnswer) },
} as const

export const airaRoutes = {
  turn: { path: "/aira/turn", method: "POST" },
  usage: { path: "/aira/usage", method: "POST" },
  stop: { path: "/aira/stop", method: "POST" },
} as const

export const countryHeader = "visitor-country"
export const forwardSecretHeader = "forward-secret"

export const signInRoutes = {
  email: { path: "/sign-in/email", method: "POST" },
  code: { path: "/sign-in/code", method: "POST" },
  link: { path: "/sign-in/link", method: "GET" },
} as const

export const signOutRoutes = {
  session: { path: "/sign-out", method: "POST" },
} as const

export const accountRoutes = {
  profile: { path: "/account/profile", method: "POST" },
  name: { path: "/account/name", method: "POST" },
  delete: { path: "/account/delete", method: "POST" },
  agents: { path: "/account/agents", method: "POST" },
  revokeAgent: { path: "/account/agents/revoke", method: "POST" },
} as const

export const oauthRoutes = {
  register: { path: "/oauth/register", method: "POST" },
  token: { path: "/oauth/token", method: "POST" },
  revoke: { path: "/oauth/revoke", method: "POST" },
  client: { path: "/oauth/client", method: "POST" },
  approve: { path: "/oauth/approve", method: "POST" },
} as const

export const signInPaths: readonly string[] = Object.values(signInRoutes).map((route) => route.path)
export const signOutPaths: readonly string[] = Object.values(signOutRoutes).map((route) => route.path)
export const accountPaths: readonly string[] = Object.values(accountRoutes).map((route) => route.path)
export const deckPaths: readonly string[] = Object.values(deckRoutes).map((route) => route.path)
export const oauthPaths: readonly string[] = Object.values(oauthRoutes).map((route) => route.path)
export const airaPaths: readonly string[] = [...Object.values(airaRoutes), ...Object.values(creditsRoutes)].map(
  (route) => route.path,
)

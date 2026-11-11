import { randomUUID } from "node:crypto"

import { readClientMetadata } from "@airdesign/catalog"

import type { Answer } from "./answer.js"
import type { Sql } from "./pool.js"
import { readUrl } from "./resource.js"

export type Client = {
  readonly id: string
  readonly name: string | null
  readonly redirectUris: readonly string[]
}

export type Screen = "claude" | "claude-code" | "codex" | "other"

const claudeCallbacks = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]
const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"]
const webSchemes = ["http:", "https:"]

function loopback(address: string): boolean {
  const url = readUrl(address)
  return url !== undefined && webSchemes.includes(url.protocol) && loopbackHosts.includes(url.hostname)
}

export function screenFor(name: string | null, address: string): Screen {
  if (claudeCallbacks.includes(address)) return "claude"
  const named = (name ?? "").trim().toLowerCase()
  if (named.startsWith("claude code") && loopback(address)) return "claude-code"
  if (named.startsWith("codex") && loopback(address)) return "codex"
  return "other"
}

function redirectAllowed(address: string): boolean {
  const url = readUrl(address)
  if (url === undefined || url.hash !== "") return false
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && loopbackHosts.includes(url.hostname)
}

export type Registration = {
  readonly redirectUris: readonly string[]
  readonly name: string | null
}

export function readRegistration(
  raw: unknown,
): ({ readonly ok: true } & Registration) | { readonly ok: false; readonly refusal: "invalid_client_metadata" } {
  const metadata = readClientMetadata(raw)
  if (!metadata.ok || !metadata.redirectUris.every(redirectAllowed)) {
    return { ok: false, refusal: "invalid_client_metadata" }
  }
  return metadata
}

export async function registerClient(db: Sql, metadata: Registration): Promise<Answer> {
  const id = randomUUID()
  await db.query("insert into session.oauth_client (id, name, redirect_uris) values ($1, $2, $3)", [
    id,
    metadata.name,
    metadata.redirectUris,
  ])
  return {
    status: 201,
    body: {
      client_id: id,
      ...(metadata.name === null ? {} : { client_name: metadata.name }),
      redirect_uris: metadata.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  }
}

export async function readClient(db: Sql, id: string): Promise<Client | undefined> {
  const result = await db.query<{ id: string; name: string | null; redirect_uris: string[] }>(
    "select id, name, redirect_uris from session.oauth_client where id = $1",
    [id],
  )
  const row = result.rows[0]
  if (row === undefined) return undefined
  return { id: row.id, name: row.name, redirectUris: row.redirect_uris }
}

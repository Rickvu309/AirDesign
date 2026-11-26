import { randomUUID } from "node:crypto"

import { readClientMetadata } from "@airdesign/catalog"

import type { Answer } from "../platform/answer.js"
import type { Sql } from "../platform/pool.js"
import { readUrl } from "../platform/resource.js"

export type Client = {
  readonly id: string
  readonly name: string | null
  readonly redirectUris: readonly string[]
}

const agentNameLimit = 60

export type Screen = "claude" | "claude-code" | "codex" | "gemini" | "other"

type Registered = Pick<Client, "name" | "redirectUris">

const claudeCallbacks = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]
const googleRelayHosts = [
  "oauth-redirect.googleusercontent.com",
  "oauth-redirect-sandbox.googleusercontent.com",
  "oauth-redirect-test.googleusercontent.com",
]
const googleRelayPath = /^\/[ar]\/[A-Za-z0-9_.-]+$/
const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"]
const webSchemes = ["http:", "https:"]

function loopback(address: string): boolean {
  const url = readUrl(address)
  return url !== undefined && webSchemes.includes(url.protocol) && loopbackHosts.includes(url.hostname)
}

function googleRelay(address: string): boolean {
  const url = readUrl(address)
  if (url === undefined || !googleRelayHosts.includes(url.hostname) || !googleRelayPath.test(url.pathname)) return false
  return address === `https://${url.hostname}${url.pathname}`
}

export function screenFor(client: Registered, used: string): Screen {
  if (claudeCallbacks.includes(used)) return "claude"
  if ([used, ...client.redirectUris].every(googleRelay)) return "gemini"
  const named = (client.name ?? "").trim().toLowerCase()
  if (named.startsWith("claude code") && loopback(used)) return "claude-code"
  if (named.startsWith("codex") && loopback(used)) return "codex"
  return "other"
}

export function agentNameOf(client: Registered, used: string): string {
  const screen = screenFor(client, used)
  if (screen === "claude") return "Claude"
  if (screen === "claude-code") return "Claude Code"
  if (screen === "codex") return "Codex"
  if (screen === "gemini") return "Gemini"
  const trimmed = (client.name ?? "")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, agentNameLimit)
  return trimmed.length > 0 ? trimmed : (readUrl(used)?.host ?? "")
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

export async function grantAgentName(db: Sql, grant: string): Promise<string> {
  const found = await db.query<{ name: string | null; redirect_uris: string[]; redirect_uri: string }>(
    `select c.name, c.redirect_uris, g.redirect_uri from session.oauth_grant g
     join session.oauth_client c on c.id = g.client_id where g.id = $1`,
    [grant],
  )
  const row = found.rows[0]
  return row === undefined ? "" : agentNameOf({ name: row.name, redirectUris: row.redirect_uris }, row.redirect_uri)
}

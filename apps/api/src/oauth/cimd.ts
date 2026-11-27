import { collected, pinnedAddress, pinnedNet, type PinnedNet } from "../platform/pinned-net.js"
import type { Sql } from "../platform/pool.js"
import { readClient, readRegistration, saveClient, type Client, type Registration } from "./clients.js"

export const documentWait = 3_000
export const documentCap = 5_120
export const documentFresh = 300_000

const longestAddress = 2048

export type DocumentRefusal = "address" | "private" | "unreachable" | "status" | "size" | "timeout" | "document"

export type FetchedDocument =
  | ({ readonly ok: true } & Registration)
  | { readonly ok: false; readonly refusal: DocumentRefusal }

export const documentNet = pinnedNet("application/json", "AirDesign-client-metadata/1")

export function clientAddress(raw: string): URL | null {
  if (raw.length > longestAddress || /[?#]/.test(raw) || !URL.canParse(raw)) return null
  const url = new URL(raw)
  if (url.href !== raw || url.protocol !== "https:" || url.pathname === "/") return null
  return url.username === "" && url.password === "" && url.port === "" ? url : null
}

function allows(listed: unknown, wanted: string): boolean {
  return listed === undefined || (Array.isArray(listed) && listed.includes(wanted))
}

function readDocument(raw: unknown, id: string): Registration | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  if (body.client_id !== id || typeof body.client_name !== "string") return null
  if ("client_secret" in body || "client_secret_expires_at" in body) return null
  const method = body.token_endpoint_auth_method
  if ((method !== undefined && method !== "none") || !allows(body.token_endpoint_auth_methods_supported, "none")) {
    return null
  }
  if (!allows(body.grant_types, "authorization_code") || !allows(body.response_types, "code")) return null
  const registration = readRegistration(body)
  return registration.ok ? registration : null
}

function parsed(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch {
    return undefined
  }
}

const refused = (refusal: DocumentRefusal): FetchedDocument => ({ ok: false, refusal })

async function fetched(url: URL, net: PinnedNet, cap: number, signal: AbortSignal): Promise<FetchedDocument> {
  const at = await pinnedAddress(url, net)
  if (typeof at === "string") return refused(at)
  const answer = await net.get(url, at, signal)
  if (answer.status !== 200) {
    answer.cancel()
    return refused("status")
  }
  if (answer.length !== undefined && answer.length >= cap) {
    answer.cancel()
    return refused("size")
  }
  const bytes = await collected(answer, cap)
  if (bytes === null) return refused("size")
  const registration = readDocument(parsed(bytes), url.href)
  return registration === null ? refused("document") : { ok: true, ...registration }
}

function waited(signal: AbortSignal): Promise<never> {
  return new Promise((_, failed) => {
    signal.addEventListener("abort", () => failed(new Error("timeout")), { once: true })
  })
}

export async function fetchClientDocument(
  id: string,
  net: PinnedNet = documentNet,
  bounds: { readonly wait?: number; readonly cap?: number } = {},
): Promise<FetchedDocument> {
  const url = clientAddress(id)
  if (url === null) return refused("address")
  const signal = AbortSignal.timeout(bounds.wait ?? documentWait)
  try {
    return await Promise.race([fetched(url, net, bounds.cap ?? documentCap, signal), waited(signal)])
  } catch {
    return refused(signal.aborted ? "timeout" : "unreachable")
  }
}

export class ClientDocuments {
  private readonly freshUntil = new Map<string, number>()
  private readonly net: PinnedNet

  constructor(net: PinnedNet = documentNet) {
    this.net = net
  }

  async client(db: Sql, id: string, now: number): Promise<Client | undefined> {
    if (!id.startsWith("https://") || (this.freshUntil.get(id) ?? 0) > now) return readClient(db, id)
    const fetchedDocument = await fetchClientDocument(id, this.net)
    if (!fetchedDocument.ok) return undefined
    const client = { id, name: fetchedDocument.name, redirectUris: fetchedDocument.redirectUris }
    await saveClient(db, client)
    for (const [held, until] of this.freshUntil) if (until <= now) this.freshUntil.delete(held)
    this.freshUntil.set(id, now + documentFresh)
    return client
  }
}

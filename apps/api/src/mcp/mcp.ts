import { createHash } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"

import type { DeckHost, Session } from "@airdesign/agent"
import { createServerHandler, type Origins, serverCard, type ViewHost } from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"

export type McpMount = {
  readonly hosts: readonly string[]
  readonly origins: Origins
  readonly bodyCap: number
  readonly fail: (error: unknown) => void
}

function mcpRequest(req: IncomingMessage, body: Buffer) {
  return {
    headers: req.headers,
    ...(typeof req.method === "string" ? { method: req.method } : {}),
    ...(typeof req.url === "string" ? { url: req.url } : {}),
    async *[Symbol.asyncIterator]() {
      if (body.length > 0) yield body
    },
  }
}

export async function serveMcp(
  host: DeckHost,
  session: Session,
  mount: McpMount,
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
  view?: ViewHost,
): Promise<void> {
  const names = [...mount.hosts]
  if (!hostHeaderValidation(names)(req, res) || !originValidation(names)(req, res)) return
  const handler = createServerHandler(session, host, body, { maxRequestBodySize: mount.bodyCap }, mount.origins, view)
  let failed = false
  const onerror = (error: Error): void => {
    failed = true
    mount.fail(error)
  }
  try {
    await toNodeHandler(handler, { maxRequestBodySize: mount.bodyCap, onerror })(mcpRequest(req, body), res)
  } catch (error) {
    if (!failed) throw error
  } finally {
    await handler.close()
  }
}

const cardReadHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET",
  "access-control-allow-headers": "Content-Type, If-None-Match",
  "access-control-expose-headers": "ETag",
}

function unchanged(sent: string | undefined, tag: string): boolean {
  return sent?.split(",").some((one) => one.trim().replace(/^W\//, "") === tag) ?? false
}

type CardAnswer = {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body?: string
}

function cardAnswer(
  method: string | undefined,
  sent: string | undefined,
  endpoint: string,
  origins: Origins,
): CardAnswer {
  if (method === "OPTIONS") return { status: 204, headers: cardReadHeaders }
  if (method !== "GET" && method !== "HEAD") {
    return { status: 405, headers: { allow: "GET, HEAD, OPTIONS", ...cardReadHeaders } }
  }
  const card = JSON.stringify(serverCard(endpoint, origins))
  const tag = `"${createHash("sha256").update(card).digest("base64url")}"`
  const headers = { ...cardReadHeaders, "cache-control": "public, max-age=3600", etag: tag }
  if (unchanged(sent, tag)) return { status: 304, headers }
  return { status: 200, headers: { ...headers, "content-type": "application/mcp-server-card+json" }, body: card }
}

export function serveServerCard(req: IncomingMessage, res: ServerResponse, endpoint: string, origins: Origins): void {
  const answer = cardAnswer(req.method, req.headers["if-none-match"], endpoint, origins)
  res.setHeaders(new Map(Object.entries(answer.headers)))
  res.statusCode = answer.status
  res.end(answer.body)
}

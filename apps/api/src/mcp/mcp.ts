import type { IncomingMessage, ServerResponse } from "node:http"

import type { DeckHost, Session } from "@airdesign/agent"
import { createServerHandler, type ViewHost } from "@airdesign/mcp"
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node"

export type McpMount = {
  readonly hosts: readonly string[]
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
  const handler = createServerHandler(session, host, body, { maxRequestBodySize: mount.bodyCap }, view)
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

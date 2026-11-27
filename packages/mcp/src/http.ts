import {
  CLIENT_CAPABILITIES_META_KEY,
  createMcpHandler,
  type CreateMcpHandlerOptions,
} from "@modelcontextprotocol/server"
import { z } from "zod"

import type { DeckHost, Session } from "@airdesign/agent"

import { appsExtension, type ViewHost, viewMimeType } from "./deck-view.js"
import { createServer } from "./server.js"

const clientApps = z.object({
  params: z.object({
    _meta: z.object({
      [CLIENT_CAPABILITIES_META_KEY]: z.object({
        extensions: z.object({ [appsExtension]: z.object({ mimeTypes: z.array(z.string()) }) }),
      }),
    }),
  }),
})

function supportsDeckView(body: Uint8Array): boolean {
  const parsed = clientApps.safeParse(JSON.parse(new TextDecoder().decode(body)))
  return (
    parsed.success &&
    parsed.data.params._meta[CLIENT_CAPABILITIES_META_KEY].extensions[appsExtension].mimeTypes.includes(viewMimeType)
  )
}

export function createServerHandler(
  session: Session,
  host: DeckHost,
  body: Uint8Array,
  options: CreateMcpHandlerOptions,
  view?: ViewHost,
) {
  return createMcpHandler(
    ({ era }) => createServer(session, host, era === "legacy" || supportsDeckView(body) ? view : undefined),
    options,
  )
}

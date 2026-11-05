import { attachSync } from "./rpc/websocket.ts"
import { createHistoryStore } from "./db/history-store.ts"
import { commandsHandler } from "./commands/handle.ts"
import { readRequestBody, RequestBodyLimit } from "../../../packages/files/src/request-body.ts"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import path from "node:path"
import os from "node:os"
import { OperationStore } from "../../../packages/operations/src/index.ts"
import { operationsHandler } from "./operations/handle.ts"
import { fileURLToPath } from "node:url"
import { createAccess, createMemoryInbox } from "@airdesign/access"

export type RunningServer = {
  port: number
  close: () => Promise<void>
}

export type StartServerOptions = {
  clock?: () => number
  operationsPath?: string
  historyPath?: string
  accessPath?: string
  publicOrigin?: string
}

export async function startServer(port = 0, extras: StartServerOptions = {}): Promise<RunningServer> {
  const inbox = createMemoryInbox()
  const secret = process.env.AIRDESIGN_SECRET ?? "dev-only-secret-change-me-32chars"
  const databaseUrl = process.env.AIRDESIGN_DATABASE_URL
  const publicOrigin = extras.publicOrigin ?? process.env.AIRDESIGN_PUBLIC_ORIGIN ?? "http://127.0.0.1:41732"
  const access = await createAccess({
    driver: databaseUrl === undefined ? { kind: "pglite", dataDir: extras.accessPath ?? process.env.AIRDESIGN_ACCESS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/access") } : { kind: "postgres", url: databaseUrl },
    secret,
    mail: inbox,
    clock: extras.clock ?? (() => Date.now()),
    guard: { allow: () => true },
    exposeInbox: process.env.AIRDESIGN_EXPOSE_INBOX === "1",
    publicOrigin,
  })
  const operations = new OperationStore(extras.operationsPath ?? process.env.AIRDESIGN_OPERATIONS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/operations.sqlite"), extras.clock)
  const history = await createHistoryStore(databaseUrl === undefined ? { kind: "pglite", path: extras.historyPath ?? process.env.AIRDESIGN_HISTORY_PATH ?? path.join(os.homedir(), ".local/share/airdesign/history") } : { kind: "postgres", url: databaseUrl })
  const handleCommands = commandsHandler(access, history, publicOrigin, deck => sync.refresh(deck))
  const handleOperation = operationsHandler(access, operations, publicOrigin)
  const server = createServer((request, response) => {
    serve(access, handleOperation, handleCommands, request, response).catch((error: unknown) => {
      writeHandlerError(response, error)
    })
  })
  const sync = attachSync(server, access, history, publicOrigin)
  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  const bound = typeof address === "object" && address ? address.port : port
  return {
    port: bound,
    async close() {
      sync.close()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
      await history.close()
      operations.close()
      await access.close()
    },
  }
}

async function serve(access: Awaited<ReturnType<typeof createAccess>>, handleOperation: (request: Request) => Promise<Response>, handleCommands: (request: Request) => Promise<Response>, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const host = request.headers.host ?? "127.0.0.1"
    const body = await readRequestBody(request)
    const method = request.method ?? "GET"
    let incoming: Request
    try {
      incoming = new Request(`http://${host}${request.url ?? "/"}`, {
        method,
        headers: new Headers(entries(request.headers)),
        body: method === "GET" || method === "HEAD" ? undefined : new Uint8Array(body),
      })
    } catch (error) {
      writeHandlerError(response, error)
      return
    }
    const outgoing = new URL(incoming.url).pathname.startsWith("/api/operations") ? await handleOperation(incoming) : new URL(incoming.url).pathname.startsWith("/api/decks") ? await handleCommands(incoming) : await access.handle(incoming)
    const headers: Record<string, string | string[]> = {}
    outgoing.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        return
      }
      headers[key] = value
    })
    const cookies = outgoing.headers.getSetCookie()
    if (cookies.length > 0) {
      headers["set-cookie"] = cookies
    }
    response.writeHead(outgoing.status, headers)
    response.end(Buffer.from(await outgoing.arrayBuffer()))
  } catch (error) {
    writeHandlerError(response, error)
  }
}

function writeHandlerError(response: ServerResponse, error: unknown): void {
  if (response.headersSent || response.writableEnded) {
    response.destroy()
    return
  }
  if (error instanceof RequestBodyLimit) {
    response.writeHead(413, { "content-type": "application/json" })
    response.end(JSON.stringify({ code: "request-body-limit" }))
    return
  }
  const malformed = error instanceof URIError
  response.writeHead(malformed ? 400 : 500, { "content-type": "application/json" })
  response.end(JSON.stringify({ status: malformed ? "bad-request" : "error" }))
}

function entries(headers: IncomingMessage["headers"]): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      pairs.push([key, value])
    } else if (Array.isArray(value)) {
      pairs.push([key, value.join(", ")])
    }
  }
  return pairs
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (entry === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? "41731")
  const running = await startServer(port)
  process.stdout.write(`listening ${running.port}\n`)
}

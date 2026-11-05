import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createAccess, createMemoryInbox } from "@airdesign/access"

export type RunningServer = {
  port: number
  close: () => Promise<void>
}

export type StartServerOptions = {
  clock?: () => number
  publicOrigin?: string
}

export async function startServer(port = 0, extras: StartServerOptions = {}): Promise<RunningServer> {
  const inbox = createMemoryInbox()
  const secret = process.env.AIRDESIGN_SECRET ?? "dev-only-secret-change-me-32chars"
  const databaseUrl = process.env.AIRDESIGN_DATABASE_URL
  const publicOrigin = extras.publicOrigin ?? process.env.AIRDESIGN_PUBLIC_ORIGIN ?? "http://127.0.0.1:41732"
  const access = await createAccess({
    driver: databaseUrl === undefined ? { kind: "pglite" } : { kind: "postgres", url: databaseUrl },
    secret,
    mail: inbox,
    clock: extras.clock ?? (() => Date.now()),
    guard: { allow: () => true },
    exposeInbox: process.env.AIRDESIGN_EXPOSE_INBOX === "1",
    publicOrigin,
  })
  const server = createServer((request, response) => {
    serve(access, request, response).catch((error: unknown) => {
      writeHandlerError(response, error)
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  const bound = typeof address === "object" && address ? address.port : port
  return {
    port: bound,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
      await access.close()
    },
  }
}

async function serve(access: Awaited<ReturnType<typeof createAccess>>, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const host = request.headers.host ?? "127.0.0.1"
    const body = await readRaw(request)
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
    const outgoing = await access.handle(incoming)
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

function readRaw(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => resolve(Buffer.concat(chunks)))
    request.on("error", reject)
  })
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (entry === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? "41731")
  const running = await startServer(port)
  process.stdout.write(`listening ${running.port}\n`)
}

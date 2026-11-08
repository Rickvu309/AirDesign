import {createParagraphHistoryStore} from "./db/paragraph-history-store.ts"
import {paragraphLegacyBoundary} from "./rpc/paragraph-boundary.ts"
import {readBuildIdentity} from "../../../packages/operations/src/build-identity.ts"
import {access as accessFile} from "node:fs/promises"
import {workerAuthorized,workerCompletionLimit} from "./worker/transport.ts"
import {workerHandler} from "./worker/handle.ts"
import {productionEnvironment} from "./runtime/environment.ts"
import {serveStudio} from "./runtime/studio.ts"
import {createResendMail} from "../../../packages/access/src/resend-mail.ts"
import {PGlite} from "@electric-sql/pglite"
import {once} from "node:events"
import {billingHandler} from "./billing/handle.ts"
import type {PaymentProvider} from "../../../packages/usage/src/payments/provider.ts"
import {deliverAccountDeletion} from "../../worker/src/account-deletion/deliver.ts"
import type {AgentAdapter} from "../../../packages/agent/src/harness.ts"
import {agentHandler} from "./agent/handle.ts"
import {configuredAgent} from "../../../packages/agent/src/sdk-adapter.ts"
import {domainTools} from "./mcp/domain-tools.ts"
import {mcpHandler} from "./mcp/handle.ts"
import {oauthHandler} from "./mcp/oauth-handle.ts"
import { usageHandler } from "./usage/handle.ts"
import { imagesHandler } from "./images/handle.ts"
import { templatesHandler } from "./templates/handle.ts"
import { TemplateStore } from "../../../packages/brand/src/template-store.ts"
import { decksHandler } from "./decks/handle.ts"
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
  paymentProvider?: PaymentProvider
  agentAdapter?: AgentAdapter
  clock?: () => number
  operationsPath?: string
  templatesPath?: string
  historyPath?: string
  accessPath?: string
  publicOrigin?: string
}

export async function startServer(port = 0, extras: StartServerOptions = {}): Promise<RunningServer> {
  productionEnvironment()
  if (process.env.NODE_ENV === "production") await accessFile(new URL("../../studio/dist/index.html",import.meta.url)).catch(() => { throw new Error("Studio build missing. Run npm run build before starting web.") })
  const inbox = createMemoryInbox()
  const secret = process.env.AIRDESIGN_SECRET ?? "dev-only-secret-change-me-32chars"
  const databaseUrl = process.env.AIRDESIGN_DATABASE_URL ?? process.env.DATABASE_URL
  const publicOrigin = extras.publicOrigin ?? process.env.AIRDESIGN_PUBLIC_ORIGIN ?? "http://127.0.0.1:41732"
  const memory = databaseUrl===undefined&&extras.accessPath==="memory://"&&extras.historyPath==="memory://" ? await PGlite.create() : undefined
  const access = await createAccess({
    driver: databaseUrl === undefined ? { kind: "pglite", client:memory, dataDir: extras.accessPath ?? process.env.AIRDESIGN_ACCESS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/access") } : { kind: "postgres", url: databaseUrl },
    secret,
    mail: process.env.RESEND_API_KEY ? createResendMail({apiKey:process.env.RESEND_API_KEY,from:process.env.MAIL_FROM ?? "",publicOrigin,endpoint:process.env.AIRDESIGN_RESEND_ENDPOINT}) : inbox,
    clock: extras.clock ?? (() => Date.now()),
    guard: { allow: () => true },
    exposeInbox: process.env.AIRDESIGN_EXPOSE_INBOX === "1",
    publicOrigin,
    deleteOwnedData:async owner=>{await aira.stopOwner(owner);const active=paragraphs && (await paragraphs.protocol()).protocol==="paragraph-body-v3" ? paragraphs : history;await active.deletions.enqueue(owner);await deliverAccountDeletion(active,operations,imageQueue,templates,path.join(os.homedir(),"tmp/airdesign-jobs"))},
  })
  const operationsPath=extras.operationsPath ?? process.env.AIRDESIGN_OPERATIONS_PATH ?? path.join(os.homedir(), ".local/share/airdesign/operations.sqlite")
  const operations = new OperationStore(operationsPath, extras.clock)
  const imageQueue=new OperationStore(operationsPath===":memory:" ? operationsPath : operationsPath+".images",extras.clock)
  const history = await createHistoryStore(databaseUrl === undefined ? { kind: "pglite", client:memory, path: extras.historyPath ?? process.env.AIRDESIGN_HISTORY_PATH ?? path.join(os.homedir(), ".local/share/airdesign/history") } : { kind: "postgres", url: databaseUrl, schema:"migrate" }, extras.clock)
  const paragraphs = databaseUrl === undefined ? undefined : createParagraphHistoryStore(databaseUrl, extras.clock)
  const boundary=(handler:(request:Request)=>Promise<Response>,nativeAvailable?:(request:Request)=>boolean)=>paragraphLegacyBoundary(access,paragraphs,publicOrigin,handler,nativeAvailable)
  const templates = new TemplateStore(extras.templatesPath ?? (operationsPath===":memory:" ? operationsPath : operationsPath+".templates"))
  const handleImages=boundary(imagesHandler(access,imageQueue,history,publicOrigin,async deck=>{await sync.refresh(deck)}),request=>request.method==="GET")
  const handleTemplates = boundary(templatesHandler(access,templates,history,publicOrigin,deck=>sync.refresh(deck)))
  const changed=async(deck:string)=>{await sync.refresh(deck);await aira.publish(deck)}
  const handleDecks = boundary(decksHandler(access,history,publicOrigin,deck=>sync.refresh(deck),operations,templates,paragraphs),()=>true)
  const mcpOrigin=process.env.AIRDESIGN_MCP_ORIGIN ?? publicOrigin
  const mcp=mcpHandler(access,history,templates,operations,imageQueue,publicOrigin,secret,changed,mcpOrigin,paragraphs)
  const handleOAuth=oauthHandler(access,history,publicOrigin,secret,mcpOrigin)
  const aira=agentHandler(access,history,domainTools(history,templates,operations,imageQueue,publicOrigin,deck=>sync.refresh(deck),paragraphs),publicOrigin,extras.agentAdapter ?? configuredAgent(),deck=>sync.refresh(deck),paragraphs)
  await access.resumeDeletions()
  const handleBilling=billingHandler(access,history,extras.paymentProvider,publicOrigin)
  const handleUsage = usageHandler(access,history,publicOrigin,extras.paymentProvider ? {kind:"configured"} : {kind:"unavailable"})
  const handleCommands = commandsHandler(access, history, publicOrigin, deck => sync.refresh(deck), paragraphs)
  const handleOperation = operationsHandler(access, operations, publicOrigin)
  const handleWorker = workerHandler(operations,imageQueue,secret,async()=>{const active=paragraphs && (await paragraphs.protocol()).protocol==="paragraph-body-v3" ? paragraphs : history;return deliverAccountDeletion(active,operations,imageQueue,templates,process.env.AIRDESIGN_WORKER_TEMP ?? path.join(os.homedir(),"tmp/airdesign-jobs"))},operationsPath===":memory:" ? undefined : path.join(path.dirname(operationsPath),"worker-artifacts"),paragraphs ? ()=>paragraphs.protocol() : undefined)
  const version = await readBuildIdentity()
  const server = createServer((request, response) => {
    response.setHeader("x-content-type-options", "nosniff")
    response.setHeader("referrer-policy", "no-referrer")
    if (publicOrigin.startsWith("https:")) response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains")
    if (request.url === "/version" && request.method === "GET") {
      response.writeHead(200, {"content-type":"application/json", "cache-control":"no-store"})
      response.end(JSON.stringify(version))
      return
    }
    if (request.url === "/healthz") {
      void history.health().then(() => { response.writeHead(200); response.end("ok") }).catch(() => { response.writeHead(503); response.end("database-unavailable") })
      return
    }
    serve(access, handleOperation, handleCommands, handleDecks, handleTemplates, handleImages, handleUsage, handleOAuth, mcp.handle, boundary(aira.handle,()=>true), handleBilling, request, response, publicOrigin, handleWorker).catch((error: unknown) => {
      writeHandlerError(response, error)
    })
  })
  const sync = attachSync(server, access, history, publicOrigin, paragraphs)
  await new Promise<void>((resolve,reject) => {
    server.once("error",reject)
    server.listen(port, process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => resolve())
  })
  const address = server.address()
  const bound = typeof address === "object" && address ? address.port : port
  return {
    port: bound,
    async close() {
      sync.close()
      await aira.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
      await mcp.close()
      await paragraphs?.close()
      await history.close()
      imageQueue.close()
      templates.close()
      operations.close()
      await access.close()
    },
  }
}

async function serve(access: Awaited<ReturnType<typeof createAccess>>, handleOperation: (request: Request) => Promise<Response>, handleCommands: (request: Request) => Promise<Response>, handleDecks: (request: Request) => Promise<Response>, handleTemplates: (request: Request) => Promise<Response>, handleImages: (request: Request) => Promise<Response>, handleUsage: (request: Request) => Promise<Response>, handleOAuth:(request:Request)=>Promise<Response>, handleMcp:(request:Request)=>Promise<Response>, handleAira:(request:Request)=>Promise<Response>, handleBilling:(request:Request)=>Promise<Response>, request: IncomingMessage, response: ServerResponse, publicOrigin: string, handleWorker:(request:Request)=>Promise<Response>): Promise<void> {
  try {
    if (await serveStudio(request, response)) return
    const host = request.headers.host ?? "127.0.0.1"
    const workerRequest=new URL(request.url ?? "/","http://localhost").pathname==="/internal/worker"
    if(workerRequest&&!workerAuthorized(request.headers.authorization,process.env.AIRDESIGN_SECRET ?? "dev-only-secret-change-me-32chars")){
      request.resume();response.writeHead(401,{"content-type":"application/json"});response.end(JSON.stringify({code:"unauthorized"}));return
    }
    const binaryWorker=workerRequest&&request.method==="PUT"
    const chunks=request[Symbol.asyncIterator]()
    const stream=binaryWorker ? new ReadableStream<Uint8Array>({async pull(controller){const chunk=await chunks.next();if(chunk.done)controller.close();else if(chunk.value instanceof Uint8Array)controller.enqueue(chunk.value);else controller.error(new Error("invalid-body-chunk"))},async cancel(){request.resume()}}) : undefined
    const body = binaryWorker ? undefined : await readRequestBody(request,workerRequest ? workerCompletionLimit : undefined)
    const method = request.method ?? "GET"
    let incoming: Request
    try {
      incoming = new Request(new URL(request.url ?? "/", process.env.NODE_ENV === "production" ? publicOrigin : `http://${host}`), {
        method,
        headers: new Headers(entries(request.headers)),
        body: method === "GET" || method === "HEAD" ? undefined : binaryWorker ? stream : new Uint8Array(body ?? []),
        ...binaryWorker ? {duplex:"half"} : {},
      })
    } catch (error) {
      writeHandlerError(response, error)
      return
    }
    const pathname=new URL(incoming.url).pathname
    const outgoing = pathname === "/internal/worker" ? await handleWorker(incoming) : pathname.startsWith("/api/billing/") ? await handleBilling(incoming) : pathname.startsWith("/api/aira") ? await handleAira(incoming) : pathname==="/mcp" || pathname.startsWith("/api/mcp/") ? await handleMcp(incoming) : pathname.startsWith("/oauth/") || pathname.startsWith("/.well-known/") || pathname.startsWith("/api/agents") ? await handleOAuth(incoming) : pathname.startsWith("/api/usage") ? await handleUsage(incoming) : new URL(incoming.url).pathname.startsWith("/api/assets") ? await handleImages(incoming) : new URL(incoming.url).pathname.startsWith("/api/templates") ? await handleTemplates(incoming) : new URL(incoming.url).pathname.startsWith("/api/catalog") ? await handleDecks(incoming) : new URL(incoming.url).pathname.startsWith("/api/operations") ? await handleOperation(incoming) : new URL(incoming.url).pathname.startsWith("/api/decks") ? await handleCommands(incoming) : await access.handle(incoming)
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
    headers["cache-control"] = "no-store"
    response.writeHead(outgoing.status, headers)
    if(!outgoing.body){response.end();return}
    const reader=outgoing.body.getReader()
    response.once("close",()=>{void reader.cancel().catch(()=>undefined)})
    for(;;){const chunk=await reader.read();if(chunk.done||response.destroyed)break;if(!response.write(chunk.value))await once(response,"drain",{signal:AbortSignal.timeout(15000)})}
    response.end()
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
  for (const signal of ["SIGTERM","SIGINT"] as const) process.once(signal,() => { void running.close().catch(() => { process.exitCode=1 }) })
}

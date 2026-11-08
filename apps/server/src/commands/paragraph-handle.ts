import type {Principal} from "../../../../packages/change-log/src/index.ts"
import {parseNativeArchiveV3} from "../../../../packages/deck/src/text/native-v3.ts"
import {parseParagraphCommandRequest} from "../../../../packages/rpc/src/text/command-request.ts"
import {admitTextProtocol} from "../../../../packages/rpc/src/text/protocol.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"

export async function paragraphCommands(request: Request, principal: Principal, store: ParagraphHistoryStore, changed: (deck: string) => Promise<void>): Promise<Response | null> {
  const state = await store.protocol()
  const requested = request.headers.get("x-text-protocol") ?? "legacy-text-v2"
  const admission = admitTextProtocol(state, requested)
  const url = new URL(request.url)
  const match = /^\/api\/decks\/([a-zA-Z][a-zA-Z0-9_-]{0,31})(?:\/(commands|events))?$/.exec(url.pathname)
  const deck = match?.[1]
  if (state.kind === "ready" && state.protocol === "paragraph-body-v3" && requested === "legacy-text-v2" && deck && match?.[2] === "commands" && request.method === "POST") {
    const command: unknown = await request.json().catch(() => null)
    if (command && typeof command === "object" && "id" in command && typeof command.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(command.id)) {
      const token = request.headers.get("x-run-credential")
      const identity = token ? await store.runIdentity(principal, deck, token) : {kind: "person"} satisfies {kind: "person"}
      const prior = await store.retry(principal, deck, {version: 2, command}, identity)
      if (prior) return new Response(prior.receiptBytes, {headers: {"content-type": "application/json", "x-history-version": String(prior.version)}})
    }
  }
  if (admission.kind === "refused") return Response.json(admission, {status: 409})
  if (admission.protocol === "legacy-text-v2") return null
  if (url.pathname === "/api/decks" && request.method === "POST") return Response.json(await store.create(principal, parseNativeArchiveV3(await request.json()).deck), {status: 201})
  if (!deck) return Response.json({code: "not-found"}, {status: 404})
  if (match?.[2] === "commands" && request.method === "POST") {
    const token = request.headers.get("x-run-credential")
    const identity = token ? await store.runIdentity(principal, deck, token) : {kind: "person"} satisfies {kind: "person"}
    const payload = parseParagraphCommandRequest(await request.json())
    const result = await store.commit(principal, deck, payload, identity)
    await changed(deck)
    const headers = new Headers({"content-type": "application/json", "x-history-version": String(result.version)})
    const command = payload.command
    if (JSON.parse(result.receiptBytes).kind === "applied" && command && typeof command === "object" && "kind" in command && command.kind === "start-run" && "run" in command && typeof command.run === "string") headers.set("x-run-credential", await store.issueRunToken(principal, deck, command.run))
    return new Response(result.receiptBytes, {headers})
  }
  if (match?.[2] === "events" && request.method === "GET") return Response.json(await store.replay(principal, deck, Number(url.searchParams.get("after") ?? 0)))
  if (!match?.[2] && request.method === "GET") return Response.json(await store.snapshot(principal, deck))
  if (!match?.[2] && request.method === "DELETE") {await store.delete(principal, deck); await changed(deck); return Response.json({kind: "deleted"})}
  return Response.json({code: "method-not-allowed"}, {status: 405})
}

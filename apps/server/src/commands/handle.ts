import { mutationRejection, type Access } from "@airdesign/access"
import { parseDeck } from "../../../../packages/deck/src/index.ts"
import type { HistoryStore } from "../db/history-store.ts"
import { parseCommand } from "../../../../packages/rpc/src/parse-command.ts"
export function commandsHandler(access: Access, store: HistoryStore, origin: string, changed: (deck: string) => Promise<void> = async () => {}) {
  return async (request: Request): Promise<Response> => {
    const rejection = mutationRejection(request, origin)
    if (rejection) return Response.json(rejection, { status: rejection.status })
    const principal = await access.principal(request)
    if (!principal) return Response.json({ code: "signed-out" }, { status: 401 })
    try {
      const url = new URL(request.url)
      if (url.pathname === "/api/decks" && request.method === "POST") return Response.json(await store.create(principal, parseDeck(await request.json())), { status: 201 })
      const match = /^\/api\/decks\/([a-zA-Z][a-zA-Z0-9_-]{0,31})(?:\/(commands|events))?$/.exec(url.pathname)
      if (!match?.[1]) return Response.json({ code: "not-found" }, { status: 404 })
      const deck = match[1]
      if (match[2] === "commands" && request.method === "POST") { const receipt = await store.commit(principal, deck, parseCommand(await request.json())); await changed(deck); return Response.json(receipt) }
      if (match[2] === "events" && request.method === "GET") {
        const after = Number(url.searchParams.get("after") ?? 0)
        if (!Number.isSafeInteger(after) || after < 0) throw new Error("invalid-sequence")
        return Response.json(await store.replay(principal, deck, after))
      }
      if (!match[2] && request.method === "GET") return Response.json(await store.read(principal, deck))
      if (!match[2] && request.method === "DELETE") { await store.delete(principal, deck); await changed(deck); return Response.json({ kind: "deleted" }) }
      return Response.json({ code: "method-not-allowed" }, { status: 405 })
    } catch (error) {
      const code = error instanceof Error ? error.message : "command-failed"
      return Response.json({ code }, { status: code === "deck-not-found" ? 404 : code === "deck-deleted" ? 410 : 400 })
    }
  }
}

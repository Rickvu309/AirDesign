import { mutationRejection, type Access } from "@airdesign/access"
import type { HistoryStore } from "../db/history-store.ts"
export function usageHandler(access: Access, history: HistoryStore, origin: string) {
  return async (request: Request): Promise<Response> => {
    const rejection = mutationRejection(request,origin)
    if (rejection) return Response.json(rejection,{status:rejection.status})
    const principal = await access.principal(request)
    if (!principal) return Response.json({code:"signed-out"},{status:401})
    const owner = principal.personId
    const path = new URL(request.url).pathname
    try {
      if (path === "/api/usage" && request.method === "GET") return Response.json(await history.usage.status(owner))
      if (path === "/api/usage/history" && request.method === "GET") return Response.json(await history.usage.events(owner))
      const body: unknown = await request.json()
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid-usage-command")
      if (path === "/api/usage/reset" && request.method === "POST" && "limitHit" in body && typeof body.limitHit === "string" && Object.keys(body).length === 1) return Response.json(await history.usage.reset(owner,body.limitHit))
      if (path === "/api/usage/configure" && request.method === "POST") {
        if (Object.keys(body).some(key => key !== "zone" && key !== "autoReset")) throw new Error("invalid-usage-command")
        const zone = "zone" in body ? body.zone : undefined
        const autoReset = "autoReset" in body ? body.autoReset : undefined
        if (zone !== undefined && typeof zone !== "string" || autoReset !== undefined && typeof autoReset !== "boolean") throw new Error("invalid-usage-command")
        return Response.json(await history.usage.configure(owner,{zone,autoReset}))
      }
      return Response.json({code:"not-found"},{status:404})
    } catch (error) {
      return Response.json({code:error instanceof Error ? error.message : "usage-failed"},{status:400})
    }
  }
}

import type { Access } from "@airdesign/access"
import { mutationRejection } from "@airdesign/access"
import { OperationStore, operationId } from "../../../../packages/operations/src/index.ts"
import { requireLocalUpload } from "../../../../packages/files/src/index.ts"

export function operationsHandler(access: Access, store: OperationStore, publicOrigin: string) {
  return async (request: Request): Promise<Response> => {
    const rejection = mutationRejection(request, publicOrigin)
    if (rejection) return Response.json(rejection, { status: rejection.status })
    const principal = await access.principal(request)
    if (!principal) return Response.json({ code: "signed-out" }, { status: 401 })
    const url = new URL(request.url)
    try {
      if (url.pathname === "/api/operations" && request.method === "POST") {
        const body: unknown = await request.json()
        const input = requireLocalUpload(body)
        if (typeof body !== "object" || !body || !("requestId" in body) || typeof body.requestId !== "string") throw new Error("request-id-required")
        return Response.json(store.submit(principal, body.requestId, input), { status: 202 })
      }
      const match = /^\/api\/operations\/([a-f0-9-]{36})(?:\/(artifact|cancel))?$/.exec(url.pathname)
      if (!match?.[1]) return Response.json({ code: "not-found" }, { status: 404 })
      const id = operationId(match[1])
      if (match[2] === "artifact" && request.method === "GET") return new Response(new Uint8Array(store.artifact(principal, id)), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "cache-control": "no-store" } })
      if (match[2] === "cancel" && request.method === "POST") return Response.json(store.cancel(principal, id))
      if (!match[2] && request.method === "GET") return Response.json(store.status(principal, id))
      return Response.json({ code: "method-not-allowed" }, { status: 405 })
    } catch (error) {
      const code = error instanceof Error ? error.message : "operation-error"
      return Response.json({ code }, { status: code === "operation-not-found" ? 404 : code.startsWith("artifact-") ? 410 : 400 })
    }
  }
}

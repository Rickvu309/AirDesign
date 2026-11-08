import {mutationRejection, type Access} from "@airdesign/access"
import {admitTextProtocol} from "../../../../packages/rpc/src/text/protocol.ts"
import type {ParagraphHistoryStore} from "../db/paragraph-history-store.ts"

export async function paragraphFeatureAdmission(paragraphs: ParagraphHistoryStore | undefined, request: Request): Promise<Response | null> {
  if (!paragraphs) return null
  const admission = admitTextProtocol(await paragraphs.protocol(), request.headers.get("x-text-protocol") ?? "legacy-text-v2")
  if (admission.kind === "refused") return Response.json(admission, {status: 409})
  if (admission.protocol === "paragraph-body-v3") return Response.json({kind: "refused", code: "editing-feature-pending", retryable: false, next: "retain-and-reconcile"}, {status: 409})
  return null
}

export function paragraphLegacyBoundary(access: Access, paragraphs: ParagraphHistoryStore | undefined, origin: string, handler: (request: Request) => Promise<Response>, nativeAvailable: (request: Request) => boolean = () => false) {
  return async (request: Request) => {
    if (!paragraphs) return handler(request)
    const rejection = mutationRejection(request, origin)
    if (rejection) return Response.json(rejection, {status: rejection.status})
    if (!await access.principal(request)) return Response.json({code: "signed-out"}, {status: 401})
    const admission = admitTextProtocol(await paragraphs.protocol(), request.headers.get("x-text-protocol") ?? "legacy-text-v2")
    if (admission.kind === "refused") return Response.json(admission, {status: 409})
    if (admission.protocol === "paragraph-body-v3" && !nativeAvailable(request)) return Response.json({kind: "refused", code: "editing-feature-pending", retryable: false, next: "retain-and-reconcile"}, {status: 409})
    return handler(request)
  }
}

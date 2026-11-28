import type { ServerResponse } from "node:http"
import { oauthRoutes, readApprovalRequest, readClientRequest } from "@airdesign/catalog"
import { approve, describeClient } from "./oauth/consent.js"
import type { Route } from "./server.js"

type Visit = Parameters<Route["serve"]>[0]
type Reader = (raw: unknown) => { readonly ok: boolean }

type ConsentHttp = {
  readonly signedIn: (visit: Visit) => Promise<string | undefined>
  readonly readJson: <Read extends Reader>(visit: Visit, read: Read) => Promise<ReturnType<Read> | undefined>
  readonly sendJson: (res: ServerResponse, status: number, body: unknown) => void
}

export function oauthConsentRoutes({ signedIn, readJson, sendJson }: ConsentHttp): readonly Route[] {
  return [
    {
      method: "POST",
      path: oauthRoutes.client.path,
      serve: async (visit) => {
        const { options, now, res } = visit
        const email = await signedIn(visit)
        if (email === undefined) return
        const parsed = await readJson(visit, readClientRequest)
        if (parsed === undefined) return
        if (!parsed.ok) {
          sendJson(res, 400, parsed)
          return
        }
        const answer = await describeClient(
          { db: options.session, clients: options.clients, own: options.resource, now: now() },
          parsed,
        )
        sendJson(res, answer.status, answer.body)
      },
    },
    {
      method: "POST",
      path: oauthRoutes.approve.path,
      serve: async (visit) => {
        const { options, now, res } = visit
        const email = await signedIn(visit)
        if (email === undefined) return
        const parsed = await readJson(visit, readApprovalRequest)
        if (parsed === undefined) return
        if (!parsed.ok) {
          sendJson(res, 400, parsed)
          return
        }
        const answer = await approve(
          { db: options.session, clients: options.clients, own: options.resource, now: now() },
          parsed,
          email,
        )
        sendJson(res, answer.status, answer.body)
      },
    },
  ]
}

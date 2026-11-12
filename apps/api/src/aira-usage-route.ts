import { airaRoutes, readNoFields } from "@airdesign/catalog"

import { sessionBody, type AccountHttp, type AccountVisit } from "./account-route.js"
import { readUsage } from "./aira.js"

type UsageVisit = AccountVisit & { readonly now: () => number }

export function airaUsageRoute<Visit extends UsageVisit>(
  http: AccountHttp<Visit>,
): {
  readonly method: "POST"
  readonly path: typeof airaRoutes.usage.path
  readonly serve: (visit: Visit) => Promise<void>
} {
  return {
    method: airaRoutes.usage.method,
    path: airaRoutes.usage.path,
    serve: async (visit) => {
      const session = await sessionBody(http, visit)
      if (session === undefined) return
      if (!readNoFields(http.parsedJson(session.body)).ok) {
        http.sendJson(visit.res, 400, { ok: false, refusal: "field" })
        return
      }
      visit.res.setHeader("cache-control", "no-store")
      const usage = await readUsage(visit.options.session, session.email, visit.now())
      http.sendJson(visit.res, 200, { ok: true, account: { email: session.email }, usage })
    },
  }
}

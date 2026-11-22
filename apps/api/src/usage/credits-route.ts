import { creditsRoutes, readAutoReset, readCreditReset, readNoFields } from "@airdesign/catalog"
import { sessionBody, type AccountHttp, type AccountVisit } from "../account/account-route.js"
import { withAddress } from "../account/account.js"
import { readCredits, resetCredits, setAutoReset } from "./credits.js"

type CreditsVisit = AccountVisit & { readonly now: () => number }

export function creditsRouteList<Visit extends CreditsVisit>(http: AccountHttp<Visit>) {
  return Object.entries(creditsRoutes).map(([name, route]) => ({
    method: route.method,
    path: route.path,
    serve: async (visit: Visit) => {
      const session = await sessionBody(http, visit)
      if (session === undefined) return
      visit.res.setHeader("cache-control", "no-store")
      const body = http.parsedJson(session.body)
      if (visit.req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
        http.sendJson(visit.res, 400, { ok: false, refusal: "field" })
        return
      }
      const db = visit.options.session
      if (name === "reset") {
        const parsed = readCreditReset(body)
        if (!parsed.ok) {
          http.sendJson(visit.res, 400, parsed)
          return
        }
        const result = await resetCredits(db, session.email, visit.now(), parsed.once)
        http.sendJson(visit.res, result.ok ? 200 : 409, result)
      } else if (name === "autoReset") {
        const parsed = readAutoReset(body)
        if (!parsed.ok) {
          http.sendJson(visit.res, 400, parsed)
          return
        }
        http.sendJson(visit.res, 200, { ok: true, credits: await setAutoReset(db, session.email, parsed.enabled) })
      } else {
        const parsed = readNoFields(body)
        if (!parsed.ok) {
          http.sendJson(visit.res, 400, parsed)
          return
        }
        const credits = await withAddress(db, session.email, (client) => readCredits(client, session.email))
        http.sendJson(visit.res, 200, { ok: true, credits })
      }
    },
  }))
}

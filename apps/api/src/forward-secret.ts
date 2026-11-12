import type { IncomingHttpHeaders } from "node:http"

import { countryHeader, forwardSecretHeader } from "@airdesign/catalog"

import { sameSecret } from "./secrets.js"

const visitorHeaders = [countryHeader, "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded"] as const

export function filterForwardedHeaders(headers: IncomingHttpHeaders, forwardSecret: string | undefined): void {
  const given = headers[forwardSecretHeader]
  delete headers[forwardSecretHeader]
  if (forwardSecret === undefined) return
  const trusted = typeof given === "string" && sameSecret(given, forwardSecret)
  if (trusted) return
  for (const name of visitorHeaders) {
    delete headers[name]
  }
}

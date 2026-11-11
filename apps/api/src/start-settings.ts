import { checkedResource } from "./resource.js"
import { requireDomain, requireOrigin } from "./server.js"
import type { R2Settings } from "./r2-original-store.js"

const databaseNames = ["SESSION_DATABASE_URL", "DECK_DATABASE_URL", "LISTEN_DATABASE_URL"] as const
const storageNames = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const

export type StartSettings = {
  readonly sessionUrl: string
  readonly deckUrl: string
  readonly listenUrl: string
  readonly port: number
  readonly publicOrigin: string
  readonly siteOrigin: string
  readonly resource: string
  readonly cookieDomain: string | undefined
  readonly hosts: readonly string[] | undefined
  readonly commit: string | undefined
  readonly smokeToken: string | undefined
  readonly resendKey: string
  readonly resendFrom: string
  readonly r2: R2Settings | undefined
}

export type StartRefusal = { readonly refusal: string }

type Environment = Readonly<Record<string, string | undefined>>

function portNumber(text: string | undefined): number {
  if (text === undefined || text.length === 0) return 3000
  if (!/^[0-9]+$/.test(text)) return Number.NaN
  const port = Number(text)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Number.NaN
  return port
}

function accepted(value: string, check: (value: string) => void): boolean {
  try {
    check(value)
    return true
  } catch {
    return false
  }
}

function configuredHosts(text: string | undefined): readonly string[] | undefined {
  const names = (text ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0)
  return names.length === 0 ? undefined : names
}

function nonEmpty(text: string | undefined): string | undefined {
  return text === undefined || text.length === 0 ? undefined : text
}

export function readStartSettings(env: Environment): StartSettings | StartRefusal {
  const missing = databaseNames.filter((name) => (env[name] ?? "").length === 0)
  if (missing.length > 0) return { refusal: missing.join(" ") }
  const port = portNumber(env.PORT)
  if (Number.isNaN(port)) return { refusal: "PORT" }
  const publicOrigin = env.PUBLIC_ORIGIN ?? ""
  if (!accepted(publicOrigin, (value) => requireOrigin("publicOrigin", value))) return { refusal: "PUBLIC_ORIGIN" }
  const siteOrigin = env.SITE_ORIGIN ?? ""
  if (!accepted(siteOrigin, (value) => requireOrigin("siteOrigin", value))) return { refusal: "SITE_ORIGIN" }
  const resource = env.MCP_RESOURCE ?? ""
  if (!accepted(resource, checkedResource)) return { refusal: "MCP_RESOURCE" }
  const cookieText = env.COOKIE_DOMAIN ?? ""
  if (cookieText !== "" && !accepted(cookieText, requireDomain)) return { refusal: "COOKIE_DOMAIN" }
  const resendKey = nonEmpty(env.RESEND_API_KEY)
  if (resendKey === undefined) return { refusal: "RESEND_API_KEY" }
  const resendFrom = nonEmpty(env.RESEND_FROM)
  if (resendFrom === undefined) return { refusal: "RESEND_FROM" }
  const storage = storageNames.map((name) => nonEmpty(env[name]))
  if (storage.some((value) => value !== undefined)) {
    const missingStorage = storageNames.find((name) => nonEmpty(env[name]) === undefined)
    if (missingStorage !== undefined) return { refusal: missingStorage }
  }
  const [accountId, accessKeyId, secretAccessKey, bucket] = storage
  const r2 =
    accountId === undefined || accessKeyId === undefined || secretAccessKey === undefined || bucket === undefined
      ? undefined
      : { accountId, accessKeyId, secretAccessKey, bucket }
  return {
    sessionUrl: env.SESSION_DATABASE_URL ?? "",
    deckUrl: env.DECK_DATABASE_URL ?? "",
    listenUrl: env.LISTEN_DATABASE_URL ?? "",
    port,
    publicOrigin,
    siteOrigin,
    resource,
    cookieDomain: cookieText === "" ? undefined : cookieText,
    hosts: configuredHosts(env.API_HOSTS),
    commit: nonEmpty(env.RAILWAY_GIT_COMMIT_SHA),
    smokeToken: nonEmpty(env.SMOKE_TOKEN),
    resendKey,
    resendFrom,
    r2,
  }
}

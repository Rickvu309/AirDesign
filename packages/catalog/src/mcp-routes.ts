import { deckPattern } from "./wire.js"

export const oauthAuthorizePath = "/oauth/authorize"

export const mcpRoutes = {
  mcp: { path: "/mcp", method: "POST" },
  resourceMetadata: { path: "/.well-known/oauth-protected-resource", method: "GET" },
  authorizationMetadata: { path: "/.well-known/oauth-authorization-server", method: "GET" },
} as const

export const mcpPaths: readonly string[] = Object.values(mcpRoutes).map((route) => route.path)

export const pendingFontsMeta = "app.airdesign/pending-fonts"

export const onceMeta = "app.airdesign/once"

export type OnceRead = { readonly ok: true; readonly once: string | undefined } | { readonly ok: false }

export function readOnce(meta: unknown): OnceRead {
  if (typeof meta !== "object" || meta === null || !Object.hasOwn(meta, onceMeta)) return { ok: true, once: undefined }
  const once: unknown = (meta as Record<string, unknown>)[onceMeta]
  return typeof once === "string" && deckPattern.test(once) ? { ok: true, once } : { ok: false }
}

import {
  accountPaths,
  fontRoutes,
  airaPaths,
  countryHeader,
  deckPaths,
  forwardSecretHeader,
  mcpPaths,
  oauthPaths,
  doomPaths,
  signInPaths,
  signOutPaths,
} from "@airdesign/catalog"

type Env = {
  API_ORIGIN?: string
  FORWARD_SECRET?: string
  COMMIT?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const apiPaths = [
  ...Object.values(fontRoutes).map((route) => route.path),
  ...accountPaths,
  ...signInPaths,
  ...signOutPaths,
  ...deckPaths,
  ...doomPaths,
  ...oauthPaths,
  ...mcpPaths,
  ...airaPaths,
]

type Visit = Request & { cf?: { country?: unknown } }

export default {
  fetch(request: Visit, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/version") {
      const commit = env.COMMIT !== undefined && env.COMMIT.length > 0 ? env.COMMIT : "unknown"
      return Response.json({ commit })
    }
    if (!apiPaths.includes(url.pathname)) return env.ASSETS.fetch(request)
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    const forwarded = new Request(destination, request)
    forwarded.headers.delete(countryHeader)
    forwarded.headers.delete(forwardSecretHeader)
    if (typeof env.FORWARD_SECRET === "string" && env.FORWARD_SECRET.length > 0) {
      forwarded.headers.set(forwardSecretHeader, env.FORWARD_SECRET)
    }
    const country = request.cf?.country
    if (typeof country === "string") forwarded.headers.set(countryHeader, country)
    return fetch(forwarded, { redirect: "manual", signal: request.signal })
  },
}

import {
  accountPaths,
  airaPaths,
  countryHeader,
  deckPaths,
  mcpPaths,
  oauthPaths,
  signInPaths,
  signOutPaths,
} from "@airdesign/catalog"

type Env = {
  API_ORIGIN?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const apiPaths = [
  ...accountPaths,
  ...signInPaths,
  ...signOutPaths,
  ...deckPaths,
  ...oauthPaths,
  ...mcpPaths,
  ...airaPaths,
]

type Visit = Request & { cf?: { country?: unknown } }

export default {
  fetch(request: Visit, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (!apiPaths.includes(url.pathname)) return env.ASSETS.fetch(request)
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    const forwarded = new Request(destination, request)
    forwarded.headers.delete(countryHeader)
    const country = request.cf?.country
    if (typeof country === "string") forwarded.headers.set(countryHeader, country)
    return fetch(forwarded, { redirect: "manual" })
  },
}

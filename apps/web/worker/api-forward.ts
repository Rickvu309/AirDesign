type Env = {
  API_ORIGIN?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const apiPaths = ["/sign-in/email", "/sign-in/code", "/sign-in/link", "/decks/open", "/decks/commit", "/decks/watch"]

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (!apiPaths.includes(url.pathname)) return env.ASSETS.fetch(request)
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    return fetch(new Request(destination, request), { redirect: "manual" })
  },
}

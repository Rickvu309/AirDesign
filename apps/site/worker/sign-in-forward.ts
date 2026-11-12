import { signInPaths, signOutPaths } from "@airdesign/catalog"

type Env = {
  API_ORIGIN?: string
}

const forwardedPaths = [...signInPaths, ...signOutPaths]

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (!forwardedPaths.includes(url.pathname)) return new Response("Not found", { status: 404 })
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    return fetch(new Request(destination, request), { redirect: "manual" })
  },
}

import { signInPaths, signOutPaths } from "@airdesign/catalog"

type Env = {
  API_ORIGIN?: string
  COMMIT?: string
}

const forwardedPaths = [...signInPaths, ...signOutPaths]

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/version") {
      const commit = env.COMMIT !== undefined && env.COMMIT.length > 0 ? env.COMMIT : "unknown"
      return Response.json({ commit })
    }
    if (!forwardedPaths.includes(url.pathname)) return new Response("Not found", { status: 404 })
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    return fetch(new Request(destination, request), { redirect: "manual" })
  },
}

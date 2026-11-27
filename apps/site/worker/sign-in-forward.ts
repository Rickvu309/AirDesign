import { signInPaths, signOutPaths } from "@airdesign/catalog"
import { signedInDestination } from "../src/access/app-destination.ts"

type Env = {
  API_ORIGIN?: string
  APP_ORIGIN?: string
  COMMIT?: string
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export const signInPagePaths = ["/sign-in", "/sign-in/"]

const forwardedPaths = [...signInPaths, ...signOutPaths]

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/version") {
      const commit = env.COMMIT !== undefined && env.COMMIT.length > 0 ? env.COMMIT : "unknown"
      return Response.json({ commit })
    }
    if (signInPagePaths.includes(url.pathname)) {
      const destination = signedInDestination(request.headers.get("cookie") ?? "", env.APP_ORIGIN, url.search)
      if (destination === null) return env.ASSETS.fetch(request)
      return new Response(null, {
        status: 302,
        headers: { location: destination, "cache-control": "private, no-store" },
      })
    }
    if (!forwardedPaths.includes(url.pathname)) return new Response("Not found", { status: 404 })
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    return fetch(new Request(destination, request), { redirect: "manual" })
  },
}

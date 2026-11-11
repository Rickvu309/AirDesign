import oldDeployment from "./old-deployment-passthrough.js"

type Env = {
  API_ORIGIN?: string
}

const signInApiPaths = ["/sign-in/email", "/sign-in/code", "/sign-in/link"]

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url)
    if (!signInApiPaths.includes(url.pathname)) return oldDeployment.fetch(request)
    if (!env.API_ORIGIN) return new Response(null, { status: 503 })
    const destination = new URL(url.pathname + url.search, env.API_ORIGIN)
    return fetch(new Request(destination, request), { redirect: "manual" })
  },
}

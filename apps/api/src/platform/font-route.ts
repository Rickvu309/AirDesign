import { fontRevision, fontRoutes } from "@airdesign/fonts"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { FontSource } from "./font-source.js"

const anyOrigin = { "access-control-allow-origin": "*" }

type Visit = {
  readonly fonts: FontSource
  readonly query: URLSearchParams
  readonly res: ServerResponse
}
async function family({ fonts, query, res }: Visit): Promise<void> {
  const name = query.get("family")
  if (name === null || name.length > 200) {
    res.writeHead(400)
    res.end()
    return
  }
  const answer = await fonts.family(name)
  res.writeHead(answer.ok ? 200 : 404, {
    "content-type": "application/json",
    "cache-control": answer.ok ? "public, max-age=86400" : "no-store",
    ...anyOrigin,
  })
  res.end(JSON.stringify(answer))
}

async function file({ fonts, query, res }: Visit): Promise<void> {
  const name = query.get("family")
  const file = query.get("file")
  if (name === null || file === null || query.get("v") !== fontRevision) {
    res.writeHead(400)
    res.end()
    return
  }
  const bytes = await fonts.file(name, file)
  if (bytes === undefined) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, {
    "content-type": file.endsWith(".txt")
      ? "text/plain; charset=utf-8"
      : file.endsWith(".otf")
        ? "font/otf"
        : "font/ttf",
    "cache-control": "public, max-age=31536000, immutable",
    "content-length": bytes.length,
    "x-content-type-options": "nosniff",
    ...anyOrigin,
  })
  res.end(bytes)
}

const answers = [
  { path: fontRoutes.family.path, answer: family },
  { path: fontRoutes.file.path, answer: file },
]

type FontVisit = {
  readonly options: { readonly fonts: FontSource }
  readonly query: URLSearchParams
  readonly res: ServerResponse
}

export const fontRouteList = answers.map(({ path, answer }) => ({
  method: "GET" as const,
  path,
  serve: ({ options, query, res }: FontVisit) => answer({ fonts: options.fonts, query, res }),
}))

export function fontMiddleware(fonts: FontSource) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const found = req.method === "GET" ? answers.find((route) => route.path === url.pathname) : undefined
    if (found === undefined) {
      next()
      return
    }
    void found.answer({ fonts, query: url.searchParams, res }).catch(() => {
      res.writeHead(503)
      res.end()
    })
  }
}

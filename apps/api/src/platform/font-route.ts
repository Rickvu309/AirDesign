import { fontRevision, fontRoutes } from "@airdesign/fonts"
import type { IncomingMessage, ServerResponse } from "node:http"
import { FontSource } from "./font-source.js"
import type { OriginalStore } from "./original-store.js"

type Visit = {
  readonly store: OriginalStore | undefined
  readonly query: URLSearchParams
  readonly res: ServerResponse
}
const sources = new WeakMap<OriginalStore, FontSource>()
const local = new FontSource(undefined)

export function fontSource(store: OriginalStore | undefined): FontSource {
  if (store === undefined) return local
  let source = sources.get(store)
  if (source === undefined) {
    source = new FontSource(store)
    sources.set(store, source)
  }
  return source
}

async function family({ store, query, res }: Visit): Promise<void> {
  const name = query.get("family")
  if (name === null || name.length > 200) {
    res.writeHead(400)
    res.end()
    return
  }
  const answer = await fontSource(store).family(name)
  res.writeHead(answer.ok ? 200 : 404, {
    "content-type": "application/json",
    "cache-control": answer.ok ? "public, max-age=86400" : "no-store",
  })
  res.end(JSON.stringify(answer))
}

async function file({ store, query, res }: Visit): Promise<void> {
  const name = query.get("family")
  const file = query.get("file")
  if (name === null || file === null || query.get("v") !== fontRevision) {
    res.writeHead(400)
    res.end()
    return
  }
  const bytes = await fontSource(store).file(name, file)
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
  })
  res.end(bytes)
}

const answers = [
  { path: fontRoutes.family.path, answer: family },
  { path: fontRoutes.file.path, answer: file },
]

type FontVisit = {
  readonly options: { readonly originals?: OriginalStore }
  readonly query: URLSearchParams
  readonly res: ServerResponse
}

export const fontRouteList = answers.map(({ path, answer }) => ({
  method: "GET" as const,
  path,
  serve: ({ options, query, res }: FontVisit) => answer({ store: options.originals, query, res }),
}))

export function fontMiddleware(store: OriginalStore) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const url = new URL(req.url ?? "/", "http://localhost")
    const found = req.method === "GET" ? answers.find((route) => route.path === url.pathname) : undefined
    if (found === undefined) {
      next()
      return
    }
    void found.answer({ store, query: url.searchParams, res }).catch(() => {
      res.writeHead(503)
      res.end()
    })
  }
}

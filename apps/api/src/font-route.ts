import { fontRevision, fontRoutes } from "@airdesign/fonts"
import type { Route } from "./server.js"
import { FontSource } from "./font-source.js"
import type { OriginalStore } from "./original-store.js"

const sources = new WeakMap<OriginalStore, FontSource>()
const local = new FontSource(undefined)

function source(store: OriginalStore | undefined): FontSource {
  if (store === undefined) return local
  let source = sources.get(store)
  if (source === undefined) {
    source = new FontSource(store)
    sources.set(store, source)
  }
  return source
}

export const fontRouteList: readonly Route[] = [
  {
    method: "GET",
    path: fontRoutes.family.path,
    serve: async ({ options, query, res }) => {
      const name = query.get("family")
      if (name === null || name.length > 200) {
        res.writeHead(400)
        res.end()
        return
      }
      const answer = await source(options.originals).family(name)
      res.writeHead(answer.ok ? 200 : 404, {
        "content-type": "application/json",
        "cache-control": answer.ok ? "public, max-age=86400" : "no-store",
      })
      res.end(JSON.stringify(answer))
    },
  },
  {
    method: "GET",
    path: fontRoutes.file.path,
    serve: async ({ options, query, res }) => {
      const name = query.get("family")
      const file = query.get("file")
      if (name === null || file === null || query.get("v") !== fontRevision) {
        res.writeHead(400)
        res.end()
        return
      }
      const bytes = await source(options.originals).file(name, file)
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
    },
  },
]

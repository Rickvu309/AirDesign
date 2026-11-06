import {decodePathSegment} from "../../../../packages/access/src/decode-path-segment.ts"
import {readFile} from "node:fs/promises"
import path from "node:path"
import type {IncomingMessage, ServerResponse} from "node:http"

const root = path.resolve(import.meta.dirname, "../../../studio/dist")
const mime: Record<string,string> = {".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2", ".ico":"image/x-icon"}

export async function serveStudio(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false
  const pathname = decodePathSegment(new URL(request.url ?? "/", "http://localhost").pathname)
  if (pathname === null) { response.writeHead(400); response.end(); return true }
  if (/^\/(api|oauth|mcp|ws|internal|\.well-known)(\/|$)/.test(pathname)) return false
  if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); response.end(); return true }
  const target = path.resolve(root, "." + pathname)
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(400); response.end(); return true }
  const asset = path.extname(target) !== ""
  const filename = asset ? target : path.join(root,"index.html")
  try {
    const bytes = await readFile(filename)
    response.writeHead(200,{"content-type":mime[path.extname(filename)] ?? "application/octet-stream", "cache-control":asset ? "public, max-age=3600" : "no-store", "x-content-type-options":"nosniff"})
    response.end(request.method === "HEAD" ? undefined : bytes)
  } catch {
    response.writeHead(404); response.end("not-found")
  }
  return true
}

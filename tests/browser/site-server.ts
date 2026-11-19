import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { extname, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

type SiteBuild = {
  appPlaceholder: string
  builtSite: (repo: string) => { dist: string }
  siteFile: (dist: string, pathname: string) => string | null
}

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

export type ServedSite = {
  readonly origin: string
  readonly app: string
  readonly dist: string
  readonly close: () => Promise<void>
}

export const signedOut = { cookies: [], origins: [] }

async function siteBuild(repo: string): Promise<SiteBuild> {
  return (await import(pathToFileURL(join(repo, ".agents/skills/verify-airdesign/bin/site.mjs")).href)) as SiteBuild
}

export async function buildSite(): Promise<void> {
  const repo = process.cwd()
  execFileSync("pnpm", ["--filter", "@airdesign/site^...", "run", "build"], { cwd: repo, stdio: "ignore" })
  ;(await siteBuild(repo)).builtSite(repo)
}

export async function serveSite(): Promise<ServedSite> {
  const repo = process.cwd()
  const build = await siteBuild(repo)
  const { dist } = build.builtSite(repo)
  const server = createServer((request, response) => {
    const file = build.siteFile(dist, (request.url ?? "/").split("?")[0] ?? "/")
    if (file === null) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    response.end(readFileSync(file))
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  return {
    origin: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    app: build.appPlaceholder,
    dist,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

export function pagesIn(dist: string): { readonly path: string; readonly html: string }[] {
  const found: { path: string; html: string }[] = []
  const visit = (folder: string) => {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name)
      if (statSync(full).isDirectory()) visit(full)
      else if (name === "index.html") {
        const path = `/${relative(dist, folder)}`
        found.push({ path, html: readFileSync(full, "utf8") })
      }
    }
  }
  visit(dist)
  return found
}

export function stylesOf(dist: string, html: string): string {
  const linked = [...html.matchAll(/<link\s[^>]*href="([^"]+\.css)"/g)].map((match) =>
    readFileSync(join(dist, match[1] ?? ""), "utf8"),
  )
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1] ?? "")
  return [...linked, ...inline].join("\n")
}

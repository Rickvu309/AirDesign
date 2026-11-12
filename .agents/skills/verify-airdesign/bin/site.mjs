import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export const appPlaceholder = "http://verify-app.invalid"
export const fakeOrigins = { app: "https://app.example", site: "https://site.example" }
const sourceDirs = ["apps/site", "packages/theme", "packages/catalog/src"]
const skipped = new Set(["node_modules", "dist", ".astro", ".wrangler"])

function walk(dir, found = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (skipped.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, found)
    else found.push(full)
  }
  return found
}

export function siteKey(repo) {
  const hash = createHash("sha1")
  for (const dir of sourceDirs)
    for (const file of walk(path.join(repo, dir))) {
      hash.update(path.relative(repo, file))
      hash.update(readFileSync(file))
    }
  return hash.digest("hex").slice(0, 16)
}

export function siteCache(key, root = path.join(os.homedir(), "tmp", "verify-airdesign-cache")) {
  return path.join(root, `site-${key}`)
}

export function builtSite(repo) {
  const cached = siteCache(siteKey(repo))
  if (existsSync(path.join(cached, "index.html"))) return { dist: cached, built: false }
  const partial = `${cached}.partial-${String(process.pid)}`
  rmSync(partial, { recursive: true, force: true })
  mkdirSync(path.dirname(cached), { recursive: true })
  execFileSync("pnpm", ["exec", "astro", "build", "--outDir", partial], {
    cwd: path.join(repo, "apps/site"),
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1 << 28,
    env: { ...process.env, PUBLIC_APP_ORIGIN: appPlaceholder },
  })
  rmSync(cached, { recursive: true, force: true })
  renameSync(partial, cached)
  return { dist: cached, built: true }
}

export function siteFile(dist, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const wanted = path.join(dist, path.normalize(decoded))
  if (wanted !== dist && !wanted.startsWith(`${dist}${path.sep}`)) return null
  if (existsSync(wanted) && statSync(wanted).isFile()) return wanted
  const index = path.join(wanted, "index.html")
  return existsSync(index) ? index : null
}

export function withAppOrigin(text, appOrigin) {
  return text.replaceAll(appPlaceholder, appOrigin)
}

export function moveLocation(location, real) {
  if (location === undefined) return undefined
  if (location.startsWith(fakeOrigins.site)) return `${real.site}${location.slice(fakeOrigins.site.length)}`
  if (location.startsWith(fakeOrigins.app)) return `${real.app}${location.slice(fakeOrigins.app.length)}`
  return location
}

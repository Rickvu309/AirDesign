import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { appPlaceholder, fakeOrigins, moveLocation, siteFile, siteKey, withAppOrigin } from "./site.mjs"

function dist() {
  const root = mkdtempSync(path.join(os.tmpdir(), "site-dist-"))
  mkdirSync(path.join(root, "sign-in", "check"), { recursive: true })
  writeFileSync(path.join(root, "index.html"), "<p>home</p>")
  writeFileSync(path.join(root, "sign-in", "index.html"), "<p>sign in</p>")
  writeFileSync(path.join(root, "sign-in", "check", "index.html"), "<p>check</p>")
  return root
}

describe("siteFile", () => {
  it("serves a folder's index the way Astro builds it", () => {
    const root = dist()
    expect(siteFile(root, "/")).toBe(path.join(root, "index.html"))
    expect(siteFile(root, "/sign-in")).toBe(path.join(root, "sign-in", "index.html"))
    expect(siteFile(root, "/sign-in/check/")).toBe(path.join(root, "sign-in", "check", "index.html"))
  })

  it("answers nothing for a page the site does not have or a path out of the folder", () => {
    const root = dist()
    expect(siteFile(root, "/sign-in/missing")).toBeNull()
    expect(siteFile(root, "/../etc/passwd")).toBeNull()
    expect(siteFile(root, "/%2e%2e/etc/passwd")).toBeNull()
  })
})

describe("withAppOrigin", () => {
  it("points the built app address at the stack's app", () => {
    expect(withAppOrigin(`go(${appPlaceholder}/settings/agents)`, "http://127.0.0.1:41000")).toBe(
      "go(http://127.0.0.1:41000/settings/agents)",
    )
  })
})

describe("moveLocation", () => {
  const real = { app: "http://127.0.0.1:41000", site: "http://127.0.0.1:42000" }

  it("sends the API's redirect to the origin the browser can reach", () => {
    expect(moveLocation(`${fakeOrigins.site}/sign-in/expired`, real)).toBe("http://127.0.0.1:42000/sign-in/expired")
    expect(moveLocation(`${fakeOrigins.app}/x`, real)).toBe("http://127.0.0.1:41000/x")
  })

  it("leaves a path and any other address alone", () => {
    expect(moveLocation("/", real)).toBe("/")
    expect(moveLocation("https://elsewhere.test/a", real)).toBe("https://elsewhere.test/a")
    expect(moveLocation(undefined, real)).toBeUndefined()
  })
})

describe("siteKey", () => {
  it("changes when a site source file changes and not otherwise", () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), "site-repo-"))
    mkdirSync(path.join(repo, "apps/site/src"), { recursive: true })
    mkdirSync(path.join(repo, "packages/theme/src"), { recursive: true })
    mkdirSync(path.join(repo, "packages/catalog/src"), { recursive: true })
    writeFileSync(path.join(repo, "apps/site/src/a.astro"), "one")
    const first = siteKey(repo)
    expect(siteKey(repo)).toBe(first)
    writeFileSync(path.join(repo, "apps/site/src/a.astro"), "two")
    expect(siteKey(repo)).not.toBe(first)
  })
})

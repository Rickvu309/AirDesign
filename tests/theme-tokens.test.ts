import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8")
}

describe("theme tokens", () => {
  it("shares one token file between the product and the site", () => {
    const tokens = read("packages/theme/src/tokens.css")
    expect(tokens).toContain("--border: " + "#" + "eaeae7")
    expect(tokens).toContain("--primary: " + "#" + "4d94fb")
    expect(tokens).toContain("--white-0: " + "#" + "ffffff00")
    expect(tokens).toContain("--white-88: " + "#" + "ffffffe0")
    expect(tokens).toContain("--ease-micro: 150ms cubic-bezier(0.22, 1, 0.36, 1)")
    expect(tokens).toContain("--ease-panel: 280ms cubic-bezier(0.32, 0.72, 0, 1)")
    expect(tokens).toContain("--fill-marketing")
    expect(tokens).not.toContain(".dark")
    expect(tokens).not.toContain("#" + "eeeeec")

    for (const relative of ["apps/web/src/index.css", "apps/site/src/site/site-theme.css"]) {
      const css = read(relative)
      expect(css).toContain('@import "@airdesign/theme/tokens.css"')
      expect(css).not.toMatch(/\.dark\s*\{/)
      expect(css).not.toMatch(/--border\s*:/)
    }

    const packageJson = JSON.parse(read("packages/theme/package.json")) as { exports: Record<string, string> }
    expect(packageJson.exports["./tokens.css"]).toBe("./src/tokens.css")
  })

  it("draws one focus ring from the theme tokens, and no component or page styles its own", () => {
    const tokens = read("packages/theme/src/tokens.css")
    expect(tokens).toMatch(/--focus-ring: var\(--ring\);/)
    expect(tokens).toContain("--focus-ring-width: 2px;")
    expect(tokens).toContain("--focus-ring-offset: 2px;")
    expect(tokens).toMatch(/:focus-visible[^{]*\{[^}]*outline: var\(--focus-ring-width\) solid var\(--focus-ring\);/)

    const own = /focus(?:-visible|-within)?:(?:ring|outline|shadow|border-ring)|outline-ring|:focus-visible\s*\{/
    const sources: string[] = []
    const walk = (folder: string) => {
      for (const entry of readdirSync(path.join(repoRoot, folder), { withFileTypes: true })) {
        const relative = path.join(folder, entry.name)
        if (entry.isDirectory()) walk(relative)
        else if (/\.(tsx|css|astro)$/.test(entry.name) && !entry.name.includes(".test.")) sources.push(relative)
      }
    }
    walk("apps/web/src")
    walk("apps/site/src")
    const styled = sources.filter((relative) => own.test(read(relative)))
    expect(styled).toEqual([])
  })
})

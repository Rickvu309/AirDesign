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

  it("names each color mix, and the slide index clears 4.5 on white and on the selected row", () => {
    const tokens = read("packages/theme/src/tokens.css")
    const mix = "color-" + "mix("
    expect(tokens).toContain(`--index: ${mix}in oklch, var(--primary-strong), var(--navy) 8%);`)
    expect(tokens).toContain(`--secondary-hover: ${mix}in oklch, var(--secondary), var(--foreground) 5%);`)
    expect(tokens).toContain(`--strong-hover: ${mix}in oklch, var(--primary-strong), black 15%);`)
    expect(tokens).toContain("--color-index: var(--index);")
    expect(tokens).toContain("--color-secondary-hover: var(--secondary-hover);")
    expect(tokens).toContain("--color-strong-hover: var(--strong-hover);")

    const channel = (hex: string, start: number) => {
      const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
    const ratio = (front: string, back: string) => {
      const lighter = Math.max(luminance(front), luminance(back))
      const darker = Math.min(luminance(front), luminance(back))
      return (lighter + 0.05) / (darker + 0.05)
    }
    const row = "#" + "e8f1fe"
    const white = "#" + "ffffff"
    expect(ratio("#" + "2d6fcd", row)).toBeCloseTo(4.32, 2)
    const index = "#" + "2769bf"
    expect(ratio(index, white)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(index, row)).toBeGreaterThanOrEqual(4.5)
  })

  it("draws one focus ring from the theme tokens, and no component or page styles its own", () => {
    const tokens = read("packages/theme/src/tokens.css")
    expect(tokens).toMatch(/--focus-ring: var\(--ring\);/)
    expect(tokens).toContain("--focus-ring-width: 2px;")
    expect(tokens).toContain("--focus-ring-offset: 2px;")
    expect(tokens).toMatch(/:focus-visible[^{]*\{[^}]*outline: var\(--focus-ring-width\) solid var\(--focus-ring\);/)
    expect(tokens, "a control rings only once Tab has moved focus; see apps/web/src/lib/quiet-focus.rule.md").toMatch(
      /:where\(:root:not\(\[data-quiet-focus\]\)\)\s+:where\(a\[href\], button, input, select, summary, \[tabindex\]\):focus-visible/,
    )
    expect(tokens, "only a field a person types in rings before Tab; a slider or checkbox waits like a button").toMatch(
      /\n:where\(\s*input:not\(\s*\[type="range"\],\s*\[type="checkbox"\]/,
    )
    const own =
      /focus(?:-visible|-within)?:(?:ring|outline|shadow|border-ring)|outline-ring|:focus-visible\s*\{|pointer-?focus/i
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

  it("draws one invalid edge from the theme, and no component draws its own", () => {
    const tokens = read("packages/theme/src/tokens.css")
    expect(tokens).toMatch(/\[aria-invalid="true"\][^{]*\{[^}]*outline: 1px solid var\(--danger-text\);/)
    expect(tokens, "the invalid edge replaces a field's own resting edge").toMatch(
      /\[aria-invalid="true"\][^{]*\{[^}]*box-shadow: none;/,
    )
    const own =
      /aria-invalid:(?:ring|border|shadow|outline)|has-\[\[aria-invalid|invalid\s*&&\s*"[^"]*(?:danger|destructive)/
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
    expect(styled, "mark the field aria-invalid and let the theme's invalid rule in tokens.css draw the edge").toEqual(
      [],
    )
  })
})

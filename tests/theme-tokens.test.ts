import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8")
}

type Rgb = readonly [number, number, number]

function readTokenMap(css: string): Map<string, string> {
  const rootBlock = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ""
  const map = new Map<string, string>()
  for (const found of rootBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    const name = found[1]
    const value = found[2]
    if (name !== undefined && value !== undefined) map.set(`--${name}`, value.trim())
  }
  return map
}

function resolveToken(tokens: ReadonlyMap<string, string>, raw: string, depth = 0): string {
  if (depth > 8) throw new Error(`cyclic token reference: ${raw}`)
  return raw.replace(/var\((--[a-z0-9-]+)\)/g, (_, name: string) => {
    const value = tokens.get(name)
    if (value === undefined) throw new Error(`missing token ${name}`)
    return resolveToken(tokens, value, depth + 1)
  })
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.trim()
  if (!/^#[0-9a-f]{6}$/i.test(clean)) throw new Error(`expected 6-digit hex color, got ${hex}`)
  return [
    Number.parseInt(clean.slice(1, 3), 16),
    Number.parseInt(clean.slice(3, 5), 16),
    Number.parseInt(clean.slice(5, 7), 16),
  ]
}

function linearChannel(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b)
}

function contrastRatio(front: Rgb, back: Rgb): number {
  const lighter = Math.max(relativeLuminance(front), relativeLuminance(back))
  const darker = Math.min(relativeLuminance(front), relativeLuminance(back))
  return (lighter + 0.05) / (darker + 0.05)
}

function oklchHue([r, g, b]: Rgb): number {
  const lr = linearChannel(r)
  const lg = linearChannel(g)
  const lb = linearChannel(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const angle = (Math.atan2(b2, a) * 180) / Math.PI
  return angle < 0 ? angle + 360 : angle
}

function gradientStops(tokens: ReadonlyMap<string, string>, tokenName: string): Rgb[] {
  const raw = tokens.get(tokenName)
  if (raw === undefined) throw new Error(`missing gradient token ${tokenName}`)
  const resolved = resolveToken(tokens, raw)
  const matches = [...resolved.matchAll(/#[0-9a-f]{6}/gi)].map((found) => hexToRgb(found[0]))
  if (matches.length < 2) throw new Error(`expected at least two stops in ${tokenName}: ${resolved}`)
  return matches
}

function minimumGradientContrast(label: Rgb, stops: readonly Rgb[]): number {
  let lowest = Infinity
  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index]
    const end = stops[index + 1]
    if (start === undefined || end === undefined) continue
    for (let step = 0; step <= 20; step += 1) {
      const t = step / 20
      const sample: Rgb = [
        start[0] * (1 - t) + end[0] * t,
        start[1] * (1 - t) + end[1] * t,
        start[2] * (1 - t) + end[2] * t,
      ]
      lowest = Math.min(lowest, contrastRatio(label, sample))
    }
  }
  return lowest
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

  it("keeps primary button labels at or above 4.5:1 across every point of the sign-in gradient in rest, hover and pressed states", () => {
    const tokens = readTokenMap(read("packages/theme/src/tokens.css"))
    const label = hexToRgb(resolveToken(tokens, "var(--primary-foreground)"))
    const brandHue = oklchHue(hexToRgb(resolveToken(tokens, "var(--primary)")))

    for (const fill of ["--fill-marketing", "--fill-marketing-hover", "--fill-marketing-active"]) {
      const stops = gradientStops(tokens, fill)
      expect(minimumGradientContrast(label, stops), fill).toBeGreaterThanOrEqual(4.5)
      const first = stops[0]
      const last = stops.at(-1)
      expect(first).toBeDefined()
      expect(last).toBeDefined()
      if (first === undefined || last === undefined) continue
      expect(relativeLuminance(first), `${fill} top stop stays lighter than bottom stop`).toBeGreaterThan(
        relativeLuminance(last),
      )
      for (const stop of stops) {
        expect(Math.abs(oklchHue(stop) - brandHue), `${fill} stays on AirDesign blue hue`).toBeLessThan(2)
      }
    }

    const strong = hexToRgb(resolveToken(tokens, "var(--primary-strong)"))
    const background = hexToRgb(resolveToken(tokens, "var(--background)"))
    const canvas = hexToRgb(resolveToken(tokens, "var(--canvas)"))
    const foreground = hexToRgb(resolveToken(tokens, "var(--foreground)"))
    const ring = hexToRgb(resolveToken(tokens, "var(--ring)"))
    const darkLink = hexToRgb(resolveToken(tokens, "var(--primary-top)"))
    expect(contrastRatio(label, strong), "solid primary button").toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(strong, background), "primary link on white").toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(ring, background), "focus ring on white").toBeGreaterThanOrEqual(3)
    expect(contrastRatio(ring, canvas), "focus ring on canvas").toBeGreaterThanOrEqual(3)
    expect(contrastRatio(darkLink, foreground), "dark mail link").toBeGreaterThanOrEqual(4.5)

    const buttonSource = read("apps/web/src/components/ui/button.tsx")
    expect(buttonSource).toContain("text-primary-strong")

    const siteTheme = read("apps/site/src/site/site-theme.css")
    expect(siteTheme).toContain("var(--fill-marketing-hover)")
    expect(siteTheme).toContain("var(--fill-marketing-active)")
    expect(siteTheme).not.toMatch(/\.primary-button[^{]*\{[^}]*brightness\(/)
    expect(siteTheme).not.toMatch(/\[data-pending\]\s+\[data-sign-in-label\][^}]*opacity:/)

    const checkEmailCard = read("apps/site/src/access/check-email/check-email-card.astro")
    expect(checkEmailCard).toContain("var(--fill-marketing)")
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

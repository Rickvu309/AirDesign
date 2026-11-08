import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve("packages/ui")

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722
}

describe("tokens", () => {
  it("keeps the signature button label at WCAG AA against both shared gradient stops", async () => {
    const css = await readFile(path.join(root, "src/tokens/tokens.css"), "utf8")
    const color = (name: string) => {
      const value = css.match(new RegExp(`--${name}: (#[a-f0-9]{6});`, "i"))?.[1]
      if (!value) throw new Error(`Missing color token: ${name}`)
      return value
    }
    const label = luminance(color("primary-foreground"))
    for (const stop of ["signature-top", "signature-bottom"]) {
      const background = luminance(color(stop))
      expect((Math.max(label, background) + 0.05) / (Math.min(label, background) + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
    expect(css).toMatch(/\.ad-button-primary\s*\{[^}]*background: var\(--signature-gradient\)/)
    for (const file of ["apps/site/src/site.css"]) {
      expect(await readFile(file, "utf8")).toMatch(/background:\s*var\(--signature-gradient\)/)
    }
  })
  it("keeps light semantic tokens and reduced motion in one stylesheet", async () => {
    const css = await readFile(path.join(root, "src/tokens/tokens.css"), "utf8")
    expect(css).toContain("--motion-micro: 150ms cubic-bezier(0.22, 1, 0.36, 1)")
    expect(css).toContain("--motion-panel: 280ms cubic-bezier(0.32, 0.72, 0, 1)")
    expect(css).toContain("--background:")
    expect(css).toContain("--primary:")
    expect(css).toContain("--muted-foreground:")
    expect(css).toContain("color-scheme: light")
    expect(css).not.toContain("prefers-color-scheme")
    expect(css).not.toContain(".dark")
    expect(css).toContain("@media (prefers-reduced-motion: reduce)")
    expect(css).toContain("--motion-micro: 0ms")
    expect(css).toContain("--motion-panel: 0ms")
    expect(css).toContain("grid-template-columns: repeat(6, minmax(0, 1fr))")
  })

  it("keeps color values in the token stylesheet", async () => {
    const files = await walk(path.join(root, "src"))
    const offenders: string[] = []
    for (const file of files) {
      if (!file.endsWith(".tsx")) {
        continue
      }
      const source = await readFile(file, "utf8")
      if (source.includes("#")) {
        offenders.push(path.relative(root, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(full))
    } else {
      files.push(full)
    }
  }
  return files
}

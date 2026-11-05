import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = path.resolve("packages/ui")

describe("tokens", () => {
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

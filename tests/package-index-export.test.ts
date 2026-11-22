import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

it("keeps `export * as` out of every package index, since Playwright's loader cannot read it in a built index.js", () => {
  const packages = path.join(root, "packages")
  const found = readdirSync(packages)
    .map((name) => path.join(packages, name, "src", "index.ts"))
    .filter((file) => /^export\s+\*\s+as\s/m.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file))
  expect(found).toEqual([])
})

import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"

it("builds the Worker's workspace imports and their dependencies before Astro", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  expect(manifest.dependencies["@airdesign/catalog"]).toBe("workspace:*")
  expect(manifest.scripts.build).toBe("pnpm --filter @airdesign/site^... run build && astro check && astro build")
})

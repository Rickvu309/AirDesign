import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { test } from "./deck-test"
import { cssFamily, measureFaces } from "./font-widths.ts"

test("font measurement leaves the agent tool catalog loadable by native modules", async ({ page }) => {
  expect(cssFamily("Arial")).toContain("Arimo")
  expect(Object.keys(await measureFaces(page, ["Arial"], "x")).length).toBe(4)
  const catalog = await import(pathToFileURL(join(process.cwd(), "packages/catalog/dist/index.js")).href)
  expect(catalog.projectTools(catalog.catalog).length).toBeGreaterThan(0)
})

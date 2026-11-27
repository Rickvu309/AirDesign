import { readdirSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("leaves Doom with a theme only for its tests and no preset imports", () => {
  const root = new URL("../packages/doom/src/", import.meta.url)
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  expect(files.filter((file) => file.endsWith(".json") && /theme/.test(file))).toEqual(["testing/theme.json"])
  for (const file of files.filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))) {
    expect(readFileSync(new URL(file, root), "utf8"), file).not.toMatch(/themeLibrary|libraryThemeOf|@airdesign\/taste/)
  }
})

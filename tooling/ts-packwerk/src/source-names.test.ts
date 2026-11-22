import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { expect, it } from "vitest"

it("names no repository it was built in, so it runs anywhere", () => {
  const folder = import.meta.dirname
  const named = readdirSync(folder)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .filter((file) => /airdesign|doom|pptx/i.test(readFileSync(path.join(folder, file), "utf8")))
  expect(named).toEqual([])
})

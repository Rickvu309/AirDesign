import { readFileSync } from "node:fs"

import { guides as tasteGuides } from "@airdesign/taste"
import { expect, it } from "vitest"

import { guide, guides } from "./guides.js"

it("reads the execute manual from beside the execute tool", () => {
  const manual = readFileSync(new URL("./execute/SKILL.md", import.meta.url))
  expect(guide("execute")?.files.map((file) => file.bytes)).toEqual([new Uint8Array(manual)])
  expect(tasteGuides().map((each) => each.name)).not.toContain("execute")
})

it("lists taste's guides and the execute manual in name order", () => {
  expect(guides().map((each) => each.name)).toEqual([...tasteGuides().map((each) => each.name), "execute"].sort())
  for (const each of guides()) expect(guide(each.name)).toEqual(each)
})

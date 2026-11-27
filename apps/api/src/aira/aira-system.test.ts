import { airaTools } from "@airdesign/catalog"
import { expect, it } from "vitest"

import { airaSystem } from "./aira.js"

it("asks Aira for a summary on each execute call, a field its execute tool takes", () => {
  expect(airaSystem("airadeck")).toContain("summary")
  const execute = airaTools.find((tool) => tool.name === "airdesign_execute")
  expect(execute?.input_schema).toMatchObject({ properties: { summary: { type: "string" } } })
})

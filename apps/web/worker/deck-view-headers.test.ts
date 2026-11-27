import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

const rules = readFileSync(new URL("../public/_headers", import.meta.url), "utf8")
  .split(/\n\s*\n/)
  .map((block) => block.trim().split("\n"))
  .map(([path, ...headers]) => ({ path: path?.trim(), headers: headers.map((line) => line.trim()) }))

it("lets the deck view in a chat load its page and code from another origin", () => {
  for (const path of ["/deck-view", "/deck-view.html", "/assets/*"])
    expect(rules.find((rule) => rule.path === path)?.headers, path).toContain("Access-Control-Allow-Origin: *")
  expect(rules.find((rule) => rule.path === "/oauth/authorize")?.headers.join("\n")).not.toContain("Access-Control")
})

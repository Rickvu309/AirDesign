import { expect, it } from "vitest"
import { deckRoutes } from "@airdesign/catalog"
import { deckAnswers, routes } from "../server.js"

it("answers every catalog deck route and serves every path once", () => {
  const { watch, findings, ...answered } = deckRoutes
  expect(Object.keys(deckAnswers).sort()).toEqual(Object.keys(answered).sort())
  for (const route of Object.values(deckRoutes)) {
    expect(routes.filter((served) => served.path === route.path)).toEqual([
      expect.objectContaining({ method: "POST", serve: expect.any(Function) }),
    ])
  }
  expect(routes.filter((served) => served.path === watch.path)).toHaveLength(1)
  expect(routes.filter((served) => served.path === findings.path)).toHaveLength(1)
})

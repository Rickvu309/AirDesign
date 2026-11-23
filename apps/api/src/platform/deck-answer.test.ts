import { expect, it } from "vitest"
import { deckRoutes } from "@airdesign/catalog"
import { deckAnswers, routes } from "../server.js"

it("answers every catalog deck route and serves every path once", () => {
  expect(Object.keys(deckAnswers).sort()).toEqual(Object.keys(deckRoutes).sort())
  for (const route of Object.values(deckRoutes)) {
    expect(routes.filter((served) => served.path === route.path)).toEqual([
      expect.objectContaining({ method: "POST", serve: expect.any(Function) }),
    ])
  }
})

import { properties, structure } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { writtenRoutes } from "./written-routes.js"

describe("writtenRoutes", () => {
  it("writes each edit through the route document names for a shape", () => {
    expect(writtenRoutes).toEqual({
      text: properties.shape.text.route,
      move: properties.shape.box.route,
      resize: properties.shape.box.route,
      add: structure.shape.create.route,
      remove: structure.shape.remove.route,
    })
  })
})

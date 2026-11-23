import { describe, expect, it } from "vitest"
import { traitNames, traits } from "./traits.js"

describe("the one table of traits", () => {
  it("declares how the traits inherit in PowerPoint", () => {
    expect(Object.fromEntries(traitNames.map((name) => [name, traits[name].inherits]))).toEqual({
      identity: "own",
      link: "own",
      box: "whole",
      geometry: "whole",
      fills: "whole",
      border: "field",
      effects: "whole",
      body: "field",
      text: "run",
      connection: "own",
      notes: "own",
      templateStyle: "own",
      show: "own",
      transition: "own",
      guides: "own",
      layout: "own",
    })
  })
})

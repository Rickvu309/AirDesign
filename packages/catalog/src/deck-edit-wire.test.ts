import { expect, it } from "vitest"

import { readDeckChange } from "./deck-edit-wire.js"

it("rejects detach and linked template fields at the deck edit boundary", () => {
  const detach = readDeckChange({ op: "detach", target: "a:1" })
  expect(detach).toMatchObject({ refused: "shape", field: "op" })
  expect(detach).not.toMatchObject({ form: expect.stringContaining("detach") })
  for (const field of ["component", "spec", "data", "variant", "tokens", "focus"]) {
    expect(readDeckChange({ op: "set", target: "a:1", [field]: {} })).toMatchObject({
      refused: "shape",
      field,
      fault: "unknown",
    })
  }
})

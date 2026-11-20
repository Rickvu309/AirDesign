import { expect, it } from "vitest"
import { isInherited } from "../scripts/test-environment.mjs"

it("starts with no inherited repository or provider variable", () => {
  expect(Object.keys(process.env).filter(isInherited)).toEqual([])
})

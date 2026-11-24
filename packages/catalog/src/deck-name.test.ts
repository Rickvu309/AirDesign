import { expect, it } from "vitest"
import { readDeckName } from "./index.js"

it("trims surrounding space and counts characters in a deck name", () => {
  const name = "x".repeat(199) + "😀"
  expect(readDeckName(`  ${name}  `)).toBe(name)
  expect(readDeckName(`${name}y`)).toBeUndefined()
})

it("refuses names that cannot be stored", () => {
  for (const name of ["", "  ", "\ud83d", "a\u0000b"]) expect(readDeckName(name)).toBeUndefined()
})

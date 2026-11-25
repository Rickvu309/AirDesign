import { expect, it } from "vitest"
import { cycle, groupIndex, lookup } from "./list-operators.js"

it("groups rows in encounter order and reads only own keys", () => {
  const rows = [
    { id: "first", member: "__proto__" },
    { id: "second", member: "constructor" },
    { id: "third", member: "__proto__" },
  ]
  const charges: number[] = []
  const charge = (cost = 1) => {
    charges.push(cost)
  }
  const groups = groupIndex([rows, "member"], charge)
  expect(charges).toEqual(rows.map(({ member }) => 1 + member.length))
  expect(lookup([groups, "__proto__"], charge)).toEqual([rows[0], rows[2]])
  expect(lookup([groups, "constructor"], charge)).toEqual([rows[1]])
  expect(lookup([groups, "toString"], charge)).toBeNull()
  expect(lookup([groups, "missing"], charge)).toBeNull()
  expect(lookup([groups, "missing", []], charge)).toEqual([])
})

it("cycles through a list without changing its order", () => {
  expect(cycle([["a", "b"], 3])).toBe("b")
  expect(cycle([[], 3])).toBeNull()
})

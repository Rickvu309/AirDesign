import { format, openRegister } from "@airdesign/document"
import { expect, it } from "vitest"
import { readRegister } from "./register-answer.js"

it("reads a register with no format as this build's", () => {
  const register = openRegister("", "")
  expect(readRegister(JSON.parse(JSON.stringify(register)))).toEqual({ ok: true, register })
})

it("reads a newer format as newer before it checks a node", () => {
  expect(readRegister({ format: format + 1 })).toEqual({ ok: false, refusal: "newer" })
  expect(readRegister({ format: format + 1, elements: { "258.slide": { route: 1 } } })).toEqual({
    ok: false,
    refusal: "newer",
  })
})

it("reads a register at this build's format that does not parse as payload", () => {
  expect(readRegister({ format, elements: { "258.slide": {} } })).toEqual({ ok: false, refusal: "payload" })
})

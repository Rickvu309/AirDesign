import { elementId, format, openRegister, rootElement } from "@airdesign/document"
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

it("reads each stored row through readRow, a row of trait fields included", () => {
  const register = openRegister("", "")
  const root = register.elements[rootElement]
  if (root === undefined) throw new Error("root")
  const node = elementId("258.7")
  const holding = (row: object) => ({
    ...register,
    nodes: [...register.nodes, node],
    elements: {
      ...register.elements,
      [node]: { ...root, landed: [{ actor: "agent", visible: true, runId: "r", ...row }] },
    },
  })
  const written = holding({ v: format, patch: { box: { x: { set: 12_700 } }, text: { value: { set: "Hi" } } } })
  expect(readRegister(JSON.parse(JSON.stringify(written)))).toEqual({ ok: true, register: written })
  expect(readRegister(holding({ v: format, patch: { box: { spin: { set: 1 } } } }))).toEqual({
    ok: false,
    refusal: "payload",
  })
  expect(readRegister(holding({ v: format + 1, patch: { glow: { radius: { set: 1 } } } }))).toEqual({
    ok: false,
    refusal: "newer",
  })
})

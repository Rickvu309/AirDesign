import { expect, it } from "vitest"
import { defaultTheme } from "../index.js"
import { readableInk } from "./color-operators.js"

it("picks readable ink against a resolved solid fill", () => {
  const dark = { var: "accent1", tint: -1 }
  const light = { var: "accent1", tint: 1 }
  expect(readableInk([light], defaultTheme)).toEqual({ var: "text", tint: -1 })
  expect(readableInk([dark], defaultTheme)).toEqual({ var: "background", tint: 1 })
  expect(readableInk([defaultTheme.colors.background], defaultTheme)).toEqual({ var: "text", tint: -1 })
})

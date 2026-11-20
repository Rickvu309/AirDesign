import { expect, it } from "vitest"
import { steppedStyle } from "./weight-step"

const choices = ["Light", "Light Italic", "Regular", "Italic", "SemiBold", "Bold", "Bold Italic"].map((value) => ({
  value,
  label: value,
}))

it("steps to the family's next weight in the same slant and stops at either end", () => {
  expect(steppedStyle({ value: "Regular", choices }, 1)).toBe("SemiBold")
  expect(steppedStyle({ value: "SemiBold", choices }, -1)).toBe("Regular")
  expect(steppedStyle({ value: "Italic", choices }, 1)).toBe("Bold Italic")
  expect(steppedStyle({ value: "Light Italic", choices }, -1)).toBeNull()
  expect(steppedStyle({ value: "Bold", choices }, 1)).toBeNull()
  expect(steppedStyle({ value: undefined, choices }, 1)).toBeNull()
})

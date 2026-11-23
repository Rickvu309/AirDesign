import { describe, expect, it } from "vitest"
import { chosenStep, numberShown, scrubAfter, scrubbed, storedFromTyped } from "@/design/controls/number"
import { steppedFrom, untouched } from "@/design/shown-number"
import { typedNumber } from "@/design/typed-number"
import type { PanelControl } from "@/design/panel"
import { spacingUnits } from "@/design/spacing-units"

const plain = { shiftKey: false, altKey: false }
const shift = { shiftKey: true, altKey: false }
const alt = { shiftKey: false, altKey: true }

describe("scrubbing a number field", () => {
  it("moves one step for every two pixels and keeps the pixels left over", () => {
    expect(scrubbed({ value: 432, x: 100 }, 110, plain, 1)).toEqual({ value: 437, x: 110 })
    expect(scrubbed({ value: 432, x: 100 }, 103, plain, 1)).toEqual({ value: 433, x: 102 })
    expect(scrubbed({ value: 432, x: 100 }, 101, plain, 1)).toEqual({ value: 432, x: 100 })
    expect(scrubbed({ value: 432, x: 100 }, 95, plain, 1)).toEqual({ value: 430, x: 96 })
  })

  it("moves tens with Shift and tenths with Alt", () => {
    expect(scrubbed({ value: 432, x: 100 }, 104, shift, 1)).toEqual({ value: 452, x: 104 })
    expect(scrubbed({ value: 12, x: 100 }, 106, alt, 1)).toEqual({ value: 12.3, x: 106 })
    expect(scrubbed({ value: 0.3, x: 100 }, 96, alt, 1)).toEqual({ value: 0.1, x: 96 })
  })

  it("steps by the field's own step", () => {
    expect(scrubbed({ value: 50, x: 0 }, 4, plain, 5)).toEqual({ value: 60, x: 4 })
  })
})

describe("scrubbing past a limit", () => {
  it("anchors at the limit, so dragging back moves the value at once", () => {
    const past = scrubbed({ value: 100, x: 0 }, 400, plain, 1)
    expect(past.value).toBe(300)
    const held = scrubAfter(past, 100)
    expect(held).toEqual({ value: 100, x: 400 })
    expect(scrubbed(held, 300, plain, 1).value).toBe(50)
    expect(scrubAfter(past, 300)).toBe(past)
  })
})

describe("a preset list", () => {
  const steps = [100, 75, 50, 25, 10, 0]

  it("marks the preset that matches the field and marks nothing else", () => {
    expect(chosenStep("75", steps)).toBe(75)
    expect(chosenStep("10", steps)).toBe(10)
    expect(chosenStep("37", steps)).toBeNull()
    expect(chosenStep("", steps)).toBeNull()
    expect(chosenStep("8", [0, 4, 8, 16])).toBe(8)
    expect(chosenStep("80", [0, 4, 8, 16])).toBeNull()
  })
})

describe("letter spacing", () => {
  it("shows a whole percent of the size, as Figma does, so a title's -1.5 px at 88 reads -2%", () => {
    const control = {
      desc: { kind: "number", unit: "emu", min: -100_000, max: 100_000 },
      value: -150,
      mixed: false,
      ...spacingUnits("text", "letterSpacing", 8800),
    } as unknown as PanelControl
    expect(numberShown(control).text).toBe("-2")
  })

  it("writes nothing on Enter in an untouched rounded field, and steps and scrubs from the stored value", () => {
    const control = {
      desc: { kind: "number", unit: "emu", min: -100_000, max: 100_000 },
      value: -150,
      mixed: false,
      ...spacingUnits("text", "letterSpacing", 8800),
    } as unknown as PanelControl
    const shown = numberShown(control)
    const read = (text: string) => typedNumber(text, {})
    expect(untouched(shown.text, shown)).toBe(true)
    expect(shown.exact).toBeCloseTo(-1.7045, 4)
    expect(steppedFrom(shown.text, shown, read) + 1).toBeCloseTo(-0.7045, 4)
    expect(steppedFrom("-3", shown, read)).toBe(-3)
  })

  it("is clamped to Doom's limit and written, never dropped, when typed past it", () => {
    const control = {
      desc: { kind: "number", unit: "hundredth-point", min: -10_000, max: 10_000 },
      value: 0,
      mixed: false,
      ...spacingUnits("text", "letterSpacing", 200_000),
    } as unknown as PanelControl
    expect(storedFromTyped(control, 100)).toBe(10_000)
    expect(storedFromTyped(control, -100)).toBe(-10_000)
    expect(storedFromTyped(control, 3)).toBe(6_000)
  })
})

describe("a typed number past its range", () => {
  const ranged = (unit: string, min: number, max: number) =>
    ({ desc: { kind: "number", unit, min, max }, value: 0, mixed: false }) as unknown as PanelControl

  it("is clamped to the limit and stored, never dropped", () => {
    const size = ranged("hundredth-point", 100, 200_000)
    expect(storedFromTyped(size, 2001)).toBe(200_000)
    expect(storedFromTyped(size, 0)).toBe(100)
    const line = ranged("fraction", 50_000, 500_000)
    expect(storedFromTyped(line, 501)).toBe(500_000)
    expect(storedFromTyped(line, 1)).toBe(50_000)
    expect(storedFromTyped(line, Number.NaN)).toBeNull()
  })
})

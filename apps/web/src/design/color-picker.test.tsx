import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { themeColumns, type Palette } from "@/design/color-choices"
import { PickerBody } from "@/design/color-picker"

const hash = "#"

const palette: Palette = {
  theme: [
    { scheme: "dk1", css: "000000", name: "Dark 1" },
    { scheme: "lt1", css: "FFFFFF", name: "Light 1" },
    { scheme: "dk2", css: "000000", name: "Dark 2" },
    { scheme: "accent1", css: "4472C4", name: "Accent 1" },
  ],
  deck: ["C00000", "4472C4"],
  behind: "FFFFFF",
}

const tint = {
  scheme: "accent1",
  transforms: [
    { op: "lumMod", val: 60_000 },
    { op: "lumOff", val: 40_000 },
  ],
} as const

function buttons(markup: string): readonly { readonly name: string; readonly pressed: string }[] {
  return [...markup.matchAll(/<button[^>]*>/g)].map((tag) => ({
    name: /aria-label="([^"]*)"/.exec(tag[0])?.[1] ?? "",
    pressed: /aria-pressed="([^"]*)"/.exec(tag[0])?.[1] ?? "",
  }))
}

describe("the colour picker", () => {
  it("renders every theme colour and shade the model offers, then the deck's colours and a custom colour", () => {
    const markup = renderToStaticMarkup(<PickerBody value={tint} palette={palette} onPick={() => undefined} />)
    const offered = themeColumns(palette.theme).flatMap((column) => [column.swatch, ...column.shades])
    const shown = buttons(markup)
    expect(shown.map((button) => button.name)).toEqual([
      ...offered.map((choice) => choice.name),
      `${hash}C00000`,
      "Custom color",
    ])
    expect(shown.filter((button) => button.pressed === "true").map((button) => button.name)).toEqual([
      "Accent 1, lighter 40%",
    ])
    expect(markup).toContain('aria-label="Theme colors"')
    expect(markup).toContain('aria-label="In this deck"')
    expect(markup).toContain('aria-label="Saturation and brightness"')
    expect(markup).toContain('aria-label="Hue"')
    expect(markup).toContain('aria-label="Hex"')
    expect(markup).toContain(`value="${hash}8FAADC"`)
  })

  it("presses the custom colour for an rgb value and leaves out theme colours the field does not take", () => {
    const markup = renderToStaticMarkup(
      <PickerBody value={{ rgb: "1F4E79" }} palette={palette} theme={false} onPick={() => undefined} />,
    )
    expect(markup).not.toContain('aria-label="Theme colors"')
    expect(
      buttons(markup)
        .filter((button) => button.pressed === "true")
        .map((button) => button.name),
    ).toEqual(["Custom color"])
    expect(markup).toContain(`value="${hash}1F4E79"`)
  })

  it("rates a text colour against what sits behind it", () => {
    const fails = renderToStaticMarkup(
      <PickerBody value={{ rgb: "AAAAAA" }} palette={palette} contrast onPick={() => undefined} />,
    )
    expect(fails).toContain('data-contrast="fails"')
    expect(fails).toContain("Contrast 2.32:1")
    const passes = renderToStaticMarkup(
      <PickerBody value={{ scheme: "dk1" }} palette={palette} contrast onPick={() => undefined} />,
    )
    expect(passes).toContain('data-contrast="passes"')
    expect(passes).toContain("Passes AA")
  })
})

it("leaves the hex field empty when the field holds no known colour", () => {
  const markup = renderToStaticMarkup(<PickerBody value={undefined} palette={palette} onPick={() => undefined} />)
  expect(markup).toMatch(/aria-label="Hex"[^>]*value=""/)
})

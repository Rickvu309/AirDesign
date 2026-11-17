import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { colorCopy } from "@/copy/color-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import type { Palette } from "@/design/color-choices"
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

describe("the colour list", () => {
  it("shows the theme colours as plain swatches, then Add color and the deck, with no thirteenth colour and no tint rows", () => {
    const markup = renderToStaticMarkup(
      <PickerBody title="Fill" value={tint} palette={palette} onPick={() => undefined} />,
    )
    expect(markup).toContain("Fill")
    expect(markup).toContain(colorCopy.template)
    expect(markup).toContain(colorCopy.others)
    expect(markup).not.toContain(colorCopy.tints)
    expect(markup).not.toContain("lighter")
    expect(buttons(markup).map((button) => button.name)).toEqual([
      "Dark 1",
      "Light 1",
      "Dark 2",
      "Accent 1",
      colorCopy.add,
      `${hash}C00000`,
    ])
    expect(buttons(markup).filter((button) => button.pressed === "true")).toEqual([])
    expect(markup).not.toContain(`aria-label="${colorCopy.hue}"`)
  })

  it("opens Add color onto the picker, where the tint in use is pressed and the theme colours stay out of a hex field", () => {
    const open = renderToStaticMarkup(
      <PickerBody title="Fill" picking value={tint} palette={palette} onPick={() => undefined} />,
    )
    const pressed = buttons(open)
      .filter((button) => button.pressed === "true")
      .map((button) => button.name)
    expect(pressed).toEqual([colorCopy.lighter("Accent 1", 40)])
    expect(open).toContain(colorCopy.tints)
    expect(open).toContain(`aria-label="${colorCopy.area}"`)
    expect(open).toContain(`aria-label="${colorCopy.hue}"`)
    expect(open).toContain(`aria-label="${opacityCopy.label}"`)
    expect(open).toContain(`aria-label="${colorCopy.hex}"`)
    expect(open).toContain(`aria-label="${colorCopy.opacityPercent}"`)
    expect(open).toContain(`value="${hash}8FAADC"`)
    expect(open).toContain(colorCopy.moreTints)

    const hexOnly = renderToStaticMarkup(
      <PickerBody
        title="Accent 1"
        value={{ rgb: "1F4E79" }}
        palette={palette}
        theme={false}
        onPick={() => undefined}
      />,
    )
    expect(hexOnly).not.toContain(colorCopy.template)
    expect(hexOnly).toContain(colorCopy.add)
    const pickingHex = renderToStaticMarkup(
      <PickerBody
        title="Accent 1"
        picking
        value={{ rgb: "1F4E79" }}
        palette={palette}
        theme={false}
        onPick={() => undefined}
      />,
    )
    expect(pickingHex).not.toContain(colorCopy.tints)
    expect(pickingHex).toContain(`value="${hash}1F4E79"`)
  })

  it("offers a way to show the rest of the deck when one row of swatches is not enough", () => {
    const many: Palette = {
      theme: palette.theme,
      deck: Array.from({ length: 20 }, (_, index) => (index + 1).toString(16).padStart(6, "0").toUpperCase()),
    }
    const markup = renderToStaticMarkup(
      <PickerBody title="Fill" value={undefined} palette={many} onPick={() => undefined} />,
    )
    expect(markup).toContain(colorCopy.moreOthers)
    const others = markup.split(`aria-label="${colorCopy.others}"`)[1] ?? ""
    const shown = buttons(others).filter((button) => button.name.startsWith(hash))
    expect(shown).toHaveLength(17)
  })
})

it("leaves the hex field empty when Add color opens on no known colour", () => {
  const markup = renderToStaticMarkup(
    <PickerBody title="Fill" picking value={undefined} palette={palette} onPick={() => undefined} />,
  )
  expect(markup).toMatch(/aria-label="Hex"[^>]*value=""/)
})

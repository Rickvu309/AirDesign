import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { colorCopy } from "@/copy/color-copy"
import { colorNameCopy } from "@/copy/color-name-copy"
import type { Palette } from "@/design/color-choices"
import { namedByColor } from "@/design/color-names"
import { PickerBody } from "@/design/color-picker"

const palette: Palette = {
  templateColors: namedByColor([
    { var: "text" as const, css: "000000" },
    { var: "background" as const, css: "FFFFFF" },
    { var: "text2" as const, css: "000000" },
    { var: "accent1" as const, css: "4472C4" },
  ]),
  deck: ["C00000", "4472C4"],
}

const hash = "#"

const tint = { var: "accent1", tint: 0.4 } as const

function buttons(markup: string): readonly { readonly name: string; readonly pressed: string }[] {
  return [...markup.matchAll(/<button[^>]*>/g)].map((tag) => ({
    name: /aria-label="([^"]*)"/.exec(tag[0])?.[1] ?? "",
    pressed: /aria-pressed="([^"]*)"/.exec(tag[0])?.[1] ?? "",
  }))
}

describe("the colour list", () => {
  it("shows the template colors as plain swatches, then Add color and the deck, with no thirteenth colour and no tint rows", () => {
    const markup = renderToStaticMarkup(
      <PickerBody title="Fill" value={tint} palette={palette} onPick={() => undefined} />,
    )
    expect(markup).toContain("Fill")
    expect(markup).toContain(colorCopy.template)
    expect(markup).toContain(colorCopy.others)
    expect(markup).not.toContain(colorCopy.tints)
    expect(markup).not.toContain("lighter")
    expect(buttons(markup).map((button) => button.name)).toEqual([
      colorNameCopy.black,
      colorNameCopy.white,
      colorNameCopy.numbered(colorNameCopy.black, 2),
      colorNameCopy.blue,
      colorCopy.add,
      "C00000",
    ])
    expect(buttons(markup).filter((button) => button.pressed === "true")).toEqual([])
    expect(markup).not.toContain(`aria-label="${colorCopy.hue}"`)
  })

  it("opens Add color onto the picker, where the tint in use is pressed and the template colors stay out of a hex field", () => {
    const open = renderToStaticMarkup(
      <PickerBody title="Fill" picking value={tint} palette={palette} onPick={() => undefined} />,
    )
    const pressed = buttons(open)
      .filter((button) => button.pressed === "true")
      .map((button) => button.name)
    expect(pressed).toEqual([colorCopy.lighter(colorNameCopy.blue, 40)])
    expect(open).toContain(colorCopy.tints)
    expect(open).toContain(`aria-label="${colorCopy.area}"`)
    expect(open).toContain(`aria-label="${colorCopy.hue}"`)
    expect(open).toContain(`aria-label="${colorCopy.hex}"`)
    expect(open).not.toContain(`aria-label="${colorCopy.opacityPercent}"`)
    expect(open).toContain(`value="8FAADC"`)
    expect(open).toContain(colorCopy.moreTints)

    const bare: Palette = { templateColors: [], deck: palette.deck }
    const hexOnly = renderToStaticMarkup(
      <PickerBody title={colorNameCopy.blue} value={`${hash}1f4e79`} palette={bare} onPick={() => undefined} />,
    )
    expect(hexOnly).not.toContain(colorCopy.template)
    expect(hexOnly).toContain(colorCopy.add)
    const pickingHex = renderToStaticMarkup(
      <PickerBody title={colorNameCopy.blue} picking value={`${hash}1f4e79`} palette={bare} onPick={() => undefined} />,
    )
    expect(pickingHex).not.toContain(colorCopy.tints)
    expect(pickingHex).toContain(`value="1F4E79"`)
  })

  it("starts Add color at the held semantic tint and keeps semantic roles out of the grid", () => {
    const signed = {
      ...palette,
      templateColors: [...palette.templateColors, { var: "positive", css: "007E6E", name: "Dark teal" }],
    } satisfies Palette
    const value = { var: "positive", tint: 0.2 } as const
    const list = renderToStaticMarkup(
      <PickerBody title="Fill" value={value} palette={signed} onPick={() => undefined} />,
    )
    expect(buttons(list)).not.toContainEqual(expect.objectContaining({ name: "Dark teal" }))
    const picking = renderToStaticMarkup(
      <PickerBody title="Fill" picking value={value} palette={signed} onPick={() => undefined} />,
    )
    expect(picking).toContain('value="33988B"')
  })

  it("offers a way to show the rest of the deck when one row of swatches is not enough", () => {
    const many: Palette = {
      templateColors: palette.templateColors,
      deck: Array.from({ length: 20 }, (_, index) => (index + 1).toString(16).padStart(6, "0").toUpperCase()),
    }
    const markup = renderToStaticMarkup(
      <PickerBody title="Fill" value={undefined} palette={many} onPick={() => undefined} />,
    )
    expect(markup).toContain(colorCopy.moreOthers)
    const others = markup.split(`aria-label="${colorCopy.others}"`)[1] ?? ""
    const shown = buttons(others).filter((button) => /^[0-9A-F]{6}$/.test(button.name))
    expect(shown).toHaveLength(17)
  })
})

it("leaves the hex field empty when Add color opens on no known colour", () => {
  const markup = renderToStaticMarkup(
    <PickerBody title="Fill" picking value={undefined} palette={palette} onPick={() => undefined} />,
  )
  expect(markup).toMatch(/aria-label="Hex"[^>]*value=""/)
})

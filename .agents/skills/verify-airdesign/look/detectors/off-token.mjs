export const offToken = {
  name: "off-token",
  rank: 3,
  reads:
    "the color, background, font size, corner radius, padding and gap of product chrome, against the values packages/theme defines",
  cannot: "whether an exception was meant; runs only with --off-token",
  inspect: (element, page) => {
    const tokens = page.options.tokens
    if (!tokens || page.content(element) || page.thumbnail(element)) return
    const style = page.style(element)
    const checks = [
      ["color", tokens.colors, page.ownText(element) !== ""],
      ["background-color", tokens.colors, page.rgba(style.backgroundColor)[3] > 0],
      ["font-size", tokens.sizes, page.ownText(element) !== ""],
      ["border-top-left-radius", tokens.radii, style.borderTopLeftRadius !== "0px"],
      ...["padding-top", "padding-right", "padding-bottom", "padding-left", "row-gap", "column-gap"].map((name) => [
        name,
        tokens.spaces,
        !["0px", "normal"].includes(style.getPropertyValue(name)),
      ]),
    ]
    const off = checks
      .filter(([name, values, used]) => used && !values.includes(style.getPropertyValue(name)))
      .map(([name]) => `${name} ${style.getPropertyValue(name)}`)
    if (off.length === 0) return
    return `Not a theme token: ${off.join("; ")}.`
  },
}

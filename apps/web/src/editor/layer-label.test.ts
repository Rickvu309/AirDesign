import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { layerLabel } from "./layer-label"

const grown = doom.doomFromTree({
  theme: doom.defaultTheme,
  slides: [
    {
      children: [
        { type: "shape", name: "Revenue", props: { text: doom.textFromMarkdown("$4.2M", "body") } },
        {
          type: "shape",
          props: { text: doom.textFromMarkdown(`Churn fell ${"by a lot ".repeat(8)}\nsecond line`, "body") },
        },
        { type: "shape", props: { fills: [{ kind: "solid", color: { var: "accent1" } }] } },
      ],
    },
  ],
})
const [named, worded, plain] = grown.doom.children.get(grown.slides[0]!) ?? []

describe("a layer's label in Aira's undo line", () => {
  it("quotes its name, else the start of its first line of words, else names its kind", () => {
    expect(layerLabel(grown.doom, named!)).toBe("“Revenue”")
    expect(layerLabel(grown.doom, worded!)).toBe("“Churn fell by a lot by a lot by a lot by…”")
    expect(layerLabel(grown.doom, plain!)).toBe("a shape")
  })
})

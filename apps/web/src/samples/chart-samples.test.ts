import * as doom from "@airdesign/doom"
import { expect, it } from "vitest"
import { barCharts } from "./slides/bar-charts"

it("shows quarterly stacked revenue in thousands while retaining millions for the ranking", () => {
  const { doom: deck, ids } = doom.doomFromTree({ theme: doom.defaultTheme, slides: [barCharts()] })
  const words = (name: string) =>
    doom.descendantsOf(deck, ids[name]!).flatMap((node) => doom.propOf(node, "text")?.chars ?? [])
  expect(words("ranking")).toEqual([
    "Net new revenue by segment, 2025, $M",
    "Enterprise",
    "1.9",
    "Mid-market",
    "1.2",
    "Small business",
    "0.7",
    "Public sector",
    "0.5",
    "Partners",
    "0.3",
  ])
  expect(words("quarterly")).toContain("Revenue by quarter, 2025, $K")
  expect(words("quarterly")).toEqual(expect.arrayContaining(["720", "200", "800", "240", "880", "290", "970", "340"]))
})

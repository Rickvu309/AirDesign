import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { gridNeeds } from "./answer.js"
import { problemNote } from "./problem-words.js"
import { testTheme } from "@airdesign/doom/testing"

const grown = doom.doomFromTree({
  theme: testTheme,
  slides: [
    {
      children: [
        { type: "shape", name: "Region", props: {} },
        { type: "shape", name: "Note rule", props: {} },
        { type: "shape", props: {} },
      ],
    },
  ],
})
const fold = grown.doom
const region = grown.ids.Region!
const rule = grown.ids["Note rule"]!
const id = "t:6" as doom.NodeId
const theme = doom.deckOf(fold).theme

describe("the agent words each problem Doom measures", () => {
  it.each<[string, doom.LayoutProblem | doom.ThemeProblem, string]>([
    [
      "spilled words",
      { code: "overflow", node: id, need: 60, room: 30 },
      "t:6: its words need 60 px of height and its box holds 30, so they spill out; make the box at least 60 tall or cut words.",
    ],
    [
      "a label cut on its width",
      { code: "overflow", node: id, need: 320, room: 200, ellipsis: "w" },
      "t:6: the label was shortened to fit. Use fewer words or make the box wider.",
    ],
    [
      "a label cut on its height",
      { code: "overflow", node: id, need: 90, room: 30, ellipsis: "h" },
      "t:6: the label was shortened to fit. Use fewer words or make the box taller.",
    ],
    [
      "a label cut that a taller box would not help",
      { code: "overflow", node: id, need: 30, room: 30, ellipsis: "h" },
      "t:6: the label was shortened to fit. Use fewer words.",
    ],
    [
      "an overlap",
      { code: "overlap", node: id, with: "t:7" as doom.NodeId, area: { x: 100, y: 140, w: 44, h: 15 } },
      "t:6: its words and t:7 overlap over 44x15 px at 100,140; move one clear of the other.",
    ],
    [
      "a line across named words",
      { code: "line-crosses-text", node: region, with: rule },
      `Move Note rule (${rule}) so it no longer crosses Region (${region}).`,
    ],
    [
      "a line across an unnamed layer",
      { code: "line-crosses-text", node: id, with: rule },
      `Move Note rule (${rule}) so it no longer crosses t:6.`,
    ],
    [
      "a layer past the edge",
      { code: "off-slide", node: id, past: 40, whole: false },
      "t:6: it runs 40 px past the slide's edge, where the slide cuts it off.",
    ],
    [
      "a layer wholly off the slide",
      { code: "off-slide", node: id, past: 3000, whole: true },
      "t:6: it lies wholly off the slide, where no one sees it.",
    ],
    [
      "small text",
      { code: "small-text", node: id, size: 14, min: 20 },
      "t:6: text at 14 px is under the 20 px a room can read on this slide.",
    ],
    [
      "a lone word a wider box keeps",
      { code: "lone-word", node: id, extra: 13 },
      "t:6: Shorten the text or widen its box by 13 px to keep the last word with the rest.",
    ],
    [
      "a lone word no box keeps",
      { code: "lone-word", node: id, extra: 0 },
      "t:6: Shorten the text to keep the last word with the rest.",
    ],
    [
      "a size off the scale",
      { code: "off-scale", node: id, size: 72, style: "bigNumber", to: 80 },
      "t:6: size 72 is off the deck's type scale; the nearest text style is bigNumber (80).",
    ],
    [
      "a colour off the palette",
      { code: "off-palette", node: id, color: theme.colors.accent4, to: "accent5" },
      `t:6: ${theme.colors.accent4} is not a theme colour, so a new template will not recolour it; the nearest is accent5 (${theme.colors.accent5}).`,
    ],
    [
      "a font off the theme",
      { code: "off-font", node: id, font: "Comic Neue", to: ["Inter", "Lora"] },
      "t:6: Comic Neue is not the deck's heading or body font (Inter, Lora).",
    ],
  ])("says what to fix for %s", (_, problem, words) => {
    expect(problemNote(fold, problem)).toBe(words)
  })
})

describe("the agent words a grid too tight for its box", () => {
  const cell = { row: 0, col: 1, word: "Pneumonoultramicroscopicsilicovolcanoconiosis", needs: 564, room: 71 }

  it("names the row, the column and the word of the first cell too narrow for its word", () => {
    expect(gridNeeds({ cell, more: 0, style: "caption" })).toBe(
      "a shorter word than “Pneumonoultramicroscopicsilicovolcanoconiosis” in row 1, column 2, which needs 564 px at caption size in a column of 71 px; or fewer columns or a wider box",
    )
  })

  it("counts the other cells too narrow for their words", () => {
    expect(gridNeeds({ cell, more: 1, style: "caption" })).toContain("71 px (and 1 more cell); or fewer columns")
    expect(gridNeeds({ cell, more: 3, style: "caption" })).toContain("71 px (and 3 more cells); or fewer columns")
  })

  it("names the rows and the height when every word fits but the rows do not", () => {
    expect(gridNeeds({ rows: 30, needs: 1771, room: 400, style: "caption" })).toBe(
      "fewer than 30 rows or a taller box: at caption size they need 1771 px and the box has 400 px",
    )
  })
})

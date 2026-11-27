import * as doom from "@airdesign/doom"
import { testTheme } from "@airdesign/doom/testing"

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const words = (markdown: string, style: doom.TextStyleName = "body") => doom.textFromMarkdown(markdown, style)
const padding = { t: 16, r: 16, b: 16, l: 16 }

const grown = doom.doomFromTree({
  theme: testTheme,
  slides: [
    {
      name: "Opening",
      children: [
        {
          type: "shape",
          name: "Opening title",
          props: { role: "title", box: box(160, 380, 1600, 160), text: words("Q3 plan", "title") },
        },
        {
          type: "shape",
          name: "Opening subtitle",
          props: { box: box(160, 560, 1600, 80), text: words("Draft", "heading") },
        },
      ],
    },
    {
      name: "Numbers",
      children: [
        {
          type: "shape",
          name: "Numbers title",
          props: { role: "title", box: box(80, 60, 1760, 90), text: words("Numbers", "title") },
        },
        {
          type: "frame",
          name: "Card",
          props: { box: box(80, 200, 600, 300), layout: { mode: "column", gap: 8, padding, align: "top-left" } },
          children: [
            {
              type: "shape",
              name: "Revenue label",
              props: { sizing: { w: "fill", h: "hug" }, text: words("Revenue") },
            },
            {
              type: "shape",
              name: "Revenue value",
              props: { sizing: { w: "fill", h: "hug" }, text: words("$4.2M", "bigNumber") },
            },
          ],
        },
        {
          type: "shape",
          name: "Note",
          props: { box: box(760, 200, 1000, 120), text: words("Plan was $3.8M", "caption") },
        },
      ],
    },
    {
      name: "Roadmap",
      children: [
        {
          type: "shape",
          name: "Roadmap title",
          props: { role: "title", box: box(80, 60, 1760, 90), text: words("Roadmap", "title") },
        },
      ],
    },
  ],
})

export const evalDeck = (): doom.Doom => grown.doom

export const ids = grown.ids

export const slides = {
  opening: ids["Opening"]!,
  numbers: ids["Numbers"]!,
  roadmap: ids["Roadmap"]!,
}

export const named = {
  title: ids["Opening title"]!,
  subtitle: ids["Opening subtitle"]!,
  card: ids["Card"]!,
  label: ids["Revenue label"]!,
  value: ids["Revenue value"]!,
  note: ids["Note"]!,
}

const opened = doom.doomFromTree({
  theme: testTheme,
  slides: [
    {
      name: "Opening",
      children: [
        {
          type: "shape",
          name: "Opening title",
          props: { role: "title", box: box(160, 380, 1600, 160), text: words("Untitled", "title") },
        },
      ],
    },
  ],
})

export const blankDeck = (): doom.Doom => opened.doom

export const blank = { title: opened.ids["Opening title"]! }

export const person: doom.Author = { kind: "person", id: "quan" }

export const revOfDeck = grown.doom.rev

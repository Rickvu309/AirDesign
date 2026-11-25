import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { deckLocale, DoomSlide } from "./index.js"

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

const spot = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })

describe("DoomSlide", () => {
  it("paints the slide at the width it is given, scaled from the deck's size, once its text is measured", async () => {
    const grown = doom.doomFromTree({
      theme: doom.defaultTheme,
      slides: [
        {
          children: [
            {
              type: "shape",
              name: "words",
              props: {
                box: spot(100, 100, 600, 100),
                text: { chars: "Revenue", spans: [], paras: [{}], style: "title", resize: "height", alignV: "top" },
              },
            },
            {
              type: "shape",
              name: "box",
              props: { box: spot(100, 300, 200, 100), fills: [{ kind: "solid", color: { var: "accent1" } }] },
            },
          ],
        },
      ],
    })
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    roots.push(root)
    await act(async () =>
      root.render(createElement(DoomSlide, { doom: grown.doom, slide: grown.slides[0]!, width: 960 })),
    )
    const slide = host.querySelector<HTMLElement>("[data-doom-slide]")
    expect(slide?.style.width).toBe("960px")
    expect(slide?.style.height).toBe("540px")
    expect(host.querySelector("[data-fonts-pending]")).toBeNull()
    expect(host.querySelectorAll("[data-node]")).toHaveLength(2)
    expect(host.querySelector("[data-line]")?.textContent).toBe("Revenue")
    expect(slide?.firstElementChild?.getAttribute("style")).toContain("scale(0.5)")
  })
})

it("keeps the deck locale while typing and rechecks it when a draft changes the deck's language evidence", () => {
  const base = doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "words",
            props: { box: spot(100, 100, 600, 100), text: doom.textFromMarkdown("まとめ", "title") },
          },
          {
            type: "shape",
            name: "title",
            props: { box: spot(100, 220, 600, 100), text: doom.textFromMarkdown("東京本社", "title") },
          },
        ],
      },
    ],
  })
  const draft = (layer: doom.NodeId, chars: string) =>
    doom.viewOf(base.doom, [
      {
        once: "typing",
        author: { kind: "person", id: "typist" },
        writes: [{ node: layer, prop: "text", value: doom.textFromMarkdown(chars, "title") }],
      },
    ])
  const { words, title } = base.ids
  if (words === undefined || title === undefined) throw new Error("Missing text layers")
  expect(deckLocale(draft(title, "営業報告"), { before: base.doom, layer: title })).toBe("ja")
  expect(deckLocale(draft(words, "Summary"), { before: base.doom, layer: words })).toBe("und")
})

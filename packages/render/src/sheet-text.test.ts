import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import type { CanvasText } from "./record.js"
import { SheetText } from "./sheet-text.js"
import { textLook } from "./text-look.js"

afterEach(() => {
  document.body.replaceChildren()
})

const style = {
  font: null,
  size: 254_000,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  baseline: 0,
  color: null,
}
const file: CanvasText = {
  paragraphs: [0, 1, 2].map((from) => ({ from, align: "left", runs: [], endStyle: style })),
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
}

it("paints a thumbnail's numbered list items at their levels with each level's numbering", async () => {
  const host = document.createElement("div")
  document.body.append(host)
  const paragraphs = [0, 1, 2].map((from) => ({
    from,
    list: "numbers" as const,
    ...(from === 0 ? {} : { level: from }),
    runs: [{ from: 0, text: "Item" }],
  }))
  await act(async () => {
    createRoot(host).render(
      createElement(SheetText, { text: { paragraphs }, look: textLook(file, (emu) => emu / 12_700) }),
    )
  })
  const blocks = [...host.querySelectorAll<HTMLElement>("[data-paragraph]")]
  expect(blocks.map((block) => block.style.getPropertyValue("--bullet"))).toEqual(['"1."', '"a."', '"i."'])
  expect(blocks.map((block) => block.style.paddingLeft)).toEqual(["36px", "72px", "108px"])
})

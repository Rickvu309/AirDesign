import * as doom from "@airdesign/doom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { expect, it } from "vitest"
import { TextLines } from "./node-text.js"

const run = (figures?: "tabular"): doom.ResolvedRun => ({
  text: "11.1",
  size: 32,
  font: "Inter",
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: doom.defaultTheme.colors.text,
  tracking: 0,
  ...(figures === undefined ? {} : { figures }),
})

it("paints tabular figures only on the runs that ask for them", async () => {
  const host = document.createElement("div")
  const root = createRoot(host)
  const line = { start: 0, end: 4, x: 0, y: 0, w: 100, h: 40, ink: 60, align: "right" as const }
  await act(async () => root.render(createElement(TextLines, { lines: [{ ...line, runs: [run("tabular"), run()] }] })))
  const [tabular, proportional] = [...host.querySelectorAll<HTMLElement>("[data-run]")]
  expect(tabular?.style.fontVariantNumeric).toBe("tabular-nums")
  expect(proportional?.style.fontVariantNumeric).toBe("")
  await act(async () => root.unmount())
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { designCopy } from "@/copy/design-copy"
import { TemplateStyleCard } from "./template-style-card"

it.each([
  [null, null, null, designCopy.currentTheme, designCopy.themeFontsMissing],
  ["Imported", "Inter", "Inter", "Imported", "Inter"],
  ["Imported", "游明朝", "Arial", "Imported", designCopy.themeFonts("游明朝", "Arial")],
])("shows the current name and fonts without inventing template identity", (name, major, minor, title, fonts) => {
  const html = renderToStaticMarkup(
    createElement(TemplateStyleCard, {
      style: { name, major, minor, swatches: [] },
      open: false,
      onOpen: () => {},
    }),
  )
  expect(html).toContain(title)
  expect(html).toContain(fonts)
  expect(html).toContain('aria-expanded="false"')
})

it("draws the template name heavier and larger than its font line", () => {
  const html = renderToStaticMarkup(
    createElement(TemplateStyleCard, {
      style: { name: "Light slides", major: "Inter", minor: "Inter", swatches: [] },
      open: false,
      onOpen: () => {},
    }),
  )
  const name = html.match(/<span class="([^"]*)" title="Light slides">/)
  const fonts = html.match(/<span class="([^"]*)" title="Inter">/)
  expect(name?.[1]).toContain("font-semibold")
  expect(html).toContain("text-[length:var(--panel-control-size)]")
  expect(fonts?.[1]).toContain("text-[length:var(--panel-card-meta)]")
  expect(fonts?.[1]).not.toContain("font-semibold")
  expect(fonts?.[1]).not.toContain("text-quiet")
})

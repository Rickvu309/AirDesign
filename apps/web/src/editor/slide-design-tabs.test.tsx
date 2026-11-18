import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { transitionCopy } from "@/copy/transition-copy"
import { SlideDesignTabs } from "./slide-design-tabs"

it("keeps the selected tab edge inside the tab so it does not paint on the title", () => {
  const html = renderToStaticMarkup(createElement(SlideDesignTabs, { tab: "design", onTab: () => {} }))
  const selected = html.slice(html.indexOf(`aria-selected="true"`), html.indexOf(transitionCopy.design))
  expect(selected).toContain("shadow-[inset_0px_0px_0px_1px_var(--field-edge)]")
  expect(selected).not.toContain("shadow-[0px_0px_0px_1px_var(--field-edge)]")
})

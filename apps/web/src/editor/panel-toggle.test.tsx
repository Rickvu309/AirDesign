import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { PanelToggle } from "./panel-toggle"

const html = (open: boolean, working: boolean) =>
  renderToStaticMarkup(<PanelToggle open={open} working={working} onOpen={() => {}} />)

it("keeps one name and says whether the panel is open", () => {
  expect(html(true, false)).toMatch(/aria-label="Side panel"[^>]*aria-expanded="true"/)
  expect(html(false, false)).toMatch(/aria-label="Side panel"[^>]*aria-expanded="false"/)
})

it("shows that Aira is working only while the panel is closed", () => {
  expect(html(false, true)).toContain("data-panel-working")
  expect(html(true, true)).not.toContain("data-panel-working")
  expect(html(false, false)).not.toContain("data-panel-working")
})

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PanelSwitch } from "./panel-switch"

describe("panel switch", () => {
  it("lets the design screens pick either panel", () => {
    const html = renderToStaticMarkup(<PanelSwitch active="agent" onPick={() => {}} />)
    expect(html).not.toContain(`disabled=""`)
    expect(html).toContain("Design")
  })

  it("marks the panel that shows as pressed", () => {
    const html = renderToStaticMarkup(<PanelSwitch active="design" onPick={() => {}} />)
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[^]*Design/)
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>[^]*Agent/)
  })
})

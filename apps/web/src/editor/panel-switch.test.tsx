import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PanelSwitch } from "./panel-switch"

describe("panel switch", () => {
  it("lets the design screens pick either panel", () => {
    const html = renderToStaticMarkup(<PanelSwitch active="agent" onPick={() => {}} />)
    expect(html).not.toContain(`disabled=""`)
    expect(html).toContain("Design")
  })

  it("shows Design disabled, and says why in its name, when the deck has no design panel yet", () => {
    const html = renderToStaticMarkup(<PanelSwitch active="agent" designOff onPick={() => {}} />)
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="Design, not available yet"|<button[^>]*aria-label="Design, not available yet"[^>]*disabled=""/,
    )
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[^]*Agent/)
  })
})

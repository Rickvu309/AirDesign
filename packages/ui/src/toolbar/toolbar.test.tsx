import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { Toolbar } from "./toolbar.tsx"

let root: Root | null = null

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  document.body.innerHTML = ""
})

describe("toolbar", () => {
  it("keeps one tab stop and moves with arrows", async () => {
    document.body.innerHTML = `<div id="root"></div>`
    const host = document.getElementById("root")
    if (!host) {
      throw new Error("missing root")
    }
    root = createRoot(host)
    await act(async () => {
      root?.render(<Toolbar label="Home" items={[
        { id: "home", label: "Home", onSelect: () => undefined },
        { id: "next", label: "Next", onSelect: () => undefined },
      ]} />)
    })
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")]
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
    expect(buttons[0]?.tabIndex).toBe(0)
    await act(async () => {
      buttons[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
    const moved = [...document.querySelectorAll<HTMLButtonElement>("button")]
    expect(moved[1]?.tabIndex).toBe(0)
    expect(moved[0]?.tabIndex).toBe(-1)
  })
})

import { useState } from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { AlertDialog } from "./alert-dialog.tsx"

let root: Root | null = null

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  root = null
  document.body.innerHTML = ""
})

describe("alert dialog", () => {
  it("moves focus into the dialog and returns it on escape", async () => {
    document.body.innerHTML = `<div id="root"></div>`
    const host = document.getElementById("root")
    if (!host) {
      throw new Error("missing root")
    }
    root = createRoot(host)
    await act(async () => {
      root?.render(<DialogHarness />)
    })
    const trigger = document.querySelector<HTMLButtonElement>("[data-trigger]")
    trigger?.focus()
    await act(async () => {
      trigger?.click()
    })
    const dialog = document.querySelector("[role=dialog]")
    expect(dialog).not.toBeNull()
    expect(dialog?.contains(document.activeElement)).toBe(true)
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" data-trigger="" onClick={() => setOpen(true)}>Open</button>
      <AlertDialog open={open} title="Sign out?" body="This ends the session on this device." onClose={() => setOpen(false)} secondary={{ label: "Cancel" }} primary={{ label: "Sign out", danger: true, onClick: () => setOpen(false) }} />
    </>
  )
}

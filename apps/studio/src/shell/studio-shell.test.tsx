import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { StudioShell } from "./studio-shell.tsx"

it("exposes account actions, real starred decks, search and the current navigation destination", async () => {
  history.replaceState(null, "", "/trash")
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host), signOut = vi.fn(), search = vi.fn()
  try {
    await act(async () => root.render(<StudioShell accountName="Ada Lovelace" search="strategy" onSearch={search} intentLabel="Home" showIntent={false} onSignOut={signOut} starredDecks={[{ id: "atlas", title: "Project Atlas" }]}><h1>Trash</h1></StudioShell>))
    const current = host.querySelector('[aria-current="page"]')
    expect(current?.textContent).toBe("Trash")
    expect(host.querySelector('a[href="/deck/atlas"]')?.textContent).toBe("Project Atlas")
    const account = host.querySelector<HTMLDetailsElement>(".ad-account details")!
    const trigger = account.querySelector("summary")!
    await act(async () => trigger.click())
    expect(account.open).toBe(true)
    expect(account.querySelector('a[href="/settings/account"]')).not.toBeNull()
    await act(async () => account.querySelector("button")!.click())
    expect(signOut).toHaveBeenCalledOnce()
    expect(account.open).toBe(false)
    await act(async () => trigger.click())
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(account.open).toBe(false)
    expect(document.activeElement).toBe(trigger)
    await act(async () => trigger.click())
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })))
    expect(account.open).toBe(false)
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(input.value).toBe("strategy")
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "revenue")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(search).toHaveBeenCalledWith("revenue")
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    host.remove()
    history.replaceState(null, "", "/")
  }
})

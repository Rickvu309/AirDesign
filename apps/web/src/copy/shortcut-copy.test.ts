import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it.each(["MacIntel", "Win32", "Linux x86_64"])("names the implemented modifier on %s", async (platform) => {
  vi.stubGlobal("navigator", { platform })
  const { slideListCopy } = await import("./slide-list-copy")
  const { arrangeCopy, groupCopy } = await import("./arrange-copy")
  const mac = platform === "MacIntel"
  expect(slideListCopy.duplicateKey).toBe(mac ? "⌘D" : "Ctrl+D")
  expect(arrangeCopy.shortcut.forward).toBe(mac ? "⌘]" : "Ctrl+]")
  expect(arrangeCopy.shortcut.back).toBe(mac ? "⇧⌘[" : "Ctrl+Shift+[")
  expect(groupCopy.shortcut.ungroup).toBe(mac ? "⇧⌘G" : "Ctrl+Shift+G")
})

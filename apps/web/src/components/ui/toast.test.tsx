import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { toast as sonner, type ToastT } from "sonner"
import { afterEach, expect, it, vi } from "vitest"
import { toast } from "./toast"

afterEach(() => sonner.dismiss())

it("closes a refusal after Figma's 3 seconds as one plain pill with no close control", () => {
  const id = toast.refusal("Layer stays")
  const entry = sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .find((entry) => entry.id === id)
  expect(entry).toMatchObject({ duration: 3000, unstyled: true })
  const drawn = renderToStaticMarkup(createElement("div", null, entry?.jsx))
  expect(drawn).toContain("Layer stays")
  expect(drawn).not.toContain("<button")
})

it("keeps custom action notices available with a named close control", () => {
  const id = toast.notice(() => createElement("button", null, "Undo"), { duration: 9000 })
  const entry = sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .find((entry) => entry.id === id)
  expect(entry?.duration).toBe(Infinity)
  const html = renderToStaticMarkup(createElement("div", null, entry?.jsx))
  expect(html).toContain('aria-label="Close"')
  expect(html).toContain("bg-foreground")
})

it("gives a light notice a light close control instead of a solid dark button", () => {
  const id = toast.notice(() => createElement("button", null, "Try again"), { tone: "light" })
  const entry = sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .find((entry) => entry.id === id)
  const html = renderToStaticMarkup(createElement("div", null, entry?.jsx))
  expect(html).toContain('aria-label="Close"')
  expect(html).toContain("bg-background")
  expect(html).not.toContain("bg-foreground")
})

function shown(id: string | number): ToastT | undefined {
  return sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .findLast((entry) => entry.id === id)
}

it("shows a notice again as a new toast once the person closed it, so the closing one cannot take it away", () => {
  const first = toast.custom(() => createElement("p", null, "Unable to save"), {
    id: "notes-refused",
    duration: Infinity,
  })
  const closed = shown(first)
  if (closed === undefined) throw new Error("no notice")
  closed.onDismiss?.(closed)
  const show = () =>
    toast.custom(() => createElement("p", null, "Unable to save"), { id: "notes-refused", duration: Infinity })
  const again = show()
  expect(again).not.toBe(first)
  expect(shown(again)).toMatchObject({ duration: Infinity })
  expect(show()).toBe(again)
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    frame(0)
    return 0
  })
  try {
    toast.dismiss("notes-refused")
  } finally {
    vi.unstubAllGlobals()
  }
  expect(sonner.getToasts().some((entry) => entry.id === again)).toBe(false)
})

it("shows a notice again as a new toast once it closed by itself", () => {
  const first = toast.refusal("Unable to delete", { id: "remove-refused" })
  const closed = shown(first)
  if (closed === undefined) throw new Error("no notice")
  closed.onAutoClose?.(closed)
  expect(toast.refusal("Unable to delete", { id: "remove-refused" })).not.toBe(first)
})

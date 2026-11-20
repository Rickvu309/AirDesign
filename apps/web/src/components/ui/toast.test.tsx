import { tellRefusal } from "@/editor/use-deck-status"
import { productCopy } from "@/copy/product-copy"
import { elementCopy } from "@/copy/element-copy"
import { commitElement } from "@/element-edit"
import { onSlide, twoBoxSlide, xml } from "@/slide-fixtures"
import { elementId, openRegister } from "@airdesign/document"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { toast as sonner, type ToastT } from "sonner"
import { afterEach, expect, it, vi } from "vitest"
import { toast } from "./toast"

afterEach(() => sonner.dismiss())

it("keeps a recovery error dismissible even when a caller asks for a short lifetime", () => {
  const id = toast.error("Copy your notes and reload", { duration: 4000, closeButton: false })
  expect(
    sonner
      .getHistory()
      .filter((entry): entry is ToastT => !("dismiss" in entry))
      .find((entry) => entry.id === id),
  ).toMatchObject({
    duration: Infinity,
    closeButton: true,
    dismissible: true,
  })
})

it("closes a refusal the person cannot act on after Figma's 3 seconds, and still lets them close it sooner", () => {
  const id = toast.refusal(elementCopy.removeRefusedTitle, { description: elementCopy.removeRefusedBody.animated })
  expect(
    sonner
      .getHistory()
      .filter((entry): entry is ToastT => !("dismiss" in entry))
      .find((entry) => entry.id === id),
  ).toMatchObject({ type: "error", duration: 3000, closeButton: true, dismissible: true })
})

it("keeps custom action notices available with a named close control", () => {
  const id = toast.notice(() => createElement("button", null, "Undo"), { duration: 9000 })
  const entry = sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .find((entry) => entry.id === id)
  expect(entry?.duration).toBe(Infinity)
  expect(renderToStaticMarkup(createElement("div", null, entry?.jsx))).toContain('aria-label="Close"')
})

it("leaves plain success messages on Sonner's short lifetime", () => {
  const id = toast.success("Downloaded")
  const entry = sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .find((entry) => entry.id === id)
  expect(entry?.type).toBe("success")
  expect(entry?.duration).toBeUndefined()
})

it("keeps a success with Undo available even when the caller supplies a finite duration", () => {
  const id = toast.success("Moved", { duration: 9000, action: { label: "Undo", onClick() {} } })
  expect(
    sonner
      .getHistory()
      .filter((entry): entry is ToastT => !("dismiss" in entry))
      .find((entry) => entry.id === id),
  ).toMatchObject({ duration: Infinity, closeButton: true })
})

it("keeps one notice when several edits exceed the limit", () => {
  try {
    tellRefusal("too-large")
    tellRefusal("too-large")
    tellRefusal("too-large")
    expect(
      sonner.getToasts().filter((entry) => "title" in entry && entry.title === productCopy.editTooLarge),
    ).toHaveLength(1)
  } finally {
    sonner.dismiss()
  }
})

it("keeps one notice when an animated element is repeatedly refused deletion", async () => {
  const parts = onSlide(
    xml(
      twoBoxSlide.replace(
        "</p:cSld>",
        '</p:cSld><p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="3"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>',
      ),
    ),
  )
  for (let attempt = 0; attempt < 3; attempt += 1)
    expect(
      await commitElement(
        "deck",
        parts,
        openRegister("", ""),
        { change: "remove", nodes: [elementId("256.3")] },
        () => {},
      ),
    ).toBe("refused")
  expect(
    sonner.getToasts().filter((entry) => "title" in entry && entry.title === elementCopy.removeRefusedTitle),
  ).toHaveLength(1)
})

function shown(id: string | number): ToastT | undefined {
  return sonner
    .getHistory()
    .filter((entry): entry is ToastT => !("dismiss" in entry))
    .findLast((entry) => entry.id === id)
}

it("shows a notice again as a new toast once the person closed it, so the closing one cannot take it away", () => {
  const first = toast.error("Unable to save presenter notes", { id: "notes-refused" })
  const closed = shown(first)
  if (closed === undefined) throw new Error("no notice")
  closed.onDismiss?.(closed)
  const again = toast.error("Unable to save presenter notes", { id: "notes-refused" })
  expect(again).not.toBe(first)
  expect(shown(again)).toMatchObject({ title: "Unable to save presenter notes", duration: Infinity })
  expect(toast.error("Unable to save presenter notes", { id: "notes-refused" })).toBe(again)
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

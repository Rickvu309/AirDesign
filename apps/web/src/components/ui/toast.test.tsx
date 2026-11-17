import { tellRefusal } from "@/editor/use-deck-status"
import { productCopy } from "@/copy/product-copy"
import { elementCopy } from "@/copy/element-copy"
import { commitElement } from "@/element-edit"
import { onSlide, twoBoxSlide, xml } from "@/slide-fixtures"
import { elementId, openRegister } from "@airdesign/document"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { toast as sonner, type ToastT } from "sonner"
import { afterEach, expect, it } from "vitest"
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

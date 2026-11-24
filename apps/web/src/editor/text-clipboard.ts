import * as doom from "@airdesign/doom"
import { filterSliceLinks, type TextSlice } from "./text-edit"

const clipboardAttribute = "data-airdesign-text"
const webAddress = /^(https?:\/\/|mailto:)/i

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function htmlOfSlice(slice: TextSlice, deck: string): string {
  const payload = escapeHtml(JSON.stringify({ deck, slice }))
  const runs =
    slice.chars.length === 0
      ? []
      : slice.spans.length === 0
        ? [{ text: slice.chars, link: undefined }]
        : (() => {
            let start = 0
            return slice.spans.map((span) => {
              const part = { text: slice.chars.slice(start, span.end), link: span.link }
              start = span.end
              return part
            })
          })()
  const body = runs
    .map((run) => {
      const escaped = escapeHtml(run.text).replace(/\n/g, "<br>")
      return run.link !== undefined && webAddress.test(run.link)
        ? `<a href="${escapeHtml(run.link)}">${escaped}</a>`
        : escaped
    })
    .join("")
  return `<span ${clipboardAttribute}="${payload}">${body}</span>`
}

export function writeTextClipboard(data: Pick<DataTransfer, "setData">, slice: TextSlice, deck: string): void {
  data.setData("text/plain", slice.chars)
  data.setData("text/html", htmlOfSlice(slice, deck))
}

export function readTextClipboard(
  data: Pick<DataTransfer, "getData">,
  target: { readonly deck: string; readonly slides: readonly doom.NodeId[] },
): TextSlice | null {
  const html = data.getData("text/html")
  if (html === "" || typeof DOMParser === "undefined") return null
  const parsed = new DOMParser().parseFromString(html, "text/html")
  const raw = parsed.querySelector(`[${clipboardAttribute}]`)?.getAttribute(clipboardAttribute)
  if (raw === null || raw === undefined) return null
  let envelope: unknown
  try {
    envelope = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof envelope !== "object" || envelope === null) return null
  const { deck, slice } = envelope as { readonly deck?: unknown; readonly slice?: unknown }
  if (typeof deck !== "string" || typeof slice !== "object" || slice === null) return null
  const checked = doom.props.text.read({
    ...(slice as Record<string, unknown>),
    style: "body",
    resize: "fixed",
    alignV: "top",
  })
  if (doom.isRefusal(checked)) return null
  const kept: TextSlice = { chars: checked.chars, spans: checked.spans, paras: checked.paras }
  return filterSliceLinks(
    kept,
    (link) => webAddress.test(link) || (deck === target.deck && target.slides.includes(link as doom.NodeId)),
  )
}

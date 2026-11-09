import {flushSync} from "react-dom"
import {createRoot} from "react-dom/client"
import type {NativeText} from "../../../deck/src/text/native-v3.ts"
import type {TextMeasurement} from "../../../deck/src/text/operations.ts"
import {Body} from "./body.tsx"

export {prepareNativeTextEdit} from "../../../deck/src/text/operations.ts"

export async function measureNativeText(text: NativeText): Promise<TextMeasurement> {
  const host = document.createElement("div")
  Object.assign(host.style, {position: "fixed", left: "0", top: "0", visibility: "hidden", pointerEvents: "none", width: `${text.box.width}px`, height: `${text.box.height}px`})
  document.body.append(host)
  const root = createRoot(host)
  try {
    const body = {...text.body, frame: {...text.body.frame, anchor: "top" as const}}
    flushSync(() => root.render(<Body body={body}/>))
    host.getBoundingClientRect()
    await document.fonts.ready
    const frame = host.querySelector<HTMLElement>("[data-text-frame]")
    const content = host.querySelector<HTMLElement>("[data-text]")
    if (!frame || !content) throw new Error("text-measurement-frame-missing")
    const box = frame.getBoundingClientRect(), contentBox = content.getBoundingClientRect()
    let right = contentBox.right, bottom = contentBox.bottom, left = box.left, top = box.top
    for (const paragraph of content.querySelectorAll<HTMLElement>("[data-paragraph]")) {
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      for (const rect of [paragraph.getBoundingClientRect(), ...range.getClientRects()]) {
        right = Math.max(right, rect.right)
        bottom = Math.max(bottom, rect.bottom)
        left = Math.min(left, rect.left)
        top = Math.min(top, rect.top)
      }
    }
    return {width: right - left + body.frame.insets.right, height: bottom - top + body.frame.insets.bottom}
  } finally {
    flushSync(() => root.unmount())
    host.remove()
  }
}

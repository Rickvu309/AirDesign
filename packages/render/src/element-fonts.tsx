import type { PaintStore } from "./store.js"
import { textValue } from "./paragraph-edit.js"
import { useLayoutEffect, useState, useSyncExternalStore } from "react"
import type { CanvasElement, CanvasText } from "./record.js"
import { fontsFor } from "./font-load.js"

function textFonts(text: CanvasText | null | undefined): readonly string[] {
  return (
    text?.paragraphs.flatMap((paragraph) =>
      [paragraph.endStyle.font, paragraph.bullet?.font, ...paragraph.runs.map((run) => run.font)].filter(
        (font): font is string => typeof font === "string" && font !== "",
      ),
    ) ?? []
  )
}

function namesOf(element: CanvasElement): readonly string[] {
  return [...new Set([...textFonts(element.text), ...(element.diagram?.flatMap(namesOf) ?? [])])].sort()
}

const noSubscription = () => () => {}
const noRecord = () => null

export function useElementFonts(element: CanvasElement, store: PaintStore): boolean {
  const loader = typeof document === "undefined" ? undefined : fontsFor(document)
  const id = loader === undefined ? null : element.id
  const record = useSyncExternalStore(
    id === null ? noSubscription : store.elementSubscribe(id),
    id === null ? noRecord : () => store.getElement(id),
    noRecord,
  )
  const written =
    record === null
      ? []
      : textValue(record.text).flatMap((paragraph) =>
          paragraph.runs.flatMap((run) => (run.font === undefined ? [] : [run.font])),
        )
  const names = [
    ...new Set([...namesOf(element), ...written.map((font) => element.text?.fonts?.[font] ?? font)]),
  ].sort()
  const key = JSON.stringify(names)
  const [loaded, setLoaded] = useState("")
  const ready = loader === undefined || names.every((name) => loader.ready(name))
  useLayoutEffect(() => {
    if (loader === undefined || ready) return
    let current = true
    void Promise.all(names.map((name) => loader.load(name))).then(() => {
      if (!current) return
      setLoaded(key)
    })
    return () => {
      current = false
    }
  }, [key, loader, ready])
  return ready || loaded === key
}

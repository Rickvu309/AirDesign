import { opaque } from "@airdesign/document"
import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { changeDesign } from "@/design/design-change"
import { removeAutoLayout } from "@/editor/auto-layout-removal"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { selectedDesign, type DesigningDeck } from "@/editor/live-design-panel"
import { onLayers, typing } from "@/editor/pointer-tool"
import { steppedStyle } from "@/design/weight-step"

const alignOf: Partial<Readonly<Record<GestureId, string>>> = {
  "align-left": "left",
  "align-center": "center",
  "align-right": "right",
  "align-top": "top",
  "align-middle": "middle",
  "align-bottom": "bottom",
}

const pairWithin = 500

const clearedBy: Partial<
  Readonly<Record<GestureId, { readonly trait: string; readonly field: string; readonly none: unknown }>>
> = {
  "remove-fill": { trait: "fills", field: "paint", none: { none: true } },
  "remove-border": { trait: "border", field: "border", none: "none" },
}

const carried: Readonly<Record<string, readonly string[] | "all">> = {
  fills: ["paint"],
  border: ["border", "color", "fill", "width", "dash", "cap", "compound", "join", "head", "tail"],
  effects: ["shadow", "innerShadow", "glow", "softEdge", "blur"],
  opacity: ["opacity"],
  corners: "all",
}

type Property = { readonly trait: string; readonly field: string; readonly value: unknown }

function propertiesOf(deck: DesigningDeck): readonly Property[] {
  return (selectedDesign(deck)?.controls ?? []).flatMap((control) => {
    const fields = carried[control.trait]
    const takes = fields === "all" || (fields?.includes(control.field) ?? false)
    return takes && !control.mixed && control.value !== undefined
      ? [{ trait: control.trait, field: control.field, value: control.value }]
      : []
  })
}

function pastedOnto(deck: DesigningDeck, properties: readonly Property[]) {
  const controls = selectedDesign(deck)?.controls ?? []
  return properties.flatMap(({ trait, field, value }) => {
    const control = controls.find((each) => each.trait === trait && each.field === field)
    return control === undefined ? [] : [control.change(value)]
  })
}

function controlOf(deck: DesigningDeck, trait: string, field: string) {
  return selectedDesign(deck)?.controls.find((control) => control.trait === trait && control.field === field)
}

function opacityTyped(digit: string, pair: string | null): number {
  const percent = pair === null ? (digit === "0" ? 100 : Number(digit) * 10) : Number(pair)
  return (percent * opaque) / 100
}

export function useDesignKeys(deck: DesigningDeck, working: boolean) {
  const latest = useRef(deck)
  const typed = useRef<{ readonly digit: string; readonly at: number } | null>(null)
  const kept = useRef<readonly Property[] | null>(null)
  useEffect(() => {
    latest.current = deck
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      const align = gesture === null ? undefined : alignOf[gesture]
      const now = latest.current
      if (align !== undefined) {
        if (controlOf(now, "box", "align") === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => controlOf(latest.current, "box", "align")?.change(align) ?? [])
        return
      }
      const onLayer = onLayers(event.target) ? gestureFor(event, "element") : null
      const cleared = onLayer === null ? undefined : clearedBy[onLayer]
      if (cleared !== undefined) {
        if (controlOf(now, cleared.trait, cleared.field) === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => controlOf(latest.current, cleared.trait, cleared.field)?.change(cleared.none) ?? [])
        return
      }
      if (onLayer === "numbers") {
        const list = controlOf(now, "text", "list")
        if (list === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        const next = list.value === "numbers" ? "none" : "numbers"
        changeDesign(now, () => controlOf(latest.current, "text", "list")?.change(next) ?? [])
        return
      }
      if (onLayer === "weight-up" || onLayer === "weight-down") {
        const weight = controlOf(now, "text", "weight")
        const next = weight === undefined ? null : steppedStyle(weight, onLayer === "weight-up" ? 1 : -1)
        if (next === null || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => controlOf(latest.current, "text", "weight")?.change(next) ?? [])
        return
      }
      if (onLayer === "opacity") {
        if (controlOf(now, "opacity", "opacity") === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        const last = typed.current
        const pair = last !== null && event.timeStamp - last.at < pairWithin ? last.digit + event.key : null
        typed.current = pair === null ? { digit: event.key, at: event.timeStamp } : null
        const value = opacityTyped(event.key, pair)
        changeDesign(now, () => controlOf(latest.current, "opacity", "opacity")?.change(value) ?? [])
        return
      }
      if (gesture === "copy-properties") {
        if (now.selection.ids.length !== 1 || !editorOwnsKey(event)) return
        const properties = propertiesOf(now)
        if (properties.length === 0) return
        event.preventDefault()
        kept.current = properties
        return
      }
      if (gesture === "paste-properties") {
        const properties = kept.current
        if (properties === null || now.selection.ids.length === 0 || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => pastedOnto(latest.current, properties))
        return
      }
      if (gesture !== "remove-auto-layout") return
      const [node, ...rest] = now.selection.ids
      if (node === undefined || rest.length > 0 || selectedDesign(now)?.model.frame !== "auto") return
      if (!editorOwnsKey(event)) return
      event.preventDefault()
      removeAutoLayout(now, node)
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}

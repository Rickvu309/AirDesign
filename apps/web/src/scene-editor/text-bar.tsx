import type { scene } from "@airdesign/document"
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react"
import { memo, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { markOn, type Mark } from "./text-edit"
import type { TextSession } from "./use-text-session"

const marks = [
  { mark: "bold", icon: Bold, label: sceneEditorCopy.bold },
  { mark: "italic", icon: Italic, label: sceneEditorCopy.italic },
  { mark: "underline", icon: Underline, label: sceneEditorCopy.underline },
] as const

const styles = Object.keys(sceneEditorCopy.textStyles) as readonly scene.TextStyleName[]

function holdFocus(event: React.MouseEvent) {
  event.preventDefault()
}

type Actions = Pick<TextSession, "setStyle" | "mark" | "list">

export function TextBar({ api }: { readonly api: TextSession }) {
  const latest = useRef(api)
  latest.current = api
  const actions = useMemo<Actions>(
    () => ({
      setStyle: (style) => latest.current.setStyle(style),
      mark: (mark) => latest.current.mark(mark),
      list: (kind) => latest.current.list(kind),
    }),
    [],
  )
  const session = api.session
  if (session === null) return null
  const { draft, anchor, focus, pending } = session
  const on = (mark: Mark) => markOn(draft, anchor, focus, mark, pending ?? undefined)
  const first = draft.paras[draft.chars.slice(0, Math.min(anchor, focus)).split("\n").length - 1]
  return (
    <TextBarView
      style={draft.style}
      bold={on("bold")}
      italic={on("italic")}
      underline={on("underline")}
      list={first?.list}
      actions={actions}
    />
  )
}

const TextBarView = memo(function TextBarView({
  style,
  bold,
  italic,
  underline,
  list,
  actions: api,
}: {
  readonly style: scene.TextStyleName
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly list: "bullet" | "number" | undefined
  readonly actions: Actions
}) {
  const lit = { bold, italic, underline }
  return (
    <div
      role="toolbar"
      aria-label={sceneEditorCopy.textBar}
      data-text-bar=""
      className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-white p-1 shadow-[0px_0px_0px_1px_var(--field-edge),0px_4px_12px_var(--black-6)]"
      onMouseDown={holdFocus}
    >
      <Select value={style} onValueChange={(next) => api.setStyle(next as scene.TextStyleName)}>
        <SelectTrigger aria-label={sceneEditorCopy.textStyle} className="h-8 w-32 border-0 shadow-none">
          <SelectValue>
            {(value: string | null) => sceneEditorCopy.textStyles[(value ?? style) as scene.TextStyleName]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {styles.map((style) => (
            <SelectItem key={style} value={style}>
              {sceneEditorCopy.textStyles[style]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {marks.map(({ mark, icon: Icon, label }) => (
        <Button
          key={mark}
          variant={lit[mark] ? "default" : "ghost"}
          size="icon"
          aria-label={label}
          aria-pressed={lit[mark]}
          onMouseDown={holdFocus}
          onClick={() => api.mark(mark)}
        >
          <Icon />
        </Button>
      ))}
      <Button
        variant={list === "bullet" ? "default" : "ghost"}
        size="icon"
        aria-label={sceneEditorCopy.bullets}
        aria-pressed={list === "bullet"}
        onMouseDown={holdFocus}
        onClick={() => api.list("bullet")}
      >
        <List />
      </Button>
      <Button
        variant={list === "number" ? "default" : "ghost"}
        size="icon"
        aria-label={sceneEditorCopy.numbers}
        aria-pressed={list === "number"}
        onMouseDown={holdFocus}
        onClick={() => api.list("number")}
      >
        <ListOrdered />
      </Button>
    </div>
  )
})

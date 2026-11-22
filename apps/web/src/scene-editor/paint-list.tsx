import { scene } from "@airdesign/document"
import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import { cn } from "@/lib/class-names"
import { NumberField } from "./panel-fields"
import { unsetPaintGrey } from "./panel-art"

type Paint = scene.Paint

function hexOf(color: scene.Color, theme: scene.Theme): string {
  return typeof color === "string" ? color : theme.colors[color.var]
}

function paintCss(paint: Paint, theme: scene.Theme): string {
  if (paint.kind === "solid") return scene.resolveColor(paint.color, theme)
  if (paint.kind === "gradient") return scene.resolveColor(paint.stops[0]?.color ?? unsetPaintGrey, theme)
  return theme.colors.background2
}

function ColorChoices(props: {
  readonly theme: scene.Theme
  readonly current: scene.Color
  readonly onPick: (color: scene.Color) => void
}) {
  const [hex, setHex] = useState(hexOf(props.current, props.theme))
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex)
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={sceneEditorCopy.paintColor} className="grid grid-cols-6 gap-1.5">
        {(Object.keys(props.theme.colors) as scene.ColorVar[]).map((name) => (
          <button
            key={name}
            type="button"
            aria-label={sceneEditorCopy.colorNames[name]}
            title={sceneEditorCopy.colorNames[name]}
            aria-pressed={typeof props.current === "object" && props.current.var === name}
            onClick={() => props.onPick({ var: name })}
            className={cn(
              "size-7 rounded-md shadow-[inset_0_0_0_1px_var(--black-10)]",
              typeof props.current === "object" && props.current.var === name
                ? "ring-2 ring-[var(--primary-strong)] ring-offset-1"
                : null,
            )}
            style={{ background: props.theme.colors[name] }}
          />
        ))}
      </div>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) props.onPick(hex.toLowerCase() as scene.Hex)
        }}
      >
        <label htmlFor="scene-hex" className="text-[length:var(--type-dense)] text-quiet">
          {sceneEditorCopy.hexColor}
        </label>
        <input
          id="scene-hex"
          value={hex}
          onChange={(event) => setHex(event.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg bg-muted px-2.5 text-[length:var(--type-dense)]"
          aria-invalid={!valid}
        />
        <Button type="submit" size="sm" variant="outline" disabled={!valid}>
          {sceneEditorCopy.applyHex}
        </Button>
      </form>
    </div>
  )
}

export function PaintList(props: {
  readonly label: string
  readonly paints: readonly Paint[]
  readonly mixed: boolean
  readonly theme: scene.Theme
  readonly solidOnly?: boolean
  readonly onChange: (paints: readonly Paint[]) => void
}) {
  const { paints, theme } = props
  const replace = (at: number, next: Paint) =>
    props.onChange(paints.map((paint, index) => (index === at ? next : paint)))
  return (
    <div className="flex flex-col gap-1.5" data-paint-list={props.label}>
      {props.mixed ? <p className="text-[length:var(--type-dense)] text-quiet">—</p> : null}
      {paints.map((paint, at) => (
        <div key={at} className="flex items-center gap-1.5" data-paint="">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={`${props.label} ${sceneEditorCopy.paintColor}`}
                  className="size-6 shrink-0 rounded-md shadow-[inset_0_0_0_1px_var(--black-10)]"
                  style={{ background: paintCss(paint, theme) }}
                />
              }
            />
            <PopoverContent side="left" className="w-56">
              {paint.kind === "solid" ? (
                <ColorChoices
                  theme={theme}
                  current={paint.color}
                  onPick={(color) => replace(at, { ...paint, color })}
                />
              ) : (
                <p className="text-[length:var(--type-dense)] text-quiet">{sceneEditorCopy.paintKinds[paint.kind]}</p>
              )}
            </PopoverContent>
          </Popover>
          <span className="min-w-0 flex-1 truncate text-[length:var(--type-dense)]">
            {paint.kind === "solid"
              ? typeof paint.color === "string"
                ? paint.color
                : sceneEditorCopy.colorNames[paint.color.var]
              : sceneEditorCopy.paintKinds[paint.kind]}
          </span>
          <div className="w-20">
            <NumberField
              label={sceneEditorCopy.opacity}
              hideLabel
              suffix="%"
              value={Math.round((paint.opacity ?? 1) * 100)}
              min={0}
              max={100}
              onCommit={(value) => replace(at, { ...paint, opacity: Math.min(1, Math.max(0, value / 100)) })}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`${sceneEditorCopy.removePaint} ${props.label}`}
            onClick={() => props.onChange(paints.filter((_, index) => index !== at))}
          >
            <Minus />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        aria-label={`${sceneEditorCopy.addPaint} ${props.label}`}
        onClick={() =>
          props.onChange([...paints, { kind: "solid", color: { var: props.solidOnly === true ? "text" : "accent1" } }])
        }
      >
        <Plus /> {sceneEditorCopy.addPaint}
      </Button>
    </div>
  )
}

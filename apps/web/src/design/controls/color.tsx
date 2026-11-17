import { alphaKeys, alphaOf, fadedColor, opaque, type Color } from "@airdesign/document"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { shownHex, shownName } from "@/design/color-choices"
import { ColorPicker, lightCss } from "@/design/color-picker"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

export function ColorField({
  id,
  css,
  name,
  inherited = false,
}: {
  id: string
  css: string | null
  name: string
  inherited?: boolean
}) {
  return (
    <>
      <span
        className={cn(
          "size-4 shrink-0 rounded-sm",
          css === null || lightCss(css) ? "shadow-[0px_0px_0px_1px_var(--field-edge)]" : null,
        )}
        style={css === null ? undefined : { background: css }}
        aria-hidden
      />
      <span
        id={id}
        className={cn("truncate text-[length:var(--type-dense)]", inherited ? "text-quiet" : "text-foreground")}
      >
        {name}
      </span>
    </>
  )
}

export const fieldLook =
  "h-9 w-full min-w-0 justify-start gap-2.5 rounded-lg border-0 bg-white px-3 font-normal shadow-[0px_0px_0px_1px_var(--field-edge)] hover:bg-white active:translate-y-0"

export function ColorControl({ row, palette, onChange }: ControlProps) {
  const label = useId()
  const named = useId()
  const held = row.mixed ? null : (row.value as Color | undefined)
  const shown = held === null || held === undefined ? undefined : fadedColor(held, opaque)
  const carried = alphaKeys.some((key) => key.startsWith(`${row.trait}.`)) || shown === undefined
  const picked = (color: Color) => (carried ? color : fadedColor(color, alphaOf(held ?? color)))
  const css = shown === undefined ? null : `#${shownHex(shown, palette.theme)}`
  const name = row.mixed ? designCopy.mixed : shown === undefined ? "" : shownName(shown, palette.theme)
  return (
    <div
      role="group"
      aria-labelledby={label}
      className="flex flex-col gap-1.5"
      data-control="color"
      data-inherited={row.inherited ? "" : undefined}
    >
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      <ColorPicker
        value={shown}
        palette={palette}
        onPick={(color) => onChange(picked(color))}
        trigger={<Button type="button" variant="ghost" aria-labelledby={`${label} ${named}`} className={fieldLook} />}
      >
        <ColorField id={named} css={css} name={name} inherited={row.inherited} />
      </ColorPicker>
    </div>
  )
}

import { agentNumberOf, readAgent } from "@airdesign/catalog"
import { alphaOf, fadedColor, type Color } from "@airdesign/document"
import { type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { pictureCopy } from "@/copy/picture-copy"
import { optionWord } from "@/copy/option-copy"
import { shownHex } from "@/design/color-choices"
import { PickerBody } from "@/design/color-picker"
import type { ControlProps } from "@/design/panel"
import { EditorIcon } from "@/components/ui/editor-icons"
import { PercentRow } from "@/design/controls/percent-row"

const half = 50_000
const black: Color = { rgb: "000000" }
const checker: CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, black 0 50%, transparent 50%), repeating-conic-gradient(rgb(208 208 208) 0% 25%, white 0% 50%)",
  backgroundSize: "auto, 8px 8px",
}

const trigger =
  "h-[var(--control-dense)] w-full min-w-0 justify-start gap-1 rounded-[var(--shape-control)] border-0 bg-white px-1.5 text-[length:var(--type-caption)] font-normal text-foreground shadow-[inset_0px_0px_0px_1px_var(--field-edge)] hover:bg-white active:translate-y-0"

type Overlay = { readonly none: true } | { readonly solid: Color }

function overlayOf(value: unknown): Overlay {
  if (typeof value === "object" && value !== null && "solid" in value) {
    const solid = value.solid
    if (typeof solid === "object" && solid !== null) return { solid: solid as Color }
  }
  return { none: true }
}

const percentOf = (stored: number): number => stored / 1_000

function cssOf(color: Color, templateColors: ControlProps["palette"]["templateColors"]): string {
  const hex = shownHex(color, templateColors)
  const alpha = Math.round((alphaOf(color) / 100_000) * 255)
  return alpha >= 255 ? `#${hex}` : `#${hex}${alpha.toString(16).padStart(2, "0")}`
}

function laid(color: Color, current: Overlay): Color {
  if ("solid" in current) return fadedColor(color, alphaOf(current.solid))
  return alphaOf(color) >= 100_000 ? fadedColor(color, half) : color
}

export function OverlayControl({ control, palette, onChange }: ControlProps) {
  const current = overlayOf(control.mixed ? undefined : control.value)
  const color = "solid" in current ? current.solid : null
  const exact = color === null ? 0 : percentOf(alphaOf(color))
  function cover(next: Color) {
    onChange({ solid: next })
  }
  return (
    <Popover modal={false}>
      <PopoverTrigger render={<Button type="button" variant="ghost" className={trigger} data-overlay />}>
        <span
          aria-hidden
          data-overlay-swatch
          className="size-3.5 shrink-0 rounded-[var(--shape-swatch)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
          style={color === null ? checker : { background: cssOf(color, palette.templateColors) }}
        />
        <span className="whitespace-nowrap">{control.label}</span>
        <EditorIcon name="chev" size={12} className="ml-auto size-3 shrink-0 text-quiet" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="gap-3 p-3 duration-0"
        data-overlay-panel
        data-session
        data-keeps-selection
      >
        <PickerBody
          title={pictureCopy.overlay}
          value={color ?? undefined}
          palette={palette}
          onPick={(picked) => cover(laid(picked, current))}
        />
        <PercentRow
          label={pictureCopy.overlayOpacity}
          exact={exact}
          onCommit={(percent) => cover(fadedColor(color ?? black, Math.round(percent * 1_000)))}
        />
        <Button type="button" variant="ghost" className="justify-start" onClick={() => onChange({ none: true })}>
          {optionWord("overlay", "none")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function BlurControl({ control, onChange }: ControlProps) {
  const stored = !control.mixed && typeof control.value === "number" ? control.value : 0
  const exact = control.desc.kind === "number" ? agentNumberOf(control.desc.unit, stored) : percentOf(stored)
  function commit(percent: number) {
    const read = readAgent(control.desc, percent)
    if (read.ok && (read.value !== control.value || control.inherited)) onChange(read.value)
  }
  return (
    <Popover modal={false}>
      <PopoverTrigger render={<Button type="button" variant="ghost" className={trigger} data-blur />}>
        <EditorIcon name="blur" size={14} className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">{control.label}</span>
        <EditorIcon name="chev" size={12} className="ml-auto size-3 shrink-0 text-quiet" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="gap-3 p-3 duration-0"
        data-blur-panel
        data-session
        data-keeps-selection
      >
        <PercentRow label={control.label} exact={exact} onCommit={commit} />
      </PopoverContent>
    </Popover>
  )
}

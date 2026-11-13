import {
  alignNames,
  formatNames,
  schemeNames,
  type FormatState,
  type ParagraphAlign,
  type RunColor,
  type SchemeName,
  type TextFormat,
} from "@airdesign/document"
import type { TextFormatting } from "@airdesign/render"
import type { KeyboardEvent, MouseEvent } from "react"
import { useSyncExternalStore } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCopy } from "@/copy/format-copy"
import { formatSwatches } from "@/editor/format-art"
import { EditorIcon, type EditorIconName } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

export type FormatShown = Readonly<Record<TextFormat, FormatState>>

type Swatch = { readonly scheme: SchemeName; readonly css: string }

const keys: Readonly<Record<TextFormat, string>> = { bold: "B", italic: "I", underline: "U" }
const alignIcons: Readonly<Record<ParagraphAlign, EditorIconName>> = {
  left: "alignLeft",
  center: "alignCenter",
  right: "alignRight",
}

const looks: Readonly<Record<FormatState, string>> = {
  on: "bg-line text-foreground hover:bg-line",
  mixed: "bg-canvas text-foreground hover:bg-canvas",
  off: "text-quiet hover:bg-transparent",
}

const pressed: Readonly<Record<FormatState, "true" | "false" | "mixed">> = { on: "true", off: "false", mixed: "mixed" }

const quiet = "size-9 rounded-lg text-quiet hover:bg-transparent active:translate-y-0"

function holdCaret(event: MouseEvent) {
  event.preventDefault()
}

function sizeText(size: number): string {
  const points = size / 100
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function schemeValue(color: RunColor | "mixed" | null): string {
  return color !== null && color !== "mixed" && "scheme" in color ? color.scheme : ""
}

function barOf(color: RunColor | "mixed" | null, palette: readonly Swatch[]): string | null {
  if (color === null || color === "mixed") return null
  if ("rgb" in color) return `#${color.rgb}`
  return palette.find((swatch) => swatch.scheme === color.scheme)?.css ?? null
}

function moveAlign(
  event: KeyboardEvent<HTMLElement>,
  align: ParagraphAlign | "mixed" | null,
  onAlign?: (align: ParagraphAlign) => void,
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown"
  const back = event.key === "ArrowLeft" || event.key === "ArrowUp"
  if (!forward && !back) return
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  event.preventDefault()
  const current = alignNames.find((name) => name === target.dataset.place)
  const index = current === undefined ? (forward ? -1 : alignNames.length) : alignNames.indexOf(current)
  const next = alignNames[(index + (forward ? 1 : alignNames.length - 1)) % alignNames.length]
  if (next === undefined || next === align) return
  onAlign?.(next)
  const button = target.parentElement?.querySelector(`[data-place="${next}"]`)
  if (button instanceof HTMLElement) button.focus()
}

export function FormatButtons({
  shown,
  onToggle,
  size,
  onResize,
  color,
  onColor,
  align,
  onAlign,
  bullet = "off",
  onBullet,
  swatches,
}: {
  shown: FormatShown
  onToggle?: (format: TextFormat) => void
  size?: number | "mixed" | null
  onResize?: (points: number) => void
  color?: RunColor | "mixed" | null
  onColor?: (color: RunColor) => void
  align?: ParagraphAlign | "mixed" | null
  onAlign?: (align: ParagraphAlign) => void
  bullet?: FormatState
  swatches?: readonly Swatch[]
  onBullet?: () => void
}) {
  const sizeShown = size === undefined ? 1800 : size
  const designColor: RunColor = { scheme: "dk1" }
  const colorShown = color === undefined ? designColor : color
  const alignShown = align === undefined ? "left" : align
  const palette = swatches !== undefined && swatches.length > 0 ? swatches : formatSwatches
  const bar = barOf(colorShown, palette)
  const chosen = schemeValue(colorShown)
  const checked = alignShown === "left" || alignShown === "center" || alignShown === "right" ? alignShown : null
  return (
    <>
      <span className="mx-1 block h-6 w-px bg-[var(--field-edge)]" />
      <span role="group" aria-label={formatCopy.group} className="flex items-center gap-0.5" data-text-format>
        {formatNames.map((format) => (
          <Button
            key={format}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={formatCopy.named[format]}
            aria-pressed={pressed[shown[format]]}
            aria-keyshortcuts={`Control+${keys[format]} Meta+${keys[format]}`}
            className={cn("size-9 rounded-lg active:translate-y-0", looks[shown[format]])}
            onMouseDown={holdCaret}
            {...(onToggle === undefined ? {} : { onClick: () => onToggle(format) })}
          >
            <EditorIcon name={format} size={18} />
          </Button>
        ))}
      </span>
      <span
        role="group"
        aria-label={sizeShown === "mixed" ? formatCopy.sizeMixed : formatCopy.sizeGroup}
        className="flex items-center gap-0.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={formatCopy.smaller}
          className={quiet}
          onMouseDown={holdCaret}
          {...(onResize === undefined ? {} : { onClick: () => onResize(-1) })}
        >
          <EditorIcon name="minus" size={18} />
        </Button>
        <span className="min-w-8 text-center text-[length:var(--type-dense)] text-foreground tabular-nums" aria-hidden>
          {typeof sizeShown === "number" ? sizeText(sizeShown) : "–"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={formatCopy.larger}
          className={quiet}
          onMouseDown={holdCaret}
          {...(onResize === undefined ? {} : { onClick: () => onResize(1) })}
        >
          <EditorIcon name="plus" size={18} />
        </Button>
      </span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={formatCopy.color}
              className={cn(quiet, "text-foreground")}
              onMouseDown={holdCaret}
            />
          }
        >
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-sm leading-none font-semibold">A</span>
            <span
              className={cn("h-0.5 w-3.5 rounded-full", bar === null && "bg-foreground")}
              {...(bar === null ? {} : { style: { backgroundColor: bar } })}
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-44" data-keeps-format>
          <DropdownMenuRadioGroup
            value={chosen}
            onValueChange={(value) => {
              if (value === chosen) return
              const scheme = schemeNames.find((name) => name === value)
              if (scheme !== undefined) onColor?.({ scheme })
            }}
          >
            {palette.map((swatch) => (
              <DropdownMenuRadioItem key={swatch.scheme} value={swatch.scheme} onMouseDown={holdCaret}>
                <span
                  className="size-3 rounded-full ring-1 ring-foreground/20"
                  style={{ backgroundColor: swatch.css }}
                />
                {formatCopy.colors[swatch.scheme]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span
        role="radiogroup"
        aria-label={formatCopy.alignGroup}
        className="flex items-center gap-0.5"
        onKeyDown={(event) => moveAlign(event, alignShown, onAlign)}
      >
        {alignNames.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            data-place={name}
            aria-label={formatCopy.align[name]}
            aria-checked={checked === name}
            tabIndex={checked === name || (checked === null && name === "left") ? 0 : -1}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), quiet, checked === name && looks.on)}
            onMouseDown={holdCaret}
            {...(onAlign === undefined ? {} : { onClick: () => onAlign(name) })}
          >
            <EditorIcon name={alignIcons[name]} size={18} />
          </button>
        ))}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={formatCopy.bullets}
        aria-pressed={pressed[bullet]}
        className={cn("size-9 rounded-lg active:translate-y-0", looks[bullet])}
        onMouseDown={holdCaret}
        {...(onBullet === undefined ? {} : { onClick: onBullet })}
      >
        <EditorIcon name="bullets" size={18} />
      </Button>
    </>
  )
}

function shownOf(formatting: TextFormatting): FormatShown | null {
  const bold = formatting.state("bold")
  const italic = formatting.state("italic")
  const underline = formatting.state("underline")
  return bold === null || italic === null || underline === null ? null : { bold, italic, underline }
}

export function LiveFormatButtons({ formatting }: { formatting: TextFormatting }) {
  useSyncExternalStore(formatting.subscribe, formatting.version)
  const shown = shownOf(formatting)
  return shown === null ? null : (
    <FormatButtons
      shown={shown}
      onToggle={formatting.toggle}
      size={formatting.size()}
      onResize={formatting.resize}
      color={formatting.color()}
      onColor={formatting.choose}
      align={formatting.align()}
      onAlign={formatting.place}
      bullet={formatting.bullet() ?? "off"}
      onBullet={formatting.bullets}
      swatches={formatting.swatches()}
    />
  )
}

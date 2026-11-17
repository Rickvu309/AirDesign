import type { Color } from "@airdesign/document"
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { colorCopy } from "@/copy/color-copy"
import { deckChoices, matches, themeColumns, type Choice, type Palette } from "@/design/color-choices"
import { CustomColor } from "@/design/custom-color"
import { cn } from "@/lib/class-names"

const lightest = 0xe0

export function lightCss(css: string): boolean {
  const hex = /^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(css)
  return hex !== null && hex.slice(1).every((pair) => Number.parseInt(pair, 16) >= lightest)
}

const edged = "shadow-[0px_0px_0px_1px_var(--field-edge)]"
const ringed = "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"

function Cell({
  choice,
  pressed,
  at,
  focused,
  onPick,
}: {
  choice: Choice
  pressed: boolean
  at: string
  focused: boolean
  onPick: (color: Color) => void
}) {
  return (
    <button
      type="button"
      aria-label={choice.name}
      aria-pressed={pressed}
      title={choice.name}
      data-at={at}
      tabIndex={focused ? 0 : -1}
      onClick={() => {
        if (!pressed) onPick(choice.color)
      }}
      className={cn("size-5 shrink-0 rounded-sm", lightCss(choice.css) ? edged : null, pressed ? ringed : null)}
      style={{ background: choice.css }}
    />
  )
}

function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const steps: Readonly<Record<string, readonly [number, number]>> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const step = steps[event.key]
  const target = event.target
  if (step === undefined || !(target instanceof HTMLElement)) return
  const [column, row] = (target.dataset.at ?? "").split(",").map(Number)
  if (column === undefined || row === undefined) return
  const next = event.currentTarget.querySelector(`[data-at="${String(column + step[0])},${String(row + step[1])}"]`)
  if (!(next instanceof HTMLElement)) return
  event.preventDefault()
  next.focus()
}

function Caption({ children }: { children: ReactNode }) {
  return <span className="text-[length:var(--type-caption)] text-quiet">{children}</span>
}

function ThemeGrid({
  value,
  palette,
  onPick,
}: {
  value: Color | undefined
  palette: Palette
  onPick: (color: Color) => void
}) {
  const columns = themeColumns(palette.theme)
  const cells = columns.flatMap((column, x) =>
    [column.swatch, ...column.shades].map((choice, y) => ({ choice, at: `${String(x)},${String(y)}` })),
  )
  const held = value === undefined ? undefined : cells.find(({ choice }) => matches(choice.color, value))
  const focus = held?.at ?? "0,0"
  return (
    <div className="flex flex-col gap-1.5">
      <Caption>{colorCopy.theme}</Caption>
      <div role="group" aria-label={colorCopy.theme} className="flex justify-between" onKeyDown={moveFocus}>
        {columns.map((column, x) => (
          <div key={column.swatch.name} className="flex flex-col gap-1">
            {[column.swatch, ...column.shades].map((choice, y) => {
              const at = `${String(x)},${String(y)}`
              return (
                <div key={choice.name} className={y === 1 ? "mt-1.5" : undefined}>
                  <Cell choice={choice} pressed={held?.at === at} at={at} focused={focus === at} onPick={onPick} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DeckRow({
  value,
  palette,
  onPick,
}: {
  value: Color | undefined
  palette: Palette
  onPick: (color: Color) => void
}) {
  const choices = deckChoices(palette)
  if (choices.length === 0) return null
  const held = value === undefined ? -1 : choices.findIndex((choice) => matches(choice.color, value))
  return (
    <div className="flex flex-col gap-1.5">
      <Caption>{colorCopy.deck}</Caption>
      <div role="group" aria-label={colorCopy.deck} className="flex gap-1" onKeyDown={moveFocus}>
        {choices.map((choice, x) => (
          <Cell
            key={choice.name}
            choice={choice}
            pressed={held === x}
            at={`${String(x)},0`}
            focused={(held < 0 ? 0 : held) === x}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}

export function PickerBody({
  value,
  palette,
  theme = true,
  onPick,
  onSwatch,
}: {
  value: Color | undefined
  palette: Palette
  theme?: boolean
  onPick: (color: Color) => void
  onSwatch?: () => void
}) {
  const swatch = (color: Color) => {
    onPick(color)
    onSwatch?.()
  }
  return (
    <>
      {theme && palette.theme.length > 0 ? <ThemeGrid value={value} palette={palette} onPick={swatch} /> : null}
      <DeckRow value={value} palette={palette} onPick={swatch} />
      <CustomColor value={value} palette={palette} onPick={onPick} />
    </>
  )
}

export function ColorPicker({
  value,
  palette,
  theme = true,
  keepsFormat = false,
  closesOnSwatch = false,
  side = "bottom",
  align = "start",
  trigger,
  children,
  onPick,
}: {
  value: Color | undefined
  palette: Palette
  theme?: boolean
  keepsFormat?: boolean
  closesOnSwatch?: boolean
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  trigger: ReactElement
  children: ReactNode
  onPick: (color: Color) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="gap-3 p-3 duration-0"
        data-color-picker
        data-keeps-selection
        {...(keepsFormat ? { "data-keeps-format": "" } : {})}
      >
        <PickerBody
          value={value}
          palette={palette}
          theme={theme}
          onPick={onPick}
          {...(closesOnSwatch ? { onSwatch: () => setOpen(false) } : {})}
        />
      </PopoverContent>
    </Popover>
  )
}

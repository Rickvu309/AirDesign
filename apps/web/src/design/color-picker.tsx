import type * as doom from "@airdesign/doom"
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { colorCopy } from "@/copy/color-copy"
import { productCopy } from "@/copy/product-copy"
import {
  deckChoices,
  hexOf,
  matches,
  pickerSwatches,
  templateColorColumns,
  tintChoices,
  type Choice,
  type Palette,
} from "@/design/color-choices"
import { CustomColor } from "@/design/custom-color"
import { EditorIcon } from "@/components/ui/editor-icons"
import { cn } from "@/lib/class-names"

const lightest = 0xe0
const columns = 6
const tintLimit = columns * 2
const otherLimit = columns * 3

export function lightCss(css: string): boolean {
  const hex = /^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(css)
  return hex !== null && hex.slice(1).every((pair) => Number.parseInt(pair, 16) >= lightest)
}

const edged = "shadow-[0px_0px_0px_1px_var(--field-edge)]"
const ringed = "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
const rainbow = `conic-gradient(from 90deg, ${[0, 60, 120, 180, 240, 300, 360]
  .map((hue) => `#${hexOf({ hue, saturation: 1, value: 1 })}`)
  .join(", ")})`

function atOf(index: number): string {
  return `${String(index % columns)},${String(Math.floor(index / columns))}`
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

function visibleChoices(choices: readonly Choice[], pressed: number, open: boolean, limit: number): readonly Choice[] {
  if (open || choices.length <= limit) return choices
  if (pressed < 0 || pressed < limit) return choices.slice(0, limit)
  const held = choices[pressed]
  return held === undefined ? choices.slice(0, limit) : [held, ...choices.slice(0, limit - 1)]
}

function Swatch({
  name,
  css,
  pressed,
  at,
  focused,
  onClick,
}: {
  name: string
  css: string
  pressed: boolean
  at: string
  focused: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={pressed}
      title={name}
      data-at={at}
      tabIndex={focused ? 0 : -1}
      onClick={onClick}
      className={cn("aspect-square w-full rounded-md", lightCss(css) ? edged : null, pressed ? ringed : null)}
      style={{ background: css }}
    />
  )
}

function More({ open, show, hide, onClick }: { open: boolean; show: string; hide: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? hide : show}
      onClick={onClick}
      className="mx-auto flex size-6 items-center justify-center text-quiet"
    >
      <EditorIcon name="chev" size={14} className={open ? "rotate-180" : undefined} />
    </button>
  )
}

function Heading({ title, leading, onClose }: { title: string; leading?: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {leading}
      <span className="min-w-0 flex-1 text-[length:var(--type-dense)] font-medium text-foreground">{title}</span>
      {onClose === undefined ? null : (
        <button
          type="button"
          aria-label={productCopy.close}
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center text-quiet"
        >
          <EditorIcon name="x" size={14} />
        </button>
      )}
    </div>
  )
}

function ColorGrid({
  label,
  choices,
  pressed,
  onPick,
}: {
  label: string
  choices: readonly Choice[]
  pressed: number
  onPick: (color: doom.Color) => void
}) {
  const focus = pressed < 0 ? "0,0" : atOf(pressed)
  return (
    <div role="group" aria-label={label} className="grid grid-cols-6 gap-2" onKeyDown={moveFocus}>
      {choices.map((choice, index) => {
        const at = atOf(index)
        return (
          <Swatch
            key={choice.name}
            name={choice.name}
            css={choice.css}
            pressed={pressed === index}
            at={at}
            focused={focus === at}
            onClick={() => {
              if (pressed !== index) onPick(choice.color)
            }}
          />
        )
      })}
    </div>
  )
}

export function PickerBody({
  title,
  value,
  palette,
  picking = false,
  onPick,
  onSwatch,
  onAdd,
  onBack,
  onClose,
}: {
  title: string
  value: doom.Color | undefined
  palette: Palette
  picking?: boolean
  onPick: (color: doom.Color) => void
  onSwatch?: () => void
  onAdd?: () => void
  onBack?: () => void
  onClose?: () => void
}) {
  const [moreOthers, setMoreOthers] = useState(false)
  const [moreTints, setMoreTints] = useState(false)
  const swatch = (color: doom.Color) => {
    onPick(color)
    onSwatch?.()
  }
  const bases = templateColorColumns(pickerSwatches(palette.templateColors)).map((column) => column.swatch)
  const heldBase = value === undefined ? -1 : bases.findIndex((choice) => matches(choice.color, value))
  const deck = deckChoices(palette)
  const heldDeck = value === undefined ? -1 : deck.findIndex((choice) => matches(choice.color, value))
  const deckShown = visibleChoices(deck, heldDeck, moreOthers, otherLimit - 1)
  const deckPressed = deckShown.findIndex((choice) => value !== undefined && matches(choice.color, value))
  const tints = tintChoices(palette.templateColors, value)
  const heldTint = value === undefined ? -1 : tints.findIndex((choice) => matches(choice.color, value))
  const tintShown = visibleChoices(tints, heldTint, moreTints, tintLimit)
  const deckFocus = deckPressed < 0 ? "0,0" : atOf(deckPressed + 1)
  const templateShown = bases.length > 0
  return (
    <>
      <Heading
        title={title}
        {...(onClose === undefined ? {} : { onClose })}
        leading={
          picking && onBack !== undefined ? (
            <button
              type="button"
              aria-label={colorCopy.back}
              onClick={onBack}
              className="flex size-6 shrink-0 items-center justify-center text-quiet"
            >
              <EditorIcon name="chevl" size={14} />
            </button>
          ) : null
        }
      />
      {picking ? (
        <>
          <CustomColor value={value} palette={palette} onPick={onPick} />
          {tintShown.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[length:var(--type-caption)] text-quiet">{colorCopy.tints}</span>
              <ColorGrid
                label={colorCopy.tints}
                choices={tintShown}
                pressed={tintShown.findIndex((choice) => value !== undefined && matches(choice.color, value))}
                onPick={swatch}
              />
              {tints.length > tintLimit ? (
                <More
                  open={moreTints}
                  show={colorCopy.moreTints}
                  hide={colorCopy.fewerTints}
                  onClick={() => setMoreTints((open) => !open)}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {templateShown ? (
            <div className="flex flex-col gap-2">
              <span className="text-[length:var(--type-caption)] text-quiet">{colorCopy.template}</span>
              <ColorGrid label={colorCopy.template} choices={bases} pressed={heldBase} onPick={swatch} />
            </div>
          ) : null}
          <div className={cn("flex flex-col gap-2", templateShown ? "border-t border-foreground/10 pt-3" : null)}>
            <span className="text-[length:var(--type-caption)] text-quiet">{colorCopy.others}</span>
            <div role="group" aria-label={colorCopy.others} className="grid grid-cols-6 gap-2" onKeyDown={moveFocus}>
              <button
                type="button"
                aria-label={colorCopy.add}
                title={colorCopy.add}
                data-at="0,0"
                tabIndex={deckFocus === "0,0" ? 0 : -1}
                onClick={onAdd}
                className="aspect-square w-full rounded-md"
                style={{ background: rainbow }}
              />
              {deckShown.map((choice, index) => {
                const at = atOf(index + 1)
                return (
                  <Swatch
                    key={choice.name}
                    name={choice.name}
                    css={choice.css}
                    pressed={deckPressed === index}
                    at={at}
                    focused={deckFocus === at}
                    onClick={() => {
                      if (deckPressed !== index) swatch(choice.color)
                    }}
                  />
                )
              })}
            </div>
            {deck.length + 1 > otherLimit ? (
              <More
                open={moreOthers}
                show={colorCopy.moreOthers}
                hide={colorCopy.fewerOthers}
                onClick={() => setMoreOthers((open) => !open)}
              />
            ) : null}
          </div>
        </>
      )}
    </>
  )
}

export function ColorPicker({
  title,
  value,
  palette,
  keepsFormat = false,
  closesOnSwatch = false,
  side = "bottom",
  align = "start",
  trigger,
  children,
  onPick,
}: {
  title: string
  value: doom.Color | undefined
  palette: Palette
  keepsFormat?: boolean
  closesOnSwatch?: boolean
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  trigger: ReactElement
  children: ReactNode
  onPick: (color: doom.Color) => void
}) {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  function setShown(next: boolean) {
    setOpen(next)
    if (!next) setPicking(false)
  }
  return (
    <Popover modal={false} open={open} onOpenChange={setShown}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        aria-label={title}
        finalFocus
        className="max-h-[min(36rem,70vh)] w-60 gap-3 overflow-y-auto p-3 duration-0"
        data-color-picker
        data-keeps-selection
        {...(keepsFormat ? { "data-keeps-format": "" } : {})}
      >
        <PickerBody
          title={title}
          value={value}
          palette={palette}
          picking={picking}
          onPick={onPick}
          onAdd={() => setPicking(true)}
          onBack={() => setPicking(false)}
          onClose={() => setShown(false)}
          {...(closesOnSwatch ? { onSwatch: () => setShown(false) } : {})}
        />
      </PopoverContent>
    </Popover>
  )
}

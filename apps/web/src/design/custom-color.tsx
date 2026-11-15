import type { Color } from "@airdesign/document"
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { colorCopy } from "@/copy/color-copy"
import { hexOf, hsvOf, shownHex, typedColor, type Hsv, type Palette } from "@/design/color-choices"
import { EditorIcon } from "@/editor/editor-icons"
import { cn } from "@/lib/class-names"

type Dropper = { open(): Promise<{ readonly sRGBHex: string }> }

const hueStops = [0, 60, 120, 180, 240, 300, 360]
const hueTrack = `linear-gradient(to right, ${hueStops.map((hue) => `#${hexOf({ hue, saturation: 1, value: 1 })}`).join(", ")})`
const areaShade = "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)"

function dropperOf(): (new () => Dropper) | undefined {
  if (typeof window === "undefined") return undefined
  return (window as { EyeDropper?: new () => Dropper }).EyeDropper
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function percent(value: number): number {
  return Math.round(value * 100)
}

const areaSteps: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

export function CustomColor({
  value,
  palette,
  onPick,
}: {
  value: Color | undefined
  palette: Palette
  onPick: (color: Color) => void
}) {
  const start = value === undefined ? "FFFFFF" : shownHex(value, palette.theme)
  const [hsv, setHsv] = useState<Hsv>(() => hsvOf(start))
  const [typed, setTyped] = useState<string | null>(null)
  const latest = useRef(hsv)
  const dragging = useRef(false)
  const Eyedropper = dropperOf()
  const custom = value !== undefined && "rgb" in value

  useEffect(() => {
    if (dragging.current || hexOf(latest.current) === start) return
    latest.current = hsvOf(start)
    setHsv(latest.current)
  }, [start])

  function show(next: Hsv) {
    latest.current = next
    setHsv(next)
  }

  function pick(hex: string) {
    if (value !== undefined && "rgb" in value && value.rgb === hex) return
    onPick({ rgb: hex })
  }

  function placed(event: PointerEvent<HTMLDivElement>): Hsv {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      ...latest.current,
      saturation: clamp((event.clientX - box.left) / box.width),
      value: clamp(1 - (event.clientY - box.top) / box.height),
    }
  }

  function areaKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = areaSteps[event.key]
    if (step === undefined) return
    event.preventDefault()
    const size = event.shiftKey ? 0.1 : 0.01
    const next = {
      ...latest.current,
      saturation: clamp(latest.current.saturation + step[0] * size),
      value: clamp(latest.current.value + step[1] * size),
    }
    show(next)
    pick(hexOf(next))
  }

  function commitTyped(text: string) {
    setTyped(null)
    const color = typedColor(text)
    if (color === null || !("rgb" in color)) return
    show(hsvOf(color.rgb))
    pick(color.rgb)
  }

  function dropped() {
    if (Eyedropper === undefined) return
    new Eyedropper()
      .open()
      .then((result) => {
        const color = typedColor(result.sRGBHex)
        if (color === null || !("rgb" in color)) return
        show(hsvOf(color.rgb))
        pick(color.rgb)
      })
      .catch(() => undefined)
  }

  const hex = hexOf(hsv)
  return (
    <div className="flex flex-col gap-1.5" data-custom-color>
      <span className="text-[length:var(--type-caption)] text-quiet">{colorCopy.custom}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label={colorCopy.area}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent(hsv.value)}
        aria-valuetext={colorCopy.areaValue(percent(hsv.saturation), percent(hsv.value))}
        className="relative h-32 cursor-crosshair touch-none rounded-[var(--shape-control)]"
        style={{ background: `${areaShade}, #${hexOf({ hue: hsv.hue, saturation: 1, value: 1 })}` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          dragging.current = true
          show(placed(event))
        }}
        onPointerMove={(event) => {
          if (dragging.current) show(placed(event))
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return
          dragging.current = false
          const next = placed(event)
          show(next)
          pick(hexOf(next))
        }}
        onKeyDown={areaKey}
      >
        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 translate-y-1/2 rounded-full shadow-[0_0_0_2px_white,0_0_0_3px_var(--black-10)]"
          style={{ left: `${String(hsv.saturation * 100)}%`, bottom: `${String(hsv.value * 100)}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={359}
        step={1}
        aria-label={colorCopy.hue}
        value={hsv.hue % 360}
        onChange={(event) => show({ ...latest.current, hue: Number(event.target.value) })}
        onPointerUp={() => pick(hexOf(latest.current))}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") pick(hexOf(latest.current))
        }}
        className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_white,0_0_0_3px_var(--black-10)]"
        style={{ background: hueTrack }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={colorCopy.customColor}
          aria-pressed={custom}
          title={colorCopy.hexName(hex)}
          onClick={() => pick(hex)}
          className={cn(
            "size-8 shrink-0 rounded-[var(--shape-control)] shadow-[0px_0px_0px_1px_var(--field-edge)]",
            custom ? "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]" : null,
          )}
          style={{ background: `#${hex}` }}
        />
        <label
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-2.5 shadow-[0px_0px_0px_1px_var(--field-edge)]"
          data-focus-ring
        >
          <span className="shrink-0 text-[length:var(--type-caption)] text-quiet">{colorCopy.hex}</span>
          <input
            aria-label={colorCopy.hex}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            value={typed ?? (value === undefined ? "" : `#${hex}`)}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={(event) => {
              if (typed !== null) commitTyped(event.currentTarget.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitTyped(event.currentTarget.value)
              }
              if (event.key === "Escape" && typed !== null) {
                event.stopPropagation()
                setTyped(null)
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[length:var(--type-dense)] text-foreground uppercase tabular-nums outline-none"
          />
        </label>
        {Eyedropper === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={colorCopy.pick}
            title={colorCopy.pick}
            onClick={dropped}
            className="size-8 shrink-0 rounded-lg text-quiet hover:text-foreground active:translate-y-0"
          >
            <EditorIcon name="dropper" size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}

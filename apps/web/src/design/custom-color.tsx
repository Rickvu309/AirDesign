import * as doom from "@airdesign/doom"
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { colorCopy } from "@/copy/color-copy"
import { hexOf, hsvOf, shownHex, typedColor, type Hsv, type Palette } from "@/design/color-choices"
import { dropperOf, pickScreenColor } from "@/design/eyedropper"
import { EditorIcon } from "@/components/ui/editor-icons"
import { composing } from "@/lib/composing"

const hueStops = [0, 60, 120, 180, 240, 300, 360]
const hueTrack = `linear-gradient(to right, ${hueStops.map((hue) => `#${hexOf({ hue, saturation: 1, value: 1 })}`).join(", ")})`
const areaShade = "linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)"
const thumb =
  "absolute inset-0 m-0 h-3 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_white,0_0_0_3px_var(--black-10)]"

function Slider({
  label,
  min,
  max,
  value,
  track,
  size,
  onChange,
  onCommit,
}: {
  label: string
  min: number
  max: number
  value: number
  track: string
  size?: string
  onChange: (value: number) => void
  onCommit: () => void
}) {
  return (
    <div className="relative h-3">
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ backgroundImage: track, ...(size === undefined ? {} : { backgroundSize: size }) }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") onCommit()
        }}
        className={thumb}
      />
    </div>
  )
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
  ArrowDown: [0, -1],
  ArrowUp: [0, 1],
}

export function CustomColor({
  value,
  palette,
  onPick,
}: {
  value: doom.Color | undefined
  palette: Palette
  onPick: (color: doom.Color) => void
}) {
  const start = value === undefined ? "FFFFFF" : shownHex(value, palette.templateColors)
  const [hsv, setHsv] = useState<Hsv>(() => hsvOf(start))
  const [typed, setTyped] = useState<string | null>(null)
  const latest = useRef(hsv)
  const dragging = useRef(false)
  const areaRef = useRef<HTMLDivElement>(null)
  const Eyedropper = dropperOf()

  useEffect(() => {
    areaRef.current?.focus()
  }, [])

  const seen = useRef(start)
  useEffect(() => {
    if (dragging.current || seen.current === start) return
    seen.current = start
    latest.current = hsvOf(start)
    setHsv(latest.current)
  }, [start, value])

  function show(next: Hsv) {
    latest.current = next
    setHsv(next)
  }

  function commit() {
    const color: doom.Hex = `#${hexOf(latest.current).toLowerCase()}`
    if (value !== undefined && doom.sameColor(color, value)) return
    onPick(color)
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
    commit()
  }

  function commitTyped(text: string) {
    setTyped(null)
    const color = typedColor(text)
    if (color === null) return
    show(hsvOf(color.slice(1)))
    commit()
  }

  function dropped() {
    void pickScreenColor().then((color) => {
      if (color === null) return
      show(hsvOf(color.slice(1)))
      commit()
    })
  }

  const hex = hexOf(hsv)
  return (
    <div className="flex flex-col gap-2" data-custom-color>
      <div
        ref={areaRef}
        role="slider"
        tabIndex={0}
        aria-label={colorCopy.area}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent(hsv.value)}
        aria-valuetext={colorCopy.areaValue(percent(hsv.saturation), percent(hsv.value))}
        className="relative aspect-square cursor-crosshair touch-none rounded-md shadow-[0px_0px_0px_1px_var(--field-edge)]"
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
          show(placed(event))
          commit()
        }}
        onKeyDown={areaKey}
      >
        <span
          className="pointer-events-none absolute size-3 rounded-full border-2 border-white shadow-[0_0_0_1px_var(--black-10)]"
          style={{
            left: `${String(hsv.saturation * 100)}%`,
            bottom: `${String(hsv.value * 100)}%`,
            transform: "translate(-50%, 50%)",
          }}
        />
      </div>
      <div className="flex items-center gap-2">
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
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Slider
            label={colorCopy.hue}
            min={0}
            max={359}
            value={hsv.hue % 360}
            track={hueTrack}
            onChange={(hue) => {
              show({ ...latest.current, hue })
            }}
            onCommit={() => commit()}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-2.5 shadow-[0px_0px_0px_1px_var(--field-edge)]">
          <span className="shrink-0 text-[length:var(--type-caption)] text-quiet">{colorCopy.hex}</span>
          <input
            aria-label={colorCopy.hex}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            value={typed ?? (value === undefined ? "" : hex)}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={(event) => {
              if (typed !== null) commitTyped(event.currentTarget.value)
            }}
            onKeyDown={(event) => {
              if (composing(event)) return
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
      </div>
    </div>
  )
}

import { useState, type KeyboardEvent, type PointerEvent } from "react"
import { Sparkle, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { adjustToneCopy as words } from "@/copy/adjust-tone-copy"
import { dialStep, dialSteps, toneCenter, toneName, type Tone, type TonePoint, type ToneScope } from "@/aira-prompts"
import { cn } from "@/lib/class-names"

export type ToneAction = {
  readonly blocked: string | undefined
  readonly notice: string | undefined
  readonly busy: boolean
  readonly choice: Tone | undefined
  readonly resettable: boolean
  readonly refresh: () => void
  readonly choose: (choice: Tone) => void
  readonly reset: () => void
}

export type ToneControlFor = (scope: ToneScope) => ToneAction

function shiftPoint(point: TonePoint, key: string): TonePoint | undefined {
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return { ...point, column: dialStep(point.column + (key === "ArrowLeft" ? -1 : 1)) }
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    return { ...point, row: dialStep(point.row + (key === "ArrowUp" ? -1 : 1)) }
  }
  return undefined
}

function pointerPoint(event: PointerEvent<HTMLButtonElement>): TonePoint {
  const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
  return {
    column: dialStep(((event.clientX - left) / width) * 3 - 0.5),
    row: dialStep(((event.clientY - top) / height) * 3 - 0.5),
  }
}

function ToneDial({
  point,
  disabled,
  choose,
}: {
  point: TonePoint
  disabled: boolean
  choose: (point: TonePoint) => void
}) {
  const [moved, move] = useState<TonePoint | null>(null)
  const at = moved ?? point

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = shiftPoint(at, event.key)
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    move(next)
  }

  return (
    <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <span>{words.professional}</span>
      <div className="grid w-full grid-cols-[1fr_2fr_1fr] items-center gap-1 text-center">
        <span>{words.concise}</span>
        <button
          type="button"
          className="grid aspect-square touch-none cursor-crosshair grid-cols-3 grid-rows-3 place-items-center rounded-md bg-muted disabled:cursor-default disabled:opacity-50"
          aria-label={`${words.dial}, ${toneName(at)}`}
          aria-description={words.dialKeys}
          disabled={disabled}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return
            event.currentTarget.setPointerCapture(event.pointerId)
            move(pointerPoint(event))
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) move(pointerPoint(event))
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
            const next = pointerPoint(event)
            move(next)
            choose(next)
          }}
          onPointerCancel={() => move(null)}
          onClick={(event) => {
            if (event.detail === 0) choose(at)
          }}
        >
          {dialSteps.flatMap((row) =>
            dialSteps.map((column) => (
              <span
                key={`${row}-${column}`}
                aria-hidden
                className={cn(
                  "size-1 rounded-full bg-muted-foreground",
                  at.row === row && at.column === column && "size-5 bg-foreground ring-4 ring-background",
                )}
              />
            )),
          )}
        </button>
        <span>{words.expanded}</span>
      </div>
      <span>{words.casual}</span>
    </div>
  )
}

export function AdjustTone({ action }: { action: ToneAction }) {
  const { blocked, notice, busy, choice, resettable, refresh, choose, reset } = action
  const point = typeof choice === "object" ? choice : toneCenter

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) refresh()
      }}
    >
      <PopoverTrigger
        render={<Button type="button" variant="ghost" size="icon" className="size-6" aria-label={words.title} />}
      >
        <span className="relative block size-4" aria-hidden>
          <Sparkle className="absolute top-0 left-0 size-3" />
          <Type className="absolute right-0 bottom-0 size-2" />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={12}
        className="gap-3 p-4 motion-reduce:transition-none"
        data-keeps-selection
        data-adjust-tone
      >
        <PopoverTitle>{words.title}</PopoverTitle>
        {blocked === undefined ? (
          <>
            <ToneDial key={toneName(point)} point={point} disabled={busy} choose={choose} />
            {notice === undefined ? null : (
              <p role="status" className="text-muted-foreground">
                {notice}
              </p>
            )}
            <div className="grid grid-cols-2 gap-1">
              {words.presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={choice === preset ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={choice === preset}
                  disabled={busy}
                  onClick={() => choose(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <div className="flex justify-end gap-1 border-t border-line pt-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy || !resettable} onClick={reset}>
                {words.reset}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy || choice === undefined}
                onClick={() => {
                  if (choice !== undefined) choose(choice)
                }}
              >
                {words.retry}
              </Button>
            </div>
          </>
        ) : (
          <p role="status" className="text-muted-foreground">
            {blocked}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

import type { MouseEvent } from "react"
import type { SlideSize } from "@/editor/canvas-zoom"
import { presentCopy } from "@/copy/present-copy"
import { cn } from "@/lib/class-names"
import { FittedSlide, StageButton, type SlidePaint } from "@/present/present-stage"

export type PresentShowProps = {
  readonly title: string
  readonly count: number
  readonly at: number
  readonly size: SlideSize
  readonly paint: SlidePaint
  readonly controls: boolean
  readonly typed: string
  readonly ended: boolean
  readonly onPrevious?: () => void
  readonly onNext?: () => void
  readonly onStop?: () => void
  readonly onPresenter?: () => void
}

function held(event: MouseEvent) {
  event.stopPropagation()
}

export function EndOfDeck({ small = false }: { small?: boolean }) {
  return (
    <div data-present-end className="flex flex-col items-center justify-center gap-1.5 text-center">
      <p
        className={cn(
          "font-medium text-[var(--white-80)]",
          small ? "text-[length:var(--type-dense)]" : "text-[length:var(--type-title)]",
        )}
      >
        {presentCopy.end}
      </p>
      {small ? null : (
        <p className="text-[length:var(--type-dense)] text-[var(--stage-quiet)]">{presentCopy.endHint}</p>
      )}
    </div>
  )
}

function ShowControls(props: PresentShowProps) {
  return (
    <div
      data-show-controls
      onClick={held}
      className={cn(
        "absolute bottom-4 left-4 flex items-center gap-0.5 rounded-xl bg-ink p-1 shadow-[0_0_0_1px_var(--stage-hover)] transition-opacity duration-200 ease-out motion-reduce:transition-none",
        props.controls ? "opacity-100" : "opacity-0 focus-within:opacity-100",
      )}
    >
      <StageButton
        icon="chevl"
        label={presentCopy.previous}
        keys="←"
        {...(props.onPrevious === undefined ? {} : { onClick: props.onPrevious })}
      />
      <span
        aria-hidden
        className="min-w-14 px-1 text-center text-[length:var(--type-dense)] text-[var(--white-80)] tabular-nums"
      >
        {props.at + 1} / {props.count}
      </span>
      <StageButton
        icon="chevr"
        label={presentCopy.next}
        keys="→"
        {...(props.onNext === undefined ? {} : { onClick: props.onNext })}
      />
      <span aria-hidden className="mx-1 block h-5 w-px bg-[var(--stage-hover)]" />
      <StageButton
        icon="presenter"
        label={presentCopy.presenter}
        keys="P"
        {...(props.onPresenter === undefined ? {} : { onClick: props.onPresenter })}
      />
      <StageButton
        icon="x"
        label={presentCopy.stop}
        keys="Esc"
        {...(props.onStop === undefined ? {} : { onClick: props.onStop })}
      />
    </div>
  )
}

function GoTo({ typed }: { typed: string }) {
  return (
    <div
      data-present-go-to
      className="absolute bottom-4 left-1/2 flex h-9 -translate-x-1/2 items-center gap-2 rounded-lg bg-ink px-3 text-[length:var(--type-dense)] text-[var(--white-80)] shadow-[0_0_0_1px_var(--stage-hover)]"
    >
      <span className="tabular-nums">{presentCopy.goTo(typed)}</span>
      <kbd className="rounded-[4px] px-1.5 font-sans text-[length:var(--type-caption)] text-[var(--stage-quiet)] shadow-[inset_0_0_0_1px_var(--stage-hover)]">
        {presentCopy.enter}
      </kbd>
    </div>
  )
}

export function PresentShow(props: PresentShowProps) {
  const onStage = props.ended ? props.onStop : props.onNext
  const said = props.ended ? presentCopy.end : presentCopy.position(props.at + 1, props.count)
  return (
    <section
      aria-label={props.title}
      data-present-show
      data-controls={props.controls}
      className={cn("fixed inset-0 z-50 bg-stage select-none", !props.controls && "cursor-none")}
      {...(onStage === undefined ? {} : { onClick: onStage })}
    >
      {props.ended ? (
        <div className="flex size-full items-center justify-center">
          <EndOfDeck />
        </div>
      ) : (
        <FittedSlide index={props.at} size={props.size} paint={props.paint} className="size-full">
          {props.typed === "" ? null : <GoTo typed={props.typed} />}
          <ShowControls {...props} />
        </FittedSlide>
      )}
      {props.ended ? <ShowControls {...props} /> : null}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </section>
  )
}

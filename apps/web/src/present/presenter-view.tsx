import type { ReactNode } from "react"
import type { SlideSize } from "@/editing/canvas-zoom"
import { presentCopy } from "@/copy/present-copy"
import { slideNumber } from "@/lib/slide-numbering"
import { clockText } from "@/present/present-clock"
import { focusOnOpen } from "@/present/present-focus"
import { EndOfDeck } from "@/present/present-show"
import { FittedSlide, StageButton, StageTextButton, type SlidePaint } from "@/present/present-stage"

export type PresenterViewProps = {
  readonly title: string
  readonly count: number
  readonly at: number
  readonly next: number | null
  readonly size: SlideSize
  readonly paint: SlidePaint
  readonly notes: string
  readonly elapsed: number
  readonly running: boolean
  readonly onPrevious?: () => void
  readonly onNext?: () => void
  readonly onStop?: () => void
  readonly onAudience?: () => void
  readonly onPause?: () => void
  readonly onRestart?: () => void
}

function Caption({ children }: { children: ReactNode }) {
  return <h2 className="text-[length:var(--type-caption)] font-medium text-[var(--stage-quiet)]">{children}</h2>
}

function on(handler: (() => void) | undefined) {
  return handler === undefined ? {} : { onClick: handler }
}

export function PresenterView(props: PresenterViewProps) {
  const position = presentCopy.position(slideNumber(props.at), props.count)
  return (
    <section
      aria-label={presentCopy.presenter}
      data-presenter-view
      tabIndex={-1}
      ref={focusOnOpen}
      className="fixed inset-0 z-50 flex flex-col bg-ink outline-none text-[var(--white-80)]"
    >
      <header className="grid shrink-0 grid-cols-1 py-2 md:h-14 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:py-0 items-center gap-4 border-b border-[var(--stage-hover)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[length:var(--type-dense)] font-medium text-[var(--white-88)]">
            {props.title}
          </span>
          <span className="shrink-0 text-[length:var(--type-dense)] text-[var(--stage-quiet)] tabular-nums">
            {position}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 self-center">
            <StageButton icon="chevl" label={presentCopy.previous} keys="←" {...on(props.onPrevious)} />
            <StageButton icon="chevr" label={presentCopy.next} keys="→" {...on(props.onNext)} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            role="timer"
            data-present-timer
            className="min-w-20 text-center text-[length:var(--type-title)] font-medium text-[var(--white-88)] tabular-nums"
          >
            {clockText(props.elapsed)}
          </span>
          <StageButton
            icon={props.running ? "pause" : "play"}
            label={props.running ? presentCopy.pause : presentCopy.resume}
            {...on(props.onPause)}
          />
          <StageButton icon="restart" label={presentCopy.restart} {...on(props.onRestart)} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <StageTextButton label={presentCopy.audience} {...on(props.onAudience)} />
          <StageTextButton label={presentCopy.stop} {...on(props.onStop)} />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:gap-8 md:p-6">
        <section className="flex min-h-0 flex-col gap-2" data-present-current>
          <Caption>{presentCopy.current}</Caption>
          <FittedSlide index={props.at} size={props.size} paint={props.paint} top className="flex-1" />
        </section>
        <div className="flex min-h-0 flex-col gap-6">
          <section className="flex flex-col gap-2" data-present-next>
            <Caption>{presentCopy.upNext}</Caption>
            <div className="w-full" style={{ aspectRatio: `${props.size.width} / ${props.size.height}` }}>
              {props.next === null ? (
                <div className="flex size-full items-center justify-center bg-stage">
                  <EndOfDeck small />
                </div>
              ) : (
                <FittedSlide
                  index={props.next}
                  size={props.size}
                  paint={props.paint}
                  mark={`next-${props.next + 1}`}
                  className="size-full"
                />
              )}
            </div>
          </section>
          <section className="flex min-h-0 flex-1 flex-col gap-2" data-present-notes>
            <Caption>{presentCopy.notes}</Caption>
            <div className="min-h-0 flex-1 overflow-auto pr-2 text-[length:var(--type-title)] leading-[var(--leading-body)] whitespace-pre-wrap text-[var(--white-88)]">
              {props.notes.trim() === "" ? (
                <span className="text-[length:var(--type-section)] text-[var(--stage-quiet)]">
                  {presentCopy.noNotes}
                </span>
              ) : (
                props.notes
              )}
            </div>
          </section>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {position}
      </p>
    </section>
  )
}

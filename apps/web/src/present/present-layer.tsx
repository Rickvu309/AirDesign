import { createPortal } from "react-dom"
import type { SlideSize } from "@/editing/canvas-zoom"
import { PresentShow } from "@/present/present-show"
import type { SlidePaint } from "@/present/present-stage"
import { nextShown } from "@/present/present-steps"
import { PresenterView } from "@/present/presenter-view"
import type { Present } from "@/present/use-present"

export function PresentLayer({
  present,
  title,
  count,
  size,
  paint,
  notesOf,
  onFollow,
}: {
  present: Present
  title: string
  count: number
  size: SlideSize | null
  paint: SlidePaint
  notesOf?: (index: number) => string
  onFollow?: (point: { readonly x: number; readonly y: number; readonly show: Element }) => boolean
}) {
  const { show } = present
  if (show === null || size === null) return null
  const shown = { title, count, size, paint }
  const moves = {
    onPrevious: () => present.step("previous"),
    onNext: () => present.step("next"),
    onStop: () => present.step("stop"),
  }
  if (show.view === "presenter")
    return createPortal(
      <PresenterView
        {...shown}
        {...moves}
        at={show.at}
        next={show.ended ? null : nextShown({ count, hidden: present.hidden }, show.at)}
        notes={notesOf?.(show.at) ?? ""}
        elapsed={present.elapsed}
        running={present.running}
        onAudience={() => present.step("presenter")}
        onPause={present.pause}
        onRestart={present.restart}
      />,
      document.body,
    )
  return createPortal(
    <PresentShow
      {...shown}
      {...moves}
      at={show.at}
      controls={present.controls}
      typed={show.typed}
      ended={show.ended}
      onPresenter={() => present.step("presenter")}
      onWake={present.wake}
      transitionOf={present.transitionOf}
      morphOf={present.morphOf}
      {...(onFollow === undefined ? {} : { onFollow })}
    />,
    document.body,
  )
}

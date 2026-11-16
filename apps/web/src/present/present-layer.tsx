import { createPortal } from "react-dom"
import type { SlideSize } from "@/editor/canvas-zoom"
import { PresentShow } from "@/present/present-show"
import type { SlidePaint } from "@/present/present-stage"
import { nextShown } from "@/present/present-steps"
import { PresenterView } from "@/present/presenter-view"
import type { Present } from "@/present/use-present"

export function PresentLayer({
  present,
  title,
  count,
  hidden = [],
  size,
  paint,
  notesOf,
}: {
  present: Present
  title: string
  count: number
  hidden?: readonly boolean[]
  size: SlideSize | null
  paint: SlidePaint
  notesOf?: (index: number) => string
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
        next={show.ended ? null : nextShown({ count, hidden }, show.at)}
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
    />,
    document.body,
  )
}

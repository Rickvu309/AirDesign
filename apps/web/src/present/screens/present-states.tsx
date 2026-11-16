import { galleryDeck } from "@/editor/gallery-deck"
import { SlideThumb } from "@/editor/slide-thumb"
import { PresentShow } from "@/present/present-show"
import { PresenterView } from "@/present/presenter-view"

const count = 8
const size = { width: 12_192_000, height: 6_858_000 }
const paint = (index: number, width: number) => <SlideThumb index={index + 1} width={width} />
const shown = { title: galleryDeck.title, count, size, paint }

export function ShowSlide() {
  return <PresentShow {...shown} at={2} controls={false} typed="" ended={false} />
}

export function ShowControls() {
  return <PresentShow {...shown} at={2} controls typed="" ended={false} />
}

export function ShowGoTo() {
  return <PresentShow {...shown} at={2} controls={false} typed="7" ended={false} />
}

export function ShowEnd() {
  return <PresentShow {...shown} at={count - 1} controls={false} typed="" ended />
}

export function Presenter() {
  return <PresenterView {...shown} at={2} next={3} notes={galleryDeck.notes} elapsed={252} running />
}

export function PresenterLast() {
  return <PresenterView {...shown} at={count - 1} next={null} notes="" elapsed={1475} running={false} />
}

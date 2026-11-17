import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { PresentShow } from "./present-show"
import { PresenterView } from "./presenter-view"

const shown = { title: "Q3", count: 12, size: { width: 16, height: 9 }, paint: () => null }

it("says which slide is shown", () => {
  const html = renderToStaticMarkup(<PresentShow {...shown} at={2} controls typed="" ended={false} />)
  expect(html).toContain("Slide 3 of 12")
  expect(html).not.toContain("End of the deck")
})

it("ends the deck with a way out", () => {
  const html = renderToStaticMarkup(<PresentShow {...shown} at={11} controls={false} typed="" ended />)
  expect(html).toContain("End of the deck")
  expect(html).toContain("Click or press Esc to leave")
  expect(html).toContain('aria-label="Stop presenting"')
})

it("gives the presenter the notes, the time and the position", () => {
  const html = renderToStaticMarkup(
    <PresenterView {...shown} at={2} next={3} notes="Lead with the trend" elapsed={252} running />,
  )
  expect(html).toContain("Lead with the trend")
  expect(html).toContain("04:12")
  expect(html).toContain("Slide 3 of 12")
  expect(html).toContain('aria-label="Pause timer"')
})

it("tells the presenter the deck ends after the last slide and when a slide has no notes", () => {
  const html = renderToStaticMarkup(
    <PresenterView {...shown} at={11} next={null} notes="  " elapsed={0} running={false} />,
  )
  expect(html).toContain("End of the deck")
  expect(html).toContain("No speaker notes on this slide")
  expect(html).toContain('aria-label="Resume timer"')
})

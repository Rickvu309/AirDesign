import { gridSectionStarts, slideGroups, type SlideState } from "@airdesign/document"
import { readSections, sectionStarts } from "./section-read.js"
import { writeSections, type SectionPlan } from "./section-write.js"

type Parts = ReadonlyMap<string, Uint8Array>

export function withFileSections<State extends SlideState>(state: State, original: Parts): State {
  if (gridSectionStarts(state) !== undefined) return state
  const starts = sectionStarts(original).flatMap(({ start }) => {
    const id = state.file[start]
    return id === undefined ? [] : [id]
  })
  return { ...state, sectionStarts: starts }
}

export function fileSlideGroups(state: SlideState, original: Parts): ReturnType<typeof slideGroups> {
  return slideGroups(
    withFileSections(state, original),
    sectionStarts(original).map((section) => section.name),
  )
}

export function writeSlideGroups(
  parts: Parts,
  original: Parts,
  state: SlideState,
  minted: ReadonlyMap<string, string>,
): Parts {
  const file = readSections(original)
  const kept = file.flatMap((section, at) => (section.slides.length > 0 ? [at] : []))
  const groups = fileSlideGroups(state, original)
  if (file.length === 0 && groups.length < 2) return parts
  const plan: SectionPlan[] = groups.map((group) => {
    const slides = group.slides.map((id) => minted.get(id) ?? id)
    const from = /^f\d+$/.test(group.key) ? kept[Number(group.key.slice(1))] : undefined
    return from === undefined ? { key: group.key, slides } : { from, slides }
  })
  for (const [at, section] of file.entries()) {
    if (section.slides.length > 0) continue
    let host = -1
    for (let earlier = at - 1; earlier >= 0 && host < 0; earlier -= 1)
      host = plan.findIndex((entry) => "from" in entry && entry.from === earlier)
    plan.splice(host + 1, 0, { from: at, slides: [] })
  }
  return writeSections(parts, plan)
}

import { slideExportLines } from "../slide-export.mjs"

const original = "blank.pptx"
const hidden = "exported-slide-hidden.pptx"
const shown = "exported-slide-shown.pptx"
const part = "ppt/slides/slide1.xml"

export default {
  specs: ["tests/browser/grid-hidden.spec.ts"],
  exports: [hidden, shown],
  originals: [original],
  lines(input) {
    const { parts, pptx } = input
    const before = parts.get(original)
    const skipped = parts.get(hidden)
    const unskipped = parts.get(shown)
    const xml = (deck) => new TextDecoder().decode(deck?.get(part))
    const unexpected = (from, to) => {
      const diff = pptx.deckDiff(from, to)
      return [...diff.added, ...diff.removed, ...diff.changed.filter((name) => name !== part)]
    }
    return [
      ...unexpected(before, skipped).map((name) => `skip: unexpected part ${name}`),
      ...unexpected(skipped, unskipped).map((name) => `unskip: unexpected part ${name}`),
      ...slideExportLines({
        ...input,
        original,
        exported: hidden,
        kept: [...before.keys()].filter((name) => name !== part),
      }),
      ...slideExportLines({
        ...input,
        original: hidden,
        exported: shown,
        kept: [...skipped.keys()].filter((name) => name !== part),
      }),
      ...(xml(skipped).replace(/(<p:sld\b[^>]*?) show="0">/, "$1>") === xml(before)
        ? []
        : ["skip: expected only show=0"]),
      ...(xml(unskipped) === xml(before) ? [] : ["unskip: expected original slide bytes"]),
    ]
  },
}

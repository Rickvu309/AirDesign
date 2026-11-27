import type { Refusal } from "@airdesign/doom"

type Expectation = NonNullable<Refusal["expect"]>

export const fieldForms = {
  "node-id": "1 to 16 of a-z or 0-9, a colon, then 1 to 12 digits.",
  "node-id-or-null": "A node id, or null.",
  "theme-color": "A theme colour, lighter or darker by a percent, or #rrggbb.",
  "font-name": "A letter or digit, then up to 99 letters, digits or spaces.",
  "icon-name": "Letters, digits and dashes, or group/name.",
  "target-role": "A node id, <slide>.title, or *.title.",
  hex: "#rrggbb.",
  stroke: "A theme colour, lighter or darker by a percent, #rrggbb, or none.",
  fill: "A colour, none, {image} or {gradient}.",
  "nonempty-string": "A non-empty string.",
  string: "A string.",
  "safe-string": "A string with no control characters or lone surrogates.",
  object: "An object.",
  list: "A list.",
  boolean: "true or false.",
  pair: "Two values.",
  quad: "Four values.",
  link: "An https or mailto address, or a slide id.",
  "link-or-none": "https, mailto, a slide id, or none.",
  "language-tag": "A language tag such as ja, ko or zh-Hant.",
  padding: "A padding number or t, r, b, l in pixels.",
  "crop-sides": "Percents cut from left, top, right and bottom, each from 0 to 99, leaving some of the picture.",
  "single-line": "One line.",
  "end-arrow": "true, false, or one of none, arrow, triangle, circle.",
  "move-nodes": "Layers to move.",
  layer: "A frame or a shape.",
  "unlocked-layer": "This layer is locked. Unlock it or choose another.",
  "slide-sibling": "Another sibling on the slide.",
  "slide-place": "A place on the slide.",
  slide: "A slide.",
  "read-slide-id": "A slide id from get.",
  "read-slide-group": "a slide group id from get, where a slide line ends with group=<id>",
  "populated-slide-group": "a slide group with at least one slide from get",
  "group-slide-or-null": "a slide id in that group, or null to put these first",
  "other-slide-group": "Use a different slide group.",
  "other-slide-or-null": "Use a different slide, or null to put these first.",
  "slide-group-or-new": "A slide group id, or new.",
  "slide-or-group": "Slide ids, or one slide group id.",
  "after-slide": "A slide id, or null to put it first.",
  "before-or-after-group": "Use before or after with a slide group id. Use after null to put it first.",
  "before-group-only": "Use before only to move a whole slide group. For slides, use after.",
  "first-in-group": "A slide id. Name the group and after null to put it first.",
  "copyable-node": "A slide, a frame or a shape.",
  "valid-piece": "A piece whose layers each hold valid fields.",
  "slide-or-frame": "A slide or a frame.",
  "deck-look": "A name, nameFollows, language, theme, colors or fonts.",
  "grid-rows": "One row or more, each with one cell or more.",
  "nonempty-grid": "One row or more, each with one cell or more. An empty string leaves a cell empty.",
  "needs-rows": "rows to place the grid",
  "destination-slide": "a destination slide id",
  "after-sibling": "Another sibling, or null to put it first. Leave it out to put it last.",
  "same-parent": "Layers that share one parent.",
  frame: "A frame.",
  target: "A node id, a slide role, or every slide's role.",
  "slide-role": "A slide id, then .title, .subtitle or .body.",
  "needs-text": "a text layer",
  "crop-fit": "fit crop, or no fit.",
  "insert-or-text": "Insert or text, not both.",
  "needs-layout": "a row or column layout",
  "line-attachment": "A shape or an image on the same slide, not the line itself.",
  "path-data": "SVG path data.",
  "horizontal-align": "left, center or right.",
  "picture-fill": "An object with image: an https address, or an asset read from the deck.",
  "named-icon": "An icon name such as star, arrow-right or trending-up.",
  batch: "One to one hundred changes.",
} satisfies Record<
  Exclude<
    Expectation,
    { readonly min: number } | { readonly max: number } | { readonly options: readonly string[] }
  >["code"],
  string
>

function expectationWords(expect: Expectation): string {
  switch (expect.code) {
    case "number-range":
      return `A number from ${expect.min} to ${expect.max}.`
    case "integer-range":
      return `A whole number from ${expect.min} to ${expect.max}.`
    case "list-min":
      return expect.min <= 1 ? "A list of at least one." : `A list of at least ${expect.min}.`
    case "one-of":
      return `One of ${expect.options.join(", ")}.`
    case "path-length":
      return `SVG path data, up to ${expect.max} characters.`
    default:
      return fieldForms[expect.code]
  }
}

export function refusalCopy(refusal: Pick<Refusal, "fault" | "expect">): {
  readonly form?: string
  readonly needs?: string
} {
  if (refusal.expect === undefined) return {}
  const text = expectationWords(refusal.expect)
  return refusal.fault === "needs" ? { needs: text } : { form: text }
}

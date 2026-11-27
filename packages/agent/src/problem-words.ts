import * as doom from "@airdesign/doom"

export type Measured = doom.LayoutProblem | doom.ThemeProblem
export type Problem = Measured & { readonly note: string }

function named(fold: doom.Doom, id: doom.NodeId): string {
  const label = doom.propOf(fold.nodes.get(id), "name")
  return label ? `${label} (${id})` : id
}

function overflowNote(problem: Extract<Measured, { code: "overflow" }>): string {
  const { node, need, room, ellipsis } = problem
  if (ellipsis === undefined)
    return `${node}: its words need ${String(need)} px of height and its box holds ${String(room)}, so they spill out; make the box at least ${String(need)} tall or cut words.`
  const resize = ellipsis === "w" ? " or make the box wider" : need > room ? " or make the box taller" : ""
  return `${node}: the label was shortened to fit. Use fewer words${resize}.`
}

export function problemNote(fold: doom.Doom, problem: Measured): string {
  const { node } = problem
  switch (problem.code) {
    case "overflow":
      return overflowNote(problem)
    case "overlap": {
      const { x, y, w, h } = problem.area
      return `${node}: its words and ${problem.with} overlap over ${String(w)}x${String(h)} px at ${String(x)},${String(y)}; move one clear of the other.`
    }
    case "line-crosses-text":
      return `Move ${named(fold, problem.with)} so it no longer crosses ${named(fold, node)}.`
    case "rule-crosses-text":
      return `${named(fold, node)}: the thin rule ${named(fold, problem.with)} runs through its words; use fewer words or a wider box so they clear the rule.`
    case "low-contrast":
      return `${node}: its words reach ${String(problem.ratio)}:1 contrast with what lies behind them, under the ${String(problem.min)}:1 a room can read; set them in the theme colour farthest from that fill, or change the fill.`
    case "off-slide":
      return problem.whole
        ? `${node}: it lies wholly off the slide, where no one sees it.`
        : `${node}: it runs ${String(problem.past)} px past the slide's edge, where the slide cuts it off.`
    case "small-text":
      return `${node}: text at ${String(problem.size)} px is under the ${String(problem.min)} px a room can read on this slide.`
    case "lone-word":
      return problem.extra > 0
        ? `${node}: Shorten the text or widen its box by ${String(problem.extra)} px to keep the last word with the rest.`
        : `${node}: Shorten the text to keep the last word with the rest.`
    case "off-scale":
      return `${node}: size ${String(problem.size)} is off the deck's type scale; the nearest text style is ${problem.style} (${String(problem.to)}).`
    case "off-palette":
      return `${node}: ${problem.color} is not a theme colour, so a new template will not recolour it; the nearest is ${problem.to} (${doom.deckOf(fold).theme.colors[problem.to]}).`
    case "off-font":
      return `${node}: ${problem.font} is not the deck's heading or body font (${problem.to.join(", ")}).`
  }
}

export const worded = (fold: doom.Doom, problems: readonly Measured[]): readonly Problem[] =>
  problems.map((problem) => ({ ...problem, note: problemNote(fold, problem) }))

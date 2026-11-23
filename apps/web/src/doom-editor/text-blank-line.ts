import * as doom from "@airdesign/doom"

export function blankLine(text: doom.Text, theme: doom.Theme, node: doom.Resolved): doom.ResolvedLine {
  const style = theme.textStyles[text.style]
  const area = doom.textArea(node.geometry, node.box.w, node.box.h)
  const padding = text.padding ?? { t: 0, r: 0, b: 0, l: 0 }
  const h = style.size * style.lineHeight
  const free = Math.max(0, area.h - padding.t - padding.b - h)
  return {
    start: 0,
    end: 0,
    x: area.x + padding.l,
    y: area.y + padding.t + (text.alignV === "center" ? free / 2 : text.alignV === "bottom" ? free : 0),
    w: Math.max(2, area.w - padding.l - padding.r),
    h,
    align: text.paras[0]?.align ?? "left",
    runs: [],
  }
}

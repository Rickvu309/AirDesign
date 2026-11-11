import type { CSSProperties } from "react"
import type { CanvasParagraph, CanvasRunStyle, CanvasText } from "./record.js"

export type Scaled = (emu: number) => number

type Styles = {
  readonly fontFamily?: string
  readonly fontSize?: string
  readonly fontStyle?: string
  readonly fontWeight?: string
  readonly color?: string
  readonly lineHeight: string
  readonly textAlign?: CanvasParagraph["align"]
}

export type TextLook = {
  readonly body: CSSProperties
  paragraph(from: number, filled: boolean): Styles
  run(paragraph: number, from: number): Styles
}

export const anchored = { top: "flex-start", middle: "center", bottom: "flex-end" } as const
const pageFont = "var(--font-sans)"
const pageColor = "black"
const naturalLine = "normal"
const noLine = "0"
const loneRun = -1

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === node.ELEMENT_NODE
}

function familyOf(font: string | null): string {
  if (font === null) return pageFont
  return `"${font.replace(/["\\]/g, "\\$&")}", ${pageFont}`
}

function styleOf(run: CanvasRunStyle, scaled: Scaled): Styles {
  return {
    fontFamily: familyOf(run.font),
    fontSize: `${scaled(run.size)}px`,
    fontStyle: run.italic ? "italic" : "normal",
    fontWeight: run.bold ? "700" : "400",
    color: run.color ?? pageColor,
    lineHeight: naturalLine,
  }
}

export function textLook(text: CanvasText, scaled: Scaled): TextLook {
  const paragraphs = new Map(text.paragraphs.map((paragraph) => [paragraph.from, paragraph]))
  return {
    body: {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      justifyContent: anchored[text.anchor],
      minHeight: "100%",
      whiteSpace: text.wrap ? "pre-wrap" : "pre",
    },
    paragraph(from, filled) {
      const paragraph = paragraphs.get(from)
      const lineHeight = filled ? noLine : naturalLine
      if (paragraph === undefined) return { lineHeight }
      return { ...styleOf(paragraph.endStyle, scaled), textAlign: paragraph.align, lineHeight }
    },
    run(from, run) {
      const paragraph = paragraphs.get(from)
      if (paragraph === undefined) return { lineHeight: naturalLine }
      return styleOf(paragraph.runs.find((each) => each.from === run) ?? paragraph.endStyle, scaled)
    },
  }
}

function runsOf(block: HTMLElement): readonly HTMLElement[] {
  return [...block.children].filter(
    (child): child is HTMLElement => isElement(child) && child.dataset.run !== undefined,
  )
}

function isOnlyRun(node: Node): boolean {
  if (!isElement(node)) return node.nodeType === node.TEXT_NODE
  if (node.tagName === "BR") return true
  return node.dataset.run !== undefined && node.children.length === 0
}

export function holdsOnlyRuns(box: HTMLElement): boolean {
  return [...box.childNodes].every(
    (block) => isElement(block) && block.dataset.paragraph !== undefined && [...block.childNodes].every(isOnlyRun),
  )
}

function isFilled(block: HTMLElement): boolean {
  const looseText = [...block.childNodes].some((node) => node.nodeType === node.TEXT_NODE && node.textContent !== "")
  return !looseText && runsOf(block).some((run) => run.textContent !== "")
}

export function restyle(box: HTMLElement, look: TextLook): void {
  for (const block of box.children) {
    if (!isElement(block) || block.dataset.paragraph === undefined) continue
    const from = Number(block.dataset.paragraph)
    Object.assign(block.style, look.paragraph(from, isFilled(block)))
    for (const span of runsOf(block)) {
      const [paragraph, run] = (span.dataset.run ?? "").split(".").map(Number)
      Object.assign(span.style, look.run(from, paragraph === from && run !== undefined ? run : loneRun))
    }
  }
}

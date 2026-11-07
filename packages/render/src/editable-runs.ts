import type { Run } from "../../deck/src/model.ts"
export function editableRuns(root: HTMLElement, styles: [Run, ...Run[]], fallback = styles[0]): [Run, ...Run[]] {
  const runs: Run[] = []
  function append(text: string, style: Run) {
    if (!text) return
    const last = runs.at(-1)
    if (last && last.bold === style.bold && Boolean(last.italic) === Boolean(style.italic) && Boolean(last.underline) === Boolean(style.underline) && last.font === style.font && last.size === style.size && last.color === style.color) last.text += text
    else runs.push({ ...style, text })
  }
  function visit(node: Node, style: Run) {
    if (node.nodeType === 3) { append(node.textContent ?? "", style); return }
    if (!(node instanceof root.ownerDocument.defaultView!.HTMLElement)) return
    const index = node.dataset.runStyle
    const inherited = styles.find(run => JSON.stringify({ ...run, text: "" }) === index) ?? style
    if (node.tagName === "BR") { if (node.nextSibling || (node.previousSibling && node.previousSibling.nodeName !== "BR")) append("\n", inherited); return }
    const siblings = [...node.parentNode!.childNodes].filter(child => child.nodeName === "DIV" || child.nodeName === "P" || child.nodeName === "BR" || Boolean(child.textContent))
    const previous = siblings[siblings.indexOf(node) - 1]
    const next = siblings[siblings.indexOf(node) + 1]
    const block = node.tagName === "DIV" || node.tagName === "P"
    if (block && previous) append("\n", inherited)
    if (!(block && node.childNodes.length === 1 && node.firstChild?.nodeName === "BR")) for (const child of node.childNodes) visit(child, inherited)
    if (block && next && next.nodeName !== "DIV" && next.nodeName !== "P") append("\n", inherited)
  }
  for (const child of root.childNodes) visit(child, fallback)
  const first = runs[0]
  return first ? [first, ...runs.slice(1)] : [{ ...fallback, text: "" }]
}

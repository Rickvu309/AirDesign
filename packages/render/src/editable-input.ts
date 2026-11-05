import type { Run } from "../../deck/src/model.ts"
import { editableRuns } from "./editable-runs.ts"
function runSpan(node: HTMLElement, run: Run) {
  const span = node.ownerDocument.createElement("span")
  span.textContent = run.text
  span.dataset.runStyle = JSON.stringify({ ...run, text: "" })
  Object.assign(span.style, { fontFamily: "Geist", fontSize: `${run.size}px`, fontWeight: run.bold ? "600" : "400", color: run.color })
  return span
}
export function canonicalChildren(node: HTMLElement, runs: [Run, ...Run[]]) {
  const selection = node.ownerDocument.getSelection()
  function offset(target: Node | null, index: number) {
    if (!target || !node.contains(target)) return null
    const range = node.ownerDocument.createRange()
    range.selectNodeContents(node)
    range.setEnd(target, index)
    const prefix = node.ownerDocument.createElement("div")
    prefix.append(range.cloneContents())
    return editableRuns(prefix, runs).reduce((length, run) => length + run.text.length, 0)
  }
  const anchor = offset(selection?.anchorNode ?? null, selection?.anchorOffset ?? 0)
  const focus = offset(selection?.focusNode ?? null, selection?.focusOffset ?? 0)
  node.replaceChildren(...runs.map(run => runSpan(node, run)))
  function point(position: number): [Node, number] {
    for (const span of node.childNodes) {
      const text = span.firstChild
      if (!text) continue
      if (position <= (text.textContent?.length ?? 0)) return [text, position]
      position -= text.textContent?.length ?? 0
    }
    return [node, node.childNodes.length]
  }
  if (anchor !== null && focus !== null) selection?.setBaseAndExtent(...point(anchor), ...point(focus))
}
export function normalizeEditable(node: HTMLElement, runs: [Run, ...Run[]]) {
  const unsupported = [...node.querySelectorAll("*")].some(child => {
    if (child.tagName === "BR") return false
    if ((child.tagName === "DIV" || child.tagName === "P") && !child.getAttribute("style")) return false
    if (!(child instanceof node.ownerDocument.defaultView!.HTMLElement)) return true
    const style = runs.find(run => JSON.stringify({ ...run, text: "" }) === child.dataset.runStyle)
    return child.tagName !== "SPAN" || !style || child.style.cssText !== runSpan(node, style).style.cssText
  })
  if (!unsupported) return
  canonicalChildren(node, runs)
}

export function quietFocusUntilTab(root: HTMLElement): () => void {
  const quiet = () => {
    root.dataset.quietFocus = ""
  }
  const show = (event: KeyboardEvent) => {
    if (event.key === "Tab") delete root.dataset.quietFocus
  }
  quiet()
  root.ownerDocument.addEventListener("pointerdown", quiet, true)
  root.ownerDocument.addEventListener("keydown", show, true)
  return () => {
    root.ownerDocument.removeEventListener("pointerdown", quiet, true)
    root.ownerDocument.removeEventListener("keydown", show, true)
    delete root.dataset.quietFocus
  }
}

export function focusOnOpen(node: HTMLElement | null) {
  node?.focus({ preventScroll: true })
}

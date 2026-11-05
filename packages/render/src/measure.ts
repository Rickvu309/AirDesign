import { waitForFonts } from "./fonts.ts"
export type LayoutItem = { id: string; x: number; y: number; width: number; height: number; clippedText: boolean }
export async function measure(root: HTMLElement): Promise<LayoutItem[]> {
  await waitForFonts(root.ownerDocument)
  const bounds = root.getBoundingClientRect()
  const scale = root.offsetWidth ? bounds.width / root.offsetWidth : 1
  return Array.from(root.querySelectorAll<HTMLElement>("[data-element]")).map(node => {
    const box = node.getBoundingClientRect()
    const text = node.querySelector<HTMLElement>("[data-text]")
    return { id: node.dataset.element ?? "", x: (box.x - bounds.x) / scale, y: (box.y - bounds.y) / scale, width: box.width / scale, height: box.height / scale, clippedText: Boolean(text && (text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1)) }
  })
}

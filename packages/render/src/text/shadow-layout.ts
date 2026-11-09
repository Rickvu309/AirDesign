export function layoutTextShadows(root: ParentNode | void = document): void {
  for (const frame of (root ?? document).querySelectorAll<HTMLElement>("[data-text-frame]")) {
    const layers = frame.querySelector<HTMLElement>("[data-text-shadow-layers]")
    if (!layers) continue
    layers.replaceChildren()
    const frameBox = frame.getBoundingClientRect(), scaleX = frameBox.width / frame.offsetWidth, scaleY = frameBox.height / frame.offsetHeight
    if (!scaleX || !scaleY) continue
    for (const run of frame.querySelectorAll<HTMLElement>("[data-text-shadow]")) {
      const paragraph = run.closest<HTMLElement>("[data-paragraph]")
      if (!paragraph || !run.textContent) continue
      const clone = paragraph.cloneNode(true)
      if (!(clone instanceof HTMLElement)) continue
      const range = document.createRange()
      range.selectNodeContents(run)
      const glyphs = range.getBoundingClientRect(), box = paragraph.getBoundingClientRect(), computed = getComputedStyle(paragraph)
      const x = (glyphs.x - box.x) / scaleX, y = (glyphs.y - box.y) / scaleY, width = glyphs.width / scaleX, height = glyphs.height / scaleY
      const alignment = run.dataset.shadowAlignment ?? "b", horizontal = alignment.endsWith("l") || alignment === "l" ? 0 : alignment.endsWith("r") || alignment === "r" ? 1 : 0.5, vertical = alignment.startsWith("t") ? 0 : alignment.startsWith("b") ? 1 : 0.5
      const originX = x + width * horizontal, originY = y + height * vertical
      const sx = Number(run.dataset.shadowSx), sy = Number(run.dataset.shadowSy), kx = Math.tan(Number(run.dataset.shadowKx) * Math.PI / 180), ky = Math.tan(Number(run.dataset.shadowKy) * Math.PI / 180)
      const direction = Number(run.dataset.shadowDirection) * Math.PI / 180, distance = Number(run.dataset.shadowDistance), dx = Math.cos(direction) * distance, dy = Math.sin(direction) * distance
      const a = sx, b = ky * sx, c = kx * sy, d = sy
      const wrapper = document.createElement("div")
      wrapper.dataset.textShadowLayer = ""
      Object.assign(wrapper.style, {position: "absolute", left: `${(box.x - frameBox.x) / scaleX}px`, top: `${(box.y - frameBox.y) / scaleY}px`, width: `${box.width / scaleX}px`, height: `${box.height / scaleY}px`, filter: `blur(${Number(run.dataset.shadowBlur) / 2}px)`, opacity: run.dataset.shadowOpacity})
      for (const element of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
        element.removeAttribute("id")
        element.removeAttribute("data-paragraph")
        element.removeAttribute("data-text-shadow")
        element.style.visibility = "hidden"
        element.style.backgroundColor = "transparent"
      }
      const selected = clone.querySelector<HTMLElement>(`[data-text-run="${run.dataset.textRun}"]`)
      if (!selected) continue
      for (const element of [selected, ...selected.querySelectorAll<HTMLElement>("*")]) {
        element.style.visibility = "visible"
        element.style.color = run.dataset.shadowColor ?? "#000000"
        element.style.opacity = "1"
      }
      Object.assign(clone.style, {position: "absolute", left: "0", top: "0", width: `${paragraph.offsetWidth}px`, height: `${paragraph.offsetHeight}px`, boxSizing: "border-box", margin: "0", whiteSpace: computed.whiteSpace, overflowWrap: computed.overflowWrap, transformOrigin: "0 0", transform: `matrix(${a},${b},${c},${d},${originX - a * originX - c * originY + dx},${originY - b * originX - d * originY + dy})`})
      wrapper.append(clone)
      layers.append(wrapper)
    }
  }
}

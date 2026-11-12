export function pageKit(options) {
  const styles = new Map()
  const boxes = new Map()
  const shown = new Map()
  const colors = new Map()
  const memos = new Map()
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  const style = (element) => {
    if (!styles.has(element)) styles.set(element, getComputedStyle(element))
    return styles.get(element)
  }
  const box = (element) => {
    if (!boxes.has(element)) {
      const { x, y, width, height } = element.getBoundingClientRect()
      boxes.set(element, { x, y, width, height })
    }
    return boxes.get(element)
  }
  const visible = (element) => {
    if (shown.has(element)) return shown.get(element)
    const at = box(element)
    const result =
      element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
      at.width > 1 &&
      at.height > 1 &&
      at.x < innerWidth &&
      at.y < innerHeight &&
      at.x + at.width > 0 &&
      at.y + at.height > 0
    shown.set(element, result)
    return result
  }
  const rgba = (color) => {
    if (!colors.has(color)) {
      probe.clearRect(0, 0, 1, 1)
      probe.fillStyle = "rgba(0, 0, 0, 0)"
      probe.fillStyle = color
      probe.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
      colors.set(color, [r, g, b, a / 255])
    }
    return colors.get(color)
  }
  const textNodes = (element) =>
    [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "")
  const ownText = (element) =>
    textNodes(element)
      .map((node) => node.textContent.trim())
      .join(" ")
      .replace(/\s+/g, " ")
  const text = (element) => (element.innerText ?? element.textContent ?? "").trim().replace(/\s+/g, " ")
  const textRects = (element) =>
    textNodes(element).flatMap((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    })
  const sides = ["Top", "Right", "Bottom", "Left"]
  const closedBorder = (element) =>
    sides.every((side) => {
      const s = style(element)
      return (
        parseFloat(s[`border${side}Width`]) > 0 &&
        !["none", "hidden"].includes(s[`border${side}Style`]) &&
        rgba(s[`border${side}Color`])[3] > 0.1
      )
    })
  const outline = (element) => {
    const s = style(element)
    return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && rgba(s.outlineColor)[3] > 0.1
  }
  const ringSpread = (element) => {
    const shadow = style(element).boxShadow
    if (shadow === "none") return 0
    const rings = shadow
      .split(/,(?![^(]*\))/)
      .map((part) => part.trim())
      .filter((part) => !part.includes("inset"))
      .map((part) => {
        const color = part.match(/rgba?\([^)]*\)|#[0-9a-f]+|[a-z]+/i)?.[0] ?? "transparent"
        const lengths = part
          .replace(color, "")
          .trim()
          .split(/\s+/)
          .map((word) => parseFloat(word))
        return rgba(color)[3] > 0.1 && lengths[0] === 0 && lengths[1] === 0 && lengths[2] === 0 ? lengths[3] : 0
      })
    return Math.max(0, ...rings)
  }
  const frameBox = (element) => {
    const at = box(element)
    const grow = (by) => ({ x: at.x - by, y: at.y - by, width: at.width + by * 2, height: at.height + by * 2 })
    if (outline(element)) {
      const s = style(element)
      return grow(parseFloat(s.outlineOffset) + parseFloat(s.outlineWidth))
    }
    const spread = ringSpread(element)
    if (spread > 0) return grow(spread)
    return closedBorder(element) ? at : null
  }
  const fill = (element) => {
    const s = style(element)
    return rgba(s.backgroundColor)[3] > 0.1 || s.backgroundImage !== "none"
  }
  const graphic = (element) => ["svg", "img", "canvas", "video", "picture"].includes(element.localName)
  const content = (element) => element.closest("[data-slide-paint],[data-thumb-paint],[data-slide-thumb]") !== null
  const thumbnail = (element) => element.closest("[data-thumb-paint],[data-slide-thumb]") !== null
  const raised = (element, below) => {
    for (let at = element; at && at !== below && !at.contains(below); at = at.parentElement) {
      const s = style(at)
      if (s.boxShadow !== "none" || Number(s.zIndex) >= 10 || s.position === "fixed") return true
      if (at.matches('dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"]')) return true
    }
    return false
  }
  const floating = (element) =>
    element.closest('dialog,[popover],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"]') !== null ||
    (() => {
      for (let at = element; at; at = at.parentElement) if (style(at).position === "fixed") return true
      return false
    })()
  const describe = (element) => {
    const handle = [...element.attributes].find(
      (attribute) => attribute.name.startsWith("data-") && !["data-slot", "data-state"].includes(attribute.name),
    )
    const label = element.getAttribute("aria-label") ?? ownText(element)
    return `${element.localName}${handle ? `[${handle.name}]` : ""}${label ? ` "${label.slice(0, 40)}"` : ""}`
  }
  const noisy = new Set(["data-slot", "data-state", "data-open", "data-closed", "data-active", "data-orientation"])
  const unique = (candidate, element) => {
    try {
      const found = document.querySelectorAll(candidate)
      return found.length === 1 && found[0] === element
    } catch {
      return false
    }
  }
  const handleOf = (element) => {
    if (element.id && unique(`#${CSS.escape(element.id)}`, element)) return `#${CSS.escape(element.id)}`
    for (const attribute of element.attributes) {
      if (!attribute.name.startsWith("data-") || noisy.has(attribute.name)) continue
      const bare = attribute.value === "" || attribute.value === "true"
      const candidate = bare ? `[${attribute.name}]` : `[${attribute.name}=${JSON.stringify(attribute.value)}]`
      if (unique(candidate, element)) return candidate
    }
    for (const name of ["aria-label", "role", "contenteditable", "placeholder"]) {
      if (!element.hasAttribute(name)) continue
      const candidate = `${element.localName}[${name}=${JSON.stringify(element.getAttribute(name))}]`
      if (unique(candidate, element)) return candidate
    }
    return null
  }
  const step = (element) => {
    const same = [...(element.parentElement?.children ?? [])].filter((each) => each.localName === element.localName)
    return same.length > 1 ? `${element.localName}:nth-of-type(${same.indexOf(element) + 1})` : element.localName
  }
  const selector = (element) =>
    memo(element, () => {
      const own = handleOf(element)
      if (own) return own
      const path = []
      let anchor = "body"
      for (let at = element; at && at !== document.body; at = at.parentElement) {
        const handle = at === element ? null : handleOf(at)
        if (handle) {
          anchor = handle
          break
        }
        path.unshift(step(at))
      }
      for (let keep = 1; keep < path.length; keep += 1) {
        const short = `${anchor} ${path.slice(-keep).join(" > ")}`
        if (unique(short, element)) return short
      }
      return [anchor, ...path].join(" > ")
    })
  const memo = (key, make) => {
    if (!memos.has(key)) memos.set(key, make())
    return memos.get(key)
  }
  const elements = [...document.body.querySelectorAll("*")].filter(
    (element) => !["script", "style", "template", "noscript"].includes(element.localName) && visible(element),
  )
  return {
    options,
    width: innerWidth,
    height: innerHeight,
    elements,
    style,
    box,
    visible,
    rgba,
    ownText,
    text,
    textRects,
    frameBox,
    fill,
    graphic,
    content,
    thumbnail,
    floating,
    raised,
    describe,
    selector,
    memo,
  }
}

export const truncatedText = {
  name: "truncated-text",
  rank: 2,
  reads: "text-overflow, line clamp, hidden overflow, scroll and client size",
  cannot: "whether a cut was meant, such as a long deck name in a fixed card",
  inspect: (element, page) => {
    const style = page.style(element)
    const ellipsis = style.textOverflow === "ellipsis"
    const clamp = style.webkitLineClamp !== "none" && style.webkitLineClamp !== ""
    const hidden = ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflowY)
    if (!ellipsis && !clamp && !hidden) return
    const text = page.text(element)
    if (text === "") return
    const inline = [...element.children].every((child) => page.style(child).display.startsWith("inline"))
    if (!ellipsis && !clamp && !inline) return
    const wide = element.scrollWidth > element.clientWidth + 1
    const tall = element.scrollHeight > element.clientHeight + 1
    if (!(clamp ? tall : wide || (tall && !ellipsis))) return
    const how = clamp ? "a line clamp" : ellipsis ? "an ellipsis" : "hidden overflow"
    return `Text is cut by ${how}, so a person cannot read all of "${text.slice(0, 120)}".`
  },
}

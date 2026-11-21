export const pageWidth = 1200

const kindWords = { decide: "Decision", explain: "How it works", assure: "Result" }
const verdictWords = { passed: "Passed", open: "Open", failed: "Failed" }

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (mark) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[mark])

const linked = (ref) => /^https?:\/\//.test(ref)

const longestRef = 22

export function shortRef(ref) {
  const pull = ref.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
  if (pull) return `PR ${pull[1]}`
  const short = linked(ref)
    ? decodeURIComponent(new URL(ref).pathname.split("/").filter(Boolean).at(-1) ?? ref)
    : (ref.split("/").at(-1) ?? ref)
  return short.length > longestRef ? `…${short.slice(-(longestRef - 1))}` : short
}

const splitLine = (group) => `Split by ${group.axis}. Covers ${group.covers}.`

function markdownNode(node, indent) {
  const pad = "  ".repeat(indent)
  const verdict = node.verdict ? ` (${verdictWords[node.verdict]})` : ""
  const lines = [`${pad}- **${node.label}.** ${node.claim}${node.chosen ? " (chosen)" : ""}${verdict}`]
  if (node.detail) lines.push("", `${pad}  ${node.detail}`)
  if (node.group) lines.push("", `${pad}  ${splitLine(node.group)}`)
  for (const piece of node.evidence ?? []) {
    const ref = linked(piece.ref) ? `[${shortRef(piece.ref)}](${piece.ref})` : `\`${piece.ref}\``
    const tag = piece.source === "Observed" ? "" : `${piece.source}: `
    lines.push(`${pad}  - ${tag}${ref}${piece.verdict ? ` (${piece.verdict})` : ""}`)
  }
  for (const child of node.children ?? []) lines.push(...markdownNode(child, indent + 1))
  return lines
}

export function toMarkdown(tree) {
  const verdict = tree.verdict ? ` (${verdictWords[tree.verdict]})` : ""
  return [
    `**${kindWords[tree.kind]}.** ${tree.claim}${verdict}`,
    ...(tree.detail ? ["", tree.detail] : []),
    "",
    `*${tree.question}*`,
    "",
    splitLine(tree.group),
    "",
    ...tree.children.flatMap((child) => markdownNode(child, 0)),
    "",
  ].join("\n")
}

const widths = [210, 220, 210, 200]
const gap = 36
const imageRef = /\.(png|jpe?g|webp|gif)(\?.*)?$/i
const ink = "#1d1d1d"

const mark = (verdict) => {
  if (verdict === null || verdict === undefined) return ""
  if (verdict === "passed") return ' <span class="mark passed">✓</span>'
  return ` <span class="mark ${verdict}">${verdict === "open" ? "○ Open" : "✕ Failed"}</span>`
}

function thumbnail(node, images) {
  const picture = (node.evidence ?? []).find((piece) => imageRef.test(piece.ref) && !images.shown.has(piece.ref))
  if (picture === undefined) return ""
  images.shown.add(picture.ref)
  const source = images.local[picture.ref] ?? (/^https:\/\//.test(picture.ref) ? picture.ref : null)
  return source === null ? "" : `<img class="thumb" src="${escape(source)}" alt="">`
}

const unbuilt = (node) => node.evidence?.length > 0 && node.evidence.every((piece) => piece.source === "Proposal")

function boxClass(node, depth, choosing) {
  const names = ["box", `d${String(depth)}`]
  if (unbuilt(node)) names.push("unbuilt")
  if (choosing) names.push(node.chosen ? "chosen" : "passed-over")
  return names.join(" ")
}

function nodeHtml(node, depth, images, choosing = false) {
  const badge = depth === 0 ? "" : `<span class="badge">${node.label}</span>`
  const tag = choosing && node.chosen ? '<span class="tag">Chosen</span>' : ""
  const box = `<div class="${boxClass(node, depth, choosing)}">${badge}${tag}<p class="claim">${escape(node.claim)}${mark(node.verdict)}</p>${thumbnail(node, images)}</div>`
  const decide = depth === 0 && node.group?.axis === "options"
  const children = node.children
    ? `<div class="kids">${node.children.map((child) => nodeHtml(child, depth + 1, images, decide)).join("")}</div>`
    : ""
  return `<div class="node">${box}${children}</div>`
}

const capital = (word) => word[0].toUpperCase() + word.slice(1)

function headsHtml(tree) {
  const axes = []
  const walk = (node, depth) => {
    if (!node.children) return
    axes[depth] ??= new Set()
    axes[depth].add(node.group.axis)
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(tree, 0)
  const cells = [`<div class="head" style="width:${String(widths[0])}px"></div>`]
  for (const [depth, set] of axes.entries())
    cells.push(
      `<div class="head" style="width:${String(widths[depth + 1] + gap)}px;padding-left:${String(gap)}px">${set.size === 1 ? capital([...set][0]) : "Detail"}</div>`,
    )
  return `<div class="heads">${cells.join("")}</div>`
}

function stepHtml(node, images) {
  const points = node.children
    ? `<ul class="points">${node.children.map((child) => `<li${unbuilt(child) ? ' class="unbuilt"' : ""}><b>${child.label}</b>${escape(child.claim)}${mark(child.verdict)}</li>`).join("")}</ul>`
    : ""
  return `<div class="${boxClass(node, 1, false)} step"><span class="badge">${node.label}</span><p class="claim">${escape(node.claim)}${mark(node.verdict)}</p>${thumbnail(node, images)}${points}</div>`
}

function flowHtml(tree, images) {
  const steps = tree.children.map((child) => stepHtml(child, images)).join('<i class="arrow"></i>')
  const loop = tree.group.loop ? '<i class="loop-over"></i><i class="loop-back"></i>' : ""
  return `<p class="answer">${escape(tree.claim)}${mark(tree.verdict)}</p>
<section class="flow${tree.group.loop ? " loops" : ""}">${loop}${steps}</section>`
}

const style = `*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{width:${String(pageWidth)}px;font-family:"Inter Variable",system-ui,sans-serif;color:${ink};-webkit-font-smoothing:antialiased}
main{width:max-content;min-width:560px;padding:26px 32px 28px}
.kicker{font-size:13px;line-height:18px;color:#6b6b6b}
.heads{display:flex;margin-top:20px;font-size:11px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:#8a8a8a}
.head{flex:none}
.tree{display:flex;margin-top:8px}
.node{display:flex;align-items:center}
.box{position:relative;flex:none;width:var(--width);padding:12px 14px}
.box::before{content:"";position:absolute;inset:0;border:2.4px solid ${ink};border-radius:5px;filter:url(#rough);pointer-events:none}
.d0{--width:${String(widths[0])}px}.d0::before{border-width:3.4px}
.d1{--width:${String(widths[1])}px}.d2{--width:${String(widths[2])}px}.d3{--width:${String(widths[3])}px}
.unbuilt::before{border-style:dashed;border-width:2px}
.passed-over{color:#9a9a9a}.passed-over::before{border-color:#c4c4c4}.passed-over .claim{color:#9a9a9a;font-weight:500}.passed-over .badge{background:#bdbdbd}
.chosen::before{border-width:3.6px}
.tag{position:absolute;top:-10px;left:12px;background:${ink};color:#fff;font-size:10.5px;font-weight:650;letter-spacing:.06em;padding:1px 8px;border-radius:999px;box-shadow:0 0 0 3px #fff}
.badge{position:absolute;top:-12px;right:-10px;width:26px;height:26px;border-radius:50%;background:${ink};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 0 0 3px #fff}
.claim{margin:0;font-size:14px;line-height:19px;font-weight:560}
.d0 .claim{font-size:18px;line-height:24px;font-weight:720}
.mark{font-size:12px;font-weight:650;white-space:nowrap}
.mark.passed{color:#9a9a9a}.mark.open{color:#8a6d00}.mark.failed{color:#a32020}
.thumb{display:block;width:100%;height:96px;object-fit:cover;object-position:top;margin-top:9px;border:1px solid #d6d6d6;border-radius:3px}
.kids{display:flex;flex-direction:column;position:relative;padding-left:${String(gap)}px}
.kids::before{content:"";position:absolute;left:0;top:50%;width:${String(gap / 2)}px;border-top:2px solid ${ink};filter:url(#rough)}
.kids>.node{position:relative;padding:8px 0}
.kids>.node::before{content:"";position:absolute;left:-${String(gap / 2)}px;top:50%;width:${String(gap / 2)}px;border-top:2px solid ${ink};filter:url(#rough)}
.kids>.node::after{content:"";position:absolute;left:-${String(gap / 2)}px;top:0;bottom:0;border-left:2px solid ${ink};filter:url(#rough)}
.kids>.node:first-child::after{top:50%}
.kids>.node:last-child::after{bottom:50%}
.answer{margin:14px 0 0;font-size:19px;line-height:25px;font-weight:720}
.flow{position:relative;display:flex;align-items:stretch;margin-top:30px}
.flow.loops{margin-top:76px;margin-right:30px}
.step{display:flex;flex-direction:column;justify-content:center;--width:${String(widths[1])}px}
.arrow{flex:none;align-self:center;position:relative;width:50px;height:0;border-top:2.2px solid ${ink};filter:url(#rough)}
.arrow::after{content:"";position:absolute;right:-2px;top:-7.5px;border:6.5px solid transparent;border-left:11px solid ${ink};border-right:0}
.loop-over{position:absolute;top:-48px;left:${String(widths[1] / 2)}px;right:-28px;height:48px;border:2.2px solid ${ink};border-bottom:0;border-radius:10px 10px 0 0;filter:url(#rough)}
.loop-over::after{content:"";position:absolute;left:-8px;bottom:-2px;border:6.5px solid transparent;border-top:11px solid ${ink};border-bottom:0}
.loop-back{position:absolute;top:-2px;right:-28px;width:28px;height:50%;border-right:2.2px solid ${ink};border-bottom:2.2px solid ${ink};border-radius:0 0 10px 0;filter:url(#rough)}
.points{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:12.5px;line-height:17px;color:#444}
.points li.unbuilt{border:1.6px dashed #9a9a9a;border-radius:4px;padding:2px 6px}
.points b{display:inline-block;min-width:22px;font-size:11px;color:${ink}}
.legend{margin-top:16px;font-size:12px;color:#8a8a8a}`

const rough = `<svg width="0" height="0" style="position:absolute"><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></svg>`

function anyUnbuilt(node) {
  return unbuilt(node) || (node.children ?? []).some(anyUnbuilt)
}

export function toHtml(tree, css = "", local = {}) {
  const images = { local, shown: new Set() }
  const body =
    tree.group.axis === "steps"
      ? flowHtml(tree, images)
      : `${headsHtml(tree)}<section class="tree">${nodeHtml(tree, 0, images)}</section>`
  const legend = anyUnbuilt(tree) ? '<p class="legend">Dashed: not built yet</p>' : ""
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}${style}</style></head><body>${rough}<main>
<p class="kicker">${escape(tree.question)}</p>
${body}
${legend}
</main></body></html>`
}

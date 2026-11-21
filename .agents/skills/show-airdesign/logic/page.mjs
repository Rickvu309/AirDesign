export const pageWidth = 1200

const kindWords = { decide: "Decision", explain: "How it works", assure: "Result" }
const verdictWords = { passed: "Passed", open: "Open", failed: "Failed" }

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (mark) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[mark])

const linked = (ref) => /^https?:\/\//.test(ref)

const longestRef = 22

export function shortRef(ref) {
  const short = linked(ref)
    ? decodeURIComponent(new URL(ref).pathname.split("/").filter(Boolean).at(-1) ?? ref)
    : (ref.split("/").at(-1) ?? ref)
  return short.length > longestRef ? `…${short.slice(-(longestRef - 1))}` : short
}

function evidenceOf(tree) {
  if (tree.evidence) return tree.evidence
  return (tree.children ?? []).flatMap(evidenceOf)
}

const splitLine = (group) => `Split by ${group.axis}. Covers ${group.covers}.`

function markdownNode(node, indent) {
  const pad = "  ".repeat(indent)
  const verdict = node.verdict ? ` (${verdictWords[node.verdict]})` : ""
  const lines = [`${pad}- **${node.label}.** ${node.claim}${verdict}`]
  if (node.group) lines.push(`${pad}  ${splitLine(node.group)}`)
  for (const piece of node.evidence ?? []) {
    const ref = linked(piece.ref) ? `[${shortRef(piece.ref)}](${piece.ref})` : `\`${piece.ref}\``
    const verdictWord = piece.verdict ? `, ${piece.verdict}` : ""
    lines.push(`${pad}  - ${piece.source}${verdictWord}: ${ref}`)
  }
  for (const child of node.children ?? []) lines.push(...markdownNode(child, indent + 1))
  return lines
}

export function toMarkdown(tree) {
  const verdict = tree.verdict ? ` (${verdictWords[tree.verdict]})` : ""
  return [
    `**${kindWords[tree.kind]}.** ${tree.claim}${verdict}`,
    "",
    `*${tree.question}*`,
    "",
    splitLine(tree.group),
    "",
    ...tree.children.flatMap((child) => markdownNode(child, 0)),
    "",
  ].join("\n")
}

const verdictMarks = { passed: "✓", open: "…", failed: "✕" }
const widths = [230, 260, 250, 230]
const gap = 40

const chip = (verdict) =>
  verdict ? `<span class="verdict ${verdict}">${verdictMarks[verdict]} ${verdictWords[verdict]}</span>` : ""

function evidenceHtml(evidence) {
  if (!evidence) return ""
  const pieces = evidence.map(
    (piece) =>
      `<span class="ref ${piece.verdict ?? ""}"><b>${piece.source}</b><span class="path">${escape(shortRef(piece.ref))}</span></span>`,
  )
  return `<div class="refs">${pieces.join("")}</div>`
}

function nodeHtml(node, depth) {
  const badge = depth === 0 ? "" : `<span class="badge">${node.label}</span>`
  const box = `<div class="box d${String(depth)}">${badge}<p class="claim">${escape(node.claim)}</p>${chip(node.verdict)}${evidenceHtml(node.evidence)}</div>`
  const children = node.children
    ? `<div class="kids">${node.children.map((child) => nodeHtml(child, depth + 1)).join("")}</div>`
    : ""
  return `<div class="node">${box}${children}</div>`
}

function levels(tree) {
  const found = []
  const walk = (node, depth) => {
    if (!node.children) return
    found[depth] ??= { axes: new Set(), covers: [], count: 0 }
    found[depth].axes.add(node.group.axis)
    found[depth].covers.push(node.group.covers)
    found[depth].count += node.children.length
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(tree, 0)
  return found
}

const capital = (word) => word[0].toUpperCase() + word.slice(1)

function columnsHtml(tree) {
  const found = levels(tree)
  const head = [`<div class="column" style="width:${String(widths[0])}px">${kindWords[tree.kind]}</div>`]
  const foot = [`<div class="column" style="width:${String(widths[0])}px">The answer</div>`]
  for (const [depth, level] of found.entries()) {
    const axis = level.axes.size === 1 ? capital([...level.axes][0]) : "Detail"
    const style = `width:${String(widths[depth + 1] + gap)}px;padding-left:${String(gap)}px`
    head.push(`<div class="column" style="${style}">${axis} (${String(level.count)})</div>`)
    foot.push(
      `<div class="column" style="${style}">${escape(level.covers.length === 1 ? capital(level.covers[0]) : `Covers ${level.covers.join("; ")}`)}</div>`,
    )
  }
  return {
    head: `<div class="columns">${head.join("")}</div>`,
    foot: `<div class="columns foot">${foot.join("")}</div>`,
  }
}

const ink = "#1d1d1d"

const style = `*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{width:${String(pageWidth)}px;font-family:"Inter Variable",system-ui,sans-serif;color:${ink};-webkit-font-smoothing:antialiased}
main{width:max-content;min-width:640px;padding:28px 36px 24px}
.kind{text-align:center;font-size:12px;font-weight:600;letter-spacing:.14em;color:#6b6b6b}
h1{margin:6px 0 0;text-align:center;font-size:28px;line-height:34px;font-weight:650;letter-spacing:-.01em;color:${ink}}
.columns{display:flex;margin-top:28px;font-size:15px;font-weight:600;color:#444}
.columns .column{flex:none;text-align:center}
.columns.foot{margin-top:18px;font-size:13px;font-weight:400;line-height:18px;color:#666}
.columns.foot .column{padding-right:10px}
.tree{display:flex;margin-top:12px}
.node{display:flex;align-items:center}
.box{position:relative;flex:none;width:var(--width);padding:14px 16px 13px}
.box::before{content:"";position:absolute;inset:0;border:2.6px solid ${ink};border-radius:5px;filter:url(#rough);pointer-events:none}
.d0{--width:${String(widths[0])}px}.d0::before{border-width:3.6px}
.d1{--width:${String(widths[1])}px}.d2{--width:${String(widths[2])}px}.d3{--width:${String(widths[3])}px}
.badge{position:absolute;top:-13px;right:-11px;width:28px;height:28px;border-radius:50%;background:${ink};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;box-shadow:0 0 0 3px #fff}
.claim{margin:0;font-size:14.5px;line-height:20px;font-weight:550;color:${ink}}
.d0 .claim{font-size:18px;line-height:24px;font-weight:700}
.verdict{display:inline-block;margin-top:9px;font-size:11.5px;font-weight:650;line-height:16px;padding:2px 9px;border-radius:999px}
.verdict.passed{background:${ink};color:#fff}
.verdict.open{border:1.6px dashed #777;color:#555}
.verdict.failed{background:#a32020;color:#fff}
.refs{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.ref{display:inline-flex;gap:6px;align-items:baseline;max-width:100%;min-width:0;font-size:11.5px;line-height:16px;color:#555;border:1.4px solid #9a9a9a;border-radius:4px;padding:1px 6px}
.ref b{font-weight:700;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#222}
.ref.open{border-style:dashed}.ref.failed{border-color:#a32020}
.path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kids{display:flex;flex-direction:column;position:relative;padding-left:${String(gap)}px}
.kids::before{content:"";position:absolute;left:0;top:50%;width:${String(gap / 2)}px;border-top:2.2px solid ${ink};filter:url(#rough)}
.kids>.node{position:relative;padding:9px 0}
.kids>.node::before{content:"";position:absolute;left:-${String(gap / 2)}px;top:50%;width:${String(gap / 2)}px;border-top:2.2px solid ${ink};filter:url(#rough)}
.kids>.node::after{content:"";position:absolute;left:-${String(gap / 2)}px;top:0;bottom:0;border-left:2.2px solid ${ink};filter:url(#rough)}
.kids>.node:first-child::after{top:50%}
.kids>.node:last-child::after{bottom:50%}
footer{margin-top:22px;display:flex;justify-content:space-between;gap:24px;font-size:12px;color:#777}`

const rough = `<svg width="0" height="0" style="position:absolute"><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></svg>`

export function toHtml(tree, css = "") {
  const evidence = evidenceOf(tree)
  const counts = ["Observed", "Prototype", "Proposal"]
    .map((source) => [source, evidence.filter((piece) => piece.source === source).length])
    .filter(([, count]) => count > 0)
    .map(([source, count]) => `${source} ${String(count)}`)
    .join(" · ")
  const columns = columnsHtml(tree)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}${style}</style></head><body>${rough}<main>
<div class="kind">${kindWords[tree.kind].toUpperCase()}</div>
<h1>${escape(tree.question)}</h1>
${columns.head}
<section class="tree">${nodeHtml(tree, 0)}</section>
${columns.foot}
<footer><span>Evidence: ${counts}</span><span>Each verdict is the weakest one beneath it</span></footer>
</main></body></html>`
}

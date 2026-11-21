export const pageWidth = 1080

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

const chip = (verdict) => (verdict ? `<span class="verdict ${verdict}">${verdictWords[verdict]}</span>` : "")

function evidenceHtml(evidence) {
  if (!evidence) return ""
  const pieces = evidence.map(
    (piece) =>
      `<span class="ref"><b class="source ${piece.source.toLowerCase()}">${piece.source}</b>${piece.verdict ? `<i class="dot ${piece.verdict}"></i>` : ""}<span class="path">${escape(shortRef(piece.ref))}</span></span>`,
  )
  return `<div class="refs">${pieces.join("")}</div>`
}

function nodeHtml(node, depth) {
  const label = depth === 0 ? "" : `<span class="label">${node.label}</span>`
  const split = node.group ? `<p class="split">${escape(splitLine(node.group))}</p>` : ""
  const box = `<div class="box d${String(depth)}"><div class="head">${label}${chip(node.verdict)}</div><p class="claim">${escape(node.claim)}</p>${split}${evidenceHtml(node.evidence)}</div>`
  const children = node.children
    ? `<div class="kids">${node.children.map((child) => nodeHtml(child, depth + 1)).join("")}</div>`
    : ""
  return `<div class="node">${box}${children}</div>`
}

const style = `*{box-sizing:border-box}html,body{margin:0;background:var(--canvas)}
body{width:${String(pageWidth)}px;font-family:"Geist Variable",system-ui,sans-serif;color:var(--foreground);-webkit-font-smoothing:antialiased}
main{width:max-content;min-width:640px;margin:16px;background:var(--background);border:1px solid var(--line);border-radius:10px;padding:24px 26px 18px}
.kind{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-foreground)}
.question{margin:4px 0 0;font-size:13px;line-height:18px;color:var(--muted-foreground)}
.tree{display:flex;margin-top:16px}
.node{display:flex;align-items:center}
.box{flex:none;width:var(--width);min-width:0;border:1px solid var(--line);border-radius:8px;padding:9px 10px 10px;background:var(--background)}
.d0{--width:200px;background:var(--navy);border-color:var(--navy);color:var(--background)}
.d1{--width:240px}.d2{--width:230px}.d3{--width:210px}
.head{display:flex;justify-content:space-between;align-items:center;gap:6px}
.head:empty{display:none}
.d0 .head{justify-content:flex-start}
.label{flex:none;width:24px;height:20px;border-radius:5px;background:var(--navy);color:var(--background);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.claim{margin:6px 0 0;font-size:12.5px;line-height:17px;font-weight:560}
.d0 .claim{font-size:15px;line-height:20px;font-weight:650}
.d1 .claim{font-size:13.5px;line-height:18px;font-weight:620}
.split{margin:6px 0 0;font-size:10.5px;line-height:14px;color:var(--muted-foreground)}
.d0 .split{color:color-mix(in srgb,var(--background) 72%,transparent)}
.d0 .verdict{background:var(--background)}
.kids{display:flex;flex-direction:column;position:relative;padding-left:30px}
.kids::before{content:"";position:absolute;left:0;top:50%;width:15px;border-top:1.5px solid var(--navy)}
.kids>.node{position:relative;padding:5px 0}
.kids>.node::before{content:"";position:absolute;left:-15px;top:50%;width:15px;border-top:1.5px solid var(--navy)}
.kids>.node::after{content:"";position:absolute;left:-15px;top:0;bottom:0;border-left:1.5px solid var(--navy)}
.kids>.node:first-child::after{top:50%}
.kids>.node:last-child::after{bottom:50%}
.refs{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.ref{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;line-height:14px;font-family:ui-monospace,monospace;color:var(--muted-foreground);border:1px solid var(--line);border-radius:4px;padding:1px 5px;max-width:100%;min-width:0}
.path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.source{font-family:"Geist Variable",system-ui,sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--navy)}
.source.proposal{color:var(--muted-foreground)}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.verdict{font-size:10.5px;font-weight:650;border-radius:999px;padding:1px 8px;white-space:nowrap}
.passed{color:var(--positive-text)}.verdict.passed{background:color-mix(in srgb,var(--positive) 14%,transparent)}.dot.passed{background:var(--positive)}
.failed{color:var(--danger-text)}.verdict.failed{background:color-mix(in srgb,var(--negative) 14%,transparent)}.dot.failed{background:var(--negative)}
.open{color:var(--muted-foreground)}.verdict.open{border:1px dashed var(--muted-foreground)}.dot.open{border:1px dashed var(--muted-foreground)}
footer{margin-top:14px;padding-top:8px;border-top:1px solid var(--line);font-size:11px;color:var(--muted-foreground);display:flex;justify-content:space-between}`

export function toHtml(tree, css = "") {
  const evidence = evidenceOf(tree)
  const counts = ["Observed", "Prototype", "Proposal"]
    .map((source) => [source, evidence.filter((piece) => piece.source === source).length])
    .filter(([, count]) => count > 0)
    .map(([source, count]) => `${source} ${String(count)}`)
    .join(" · ")
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}${style}</style></head><body><main>
<div class="kind">${kindWords[tree.kind]}</div>
<p class="question">${escape(tree.question)}</p>
<section class="tree">${nodeHtml(tree, 0)}</section>
<footer><span>Evidence: ${counts}</span><span>Each verdict is the weakest one beneath it</span></footer>
</main></body></html>`
}

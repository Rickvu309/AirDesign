export const pageWidth = 900

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

function itemHtml(node) {
  const split = node.group ? `<p class="split">${escape(splitLine(node.group))}</p>` : ""
  const children = node.children ? `<ul>${node.children.map(itemHtml).join("")}</ul>` : ""
  return `<li><span class="label">${node.label}</span><div><p class="claim">${escape(node.claim)} ${chip(node.verdict)}</p>${split}${evidenceHtml(node.evidence)}${children}</div></li>`
}

function branchHtml(node) {
  const split = node.group ? `<p class="split">${escape(splitLine(node.group))}</p>` : ""
  const children = node.children ? `<ul>${node.children.map(itemHtml).join("")}</ul>` : ""
  return `<article><header><span class="label big">${node.label}</span>${chip(node.verdict)}</header><h2>${escape(node.claim)}</h2>${split}${evidenceHtml(node.evidence)}${children}</article>`
}

const style = `*{box-sizing:border-box}html,body{margin:0;background:var(--canvas)}
body{width:${String(pageWidth)}px;font-family:"Geist Variable",system-ui,sans-serif;color:var(--foreground);-webkit-font-smoothing:antialiased}
main{margin:16px;background:var(--background);border:1px solid var(--line);border-radius:10px;padding:24px 26px 18px}
.kind{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-foreground)}
.question{margin:4px 0 0;font-size:13px;line-height:18px;color:var(--muted-foreground)}
h1{margin:6px 0 0;font-size:22px;line-height:28px;font-weight:650;color:var(--navy);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.rule{height:2px;background:var(--navy);margin:14px 0 10px}
main>.split{margin:0;text-align:center;font-size:12px;color:var(--muted-foreground)}
.stem{width:0;height:12px;margin:6px auto 0;border-left:1.5px solid var(--navy)}
.branches{display:grid;grid-template-columns:repeat(var(--count),minmax(0,1fr));gap:14px;position:relative;padding-top:14px}
.branches::before{content:"";position:absolute;top:0;left:calc(50% / var(--count));right:calc(50% / var(--count));border-top:1.5px solid var(--navy)}
article{position:relative;min-width:0;border:1px solid var(--line);border-radius:8px;padding:12px 12px 10px;background:var(--background)}
article::before{content:"";position:absolute;top:-15px;left:50%;height:14px;border-left:1.5px solid var(--navy)}
article header{display:flex;justify-content:space-between;align-items:center}
h2{margin:8px 0 0;font-size:14px;line-height:19px;font-weight:620}
.label{flex:none;font-size:11px;font-weight:700;color:var(--navy);min-width:22px}
.label.big{width:24px;height:24px;border-radius:50%;background:var(--navy);color:var(--background);display:flex;align-items:center;justify-content:center;font-size:12px}
.split{margin:6px 0 0;font-size:11px;line-height:15px;color:var(--muted-foreground)}
ul{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
ul ul{margin-top:7px;padding-left:4px;border-left:1px solid var(--line)}
li{display:flex;gap:6px;align-items:flex-start}
li>div{min-width:0;flex:1}
.claim{margin:0;font-size:12.5px;line-height:17px}
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
<h1>${escape(tree.claim)} ${chip(tree.verdict)}</h1>
<div class="rule"></div>
<p class="split">${escape(splitLine(tree.group))}</p>
<div class="stem"></div>
<section class="branches" style="--count:${String(tree.children.length)}">${tree.children.map(branchHtml).join("")}</section>
<footer><span>Evidence: ${counts}</span><span>Each verdict is the weakest one beneath it</span></footer>
</main></body></html>`
}

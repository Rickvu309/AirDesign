import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const escape = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

const style = `body{margin:0;background:#eceef1;color:#1d1d1f;font:15px/1.4 system-ui,sans-serif}
article{box-sizing:border-box;width:1500px;padding:20px 24px;margin:0 auto 24px;background:#fff}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:0 0 6px}.meta{color:#555;margin-bottom:12px}
.pair{display:flex;gap:16px}.pair figure{margin:0;width:718px}.pair img{width:718px;display:block;border:1px solid #ccc}
figcaption{font-weight:600;margin-bottom:6px}.none{width:718px;height:451px;display:flex;align-items:center;justify-content:center;border:1px dashed #bbb;color:#555}
.rows{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}.finding{font-size:13px;overflow-wrap:anywhere}
.finding img{max-width:100%;max-height:150px;display:block;margin-top:4px;border:1px solid #ddd}.r1{color:#c1121f}.r2{color:#b45f00}.r3{color:#2d6fcd}
ul{margin:8px 0 0;padding-left:18px;font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border-bottom:1px solid #e3e3e3;padding:6px 8px;text-align:left;vertical-align:top}
.error{color:#c1121f;font-weight:600}`

const link = (out, file) => escape(path.relative(out, file))

function differenceLine(row) {
  if (row.status !== "changed") return `${row.number}. ${row.name}: ${row.status}`
  const moved = Object.entries(row.delta)
    .filter(([, value]) => Math.abs(value) > 1)
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`)
  const styled = Object.entries(row.styles).map(([key, value]) => `${key} ${value.design} → ${value.real}`)
  return `${row.number}. ${row.name}: ${[...moved, ...styled].join("; ")}`
}

function stateArticle(out, row) {
  if (row.error) {
    return `<article id="${escape(row.name)}"><h1>${escape(row.name)}</h1><p class="error">Not reached: ${escape(row.error)}</p></article>`
  }
  const findings = row.look.report.findings
  const differences = row.comparison?.report.differences ?? []
  const design = row.comparison
    ? `<figure><figcaption>Design ${escape(row.design)}</figcaption><img src="${link(out, row.comparison.designImage)}"></figure>`
    : `<figure><figcaption>Design</figcaption><div class="none">No design screen for this state.</div></figure>`
  const top = findings
    .slice(0, 3)
    .map(
      (finding) =>
        `<div class="finding"><b class="r${finding.rank}">${finding.number}. rank ${finding.rank} ${escape(finding.detector)}${finding.more ? ` (+${finding.more} alike)` : ""}</b><br>${escape(finding.message)}<br><code>${escape(finding.selector)}</code><img src="${link(out, finding.crop)}"></div>`,
    )
    .join("")
  const lines = differences.map((difference) => `<li>${escape(differenceLine(difference))}</li>`).join("")
  return `<article id="${escape(row.name)}"><h1>${escape(row.name)}</h1>
<div class="meta">${findings.length} findings · ${row.comparison ? `${differences.length} chrome differences from the design` : "no design to compare"} · <a href="${link(out, row.look.findings)}">findings.json</a>${row.comparison ? ` · <a href="${link(out, row.comparison.compare)}">compare.json</a> · <a href="${link(out, row.comparison.image)}">side by side</a>` : ""}</div>
<div class="pair">${design}<figure><figcaption>Real, findings boxed</figcaption><img src="${link(out, row.look.annotated)}"></figure></div>
${lines ? `<ul>${lines}</ul>` : ""}<div class="rows">${top || "<p>No mechanical findings. That is not a design sign-off.</p>"}</div></article>`
}

function summaryArticle(rows, stale) {
  const body = rows
    .map((row) => {
      if (row.error)
        return `<tr><td>${escape(row.name)}</td><td colspan="3" class="error">${escape(row.error)}</td></tr>`
      const findings = row.look.report.findings
      const first = findings[0]
      return `<tr><td><a href="#${escape(row.name)}">${escape(row.name)}</a></td><td>${findings.length}</td><td>${row.comparison ? row.comparison.count : "no design"}</td><td>${first ? `<span class="r${first.rank}">${escape(first.detector)}</span>: ${escape(first.message)}` : ""}</td></tr>`
    })
    .join("")
  const staleLines = stale.map((line) => `<li class="error">${escape(line)}</li>`).join("")
  return `<article id="summary"><h1>Design sheet</h1><div class="meta">Each state of the real app, its design screen, and what the scanner found. Ranked: 1 content or a control is lost, 2 readability or layout, 3 hint. Zero findings is not a design sign-off.</div>
<table><tr><th>State</th><th>Findings</th><th>Chrome differences</th><th>First finding</th></tr>${body}</table>${staleLines ? `<ul>${staleLines}</ul>` : ""}</article>`
}

export function rankAll(rows) {
  return rows
    .filter((row) => !row.error)
    .flatMap((row) =>
      row.look.report.findings.map(({ number, detector, rank, selector, box, message, more, crop }) => ({
        state: row.name,
        number,
        rank,
        detector,
        selector,
        box,
        message,
        more,
        crop,
      })),
    )
    .sort((a, b) => a.rank - b.rank || a.state.localeCompare(b.state) || a.number - b.number)
}

export async function writeSheet(browser, out, rows, stale = []) {
  const articles = [summaryArticle(rows, stale), ...rows.map((row) => stateArticle(out, row))]
  const html = path.join(out, "sheet.html")
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><title>AirDesign design sheet</title><style>${style}</style>\n${articles.join("\n")}\n`,
  )
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: "reduce" })
  const images = []
  try {
    const page = await context.newPage()
    for (const [index, article] of articles.entries()) {
      const image = path.join(out, `sheet-${String(index).padStart(2, "0")}.png`)
      const inline = article.replace(/src="([^"]+)"/g, (_, file) => {
        const bytes = readFileSync(path.join(out, file.replaceAll("&amp;", "&")))
        return `src="data:image/png;base64,${bytes.toString("base64")}"`
      })
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${style}</style>${inline}`)
      await page.locator("img").evaluateAll((all) => Promise.all(all.map((each) => each.decode())))
      await page.locator("article").screenshot({ path: image })
      images.push(image)
    }
  } finally {
    await context.close()
  }
  const findings = rankAll(rows)
  const report = {
    count: findings.length,
    stale,
    states: rows.map((row, index) => ({
      name: row.name,
      design: row.design ?? null,
      error: row.error ?? null,
      findings: row.look?.count ?? null,
      differences: row.comparison?.count ?? null,
      page: images[index + 1],
    })),
    findings,
  }
  const json = path.join(out, "sheet.json")
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`)
  return {
    count: findings.length,
    states: rows.length,
    failed: rows.filter((row) => row.error).length,
    html,
    summary: images[0],
    pages: `${images.length} pages: sheet-00.png is the summary, then one page per state`,
    sheet: json,
    stale,
  }
}

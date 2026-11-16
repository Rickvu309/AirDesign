import { createHash } from "node:crypto"

const scripts = {
  "Latin-vi": /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu,
  Cyrillic: /\p{Script=Cyrillic}/u,
  Japanese: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
}
const scriptShare = 0.3
const deckParts = new Set([
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "[Content_Types].xml",
  "docProps/app.xml",
])

export function tasksHash(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}

function relsOf(part) {
  const at = part.lastIndexOf("/")
  return `${part.slice(0, at)}/_rels/${part.slice(at + 1)}.rels`
}

export function mayParts(may, slideParts) {
  if (may.slides === "any") return () => true
  if (may.slides === "new") return (part, how) => how === "added" || deckParts.has(part)
  const allowed = new Set(
    may.slides.flatMap((number) => [slideParts[number - 1], relsOf(slideParts[number - 1] ?? "")]),
  )
  return (part) => allowed.has(part)
}

export function untouched(found, may, slideParts) {
  const allowed = mayParts(may, slideParts)
  const outside = [
    ...found.changed.filter((part) => !allowed(part, "changed")),
    ...found.added.filter((part) => !allowed(part, "added")),
    ...found.removed.filter((part) => !allowed(part, "removed")),
    ...(found.orderMoved && may.slides !== "any" ? ["part order"] : []),
  ]
  return { ok: outside.length === 0, changed: [...found.changed, ...found.added, ...found.removed], outside }
}

export function faultsOf(slides, judge) {
  return slides.flatMap((slide, index) =>
    judge(slide)
      .findings.filter((finding) => finding.level === "fault")
      .map((finding) => ({ slide: index + 1, node: finding.node, code: finding.code })),
  )
}

const keyOf = (finding) => `${String(finding.slide)} ${finding.node} ${finding.code}`

export function newFaults(before, after) {
  const had = new Set(before.map(keyOf))
  return after.filter((finding) => !had.has(keyOf(finding)))
}

function paragraphs(slide) {
  return (slide?.elements ?? [])
    .filter((element) => element.from === "slide")
    .flatMap((element) => [
      ...(element.text?.paragraphs ?? []).map((paragraph) => paragraph.runs.map((run) => run.text).join("")),
      ...(element.cells ?? []).flat(),
    ])
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text !== "")
}

const textOf = (slide) => paragraphs(slide).join(" ")

function titled(slide) {
  return (slide?.elements ?? []).some(
    (element) =>
      element.from === "slide" &&
      (element.placeholder === "title" || element.placeholder === "ctrTitle") &&
      paragraphs({ elements: [element] }).length > 0,
  )
}

function boundShapes(xml) {
  const ids = new Set()
  for (const [connector] of xml.matchAll(/<p:cxnSp\b[\s\S]*?<\/p:cxnSp>/g))
    for (const [, id] of connector.matchAll(/<a:(?:stCxn|endCxn)\b[^>]*\bid="(\d+)"/g)) ids.add(id)
  return ids.size
}

const wantChecks = {
  "slides-added": (want, deck) => {
    const added = deck.after.slides.length - deck.before.slides.length
    const untitled = deck.after.slides
      .slice(deck.before.slides.length)
      .flatMap((slide, index) => (titled(slide) ? [] : [deck.before.slides.length + index + 1]))
    return { ok: added === want.count && untitled.length === 0, added, untitled }
  },
  "finding-gone": (want, deck) => {
    const left = deck.after.faults.filter((finding) => finding.slide === want.slide && finding.code === want.code)
    const had = deck.before.faults.some((finding) => finding.slide === want.slide && finding.code === want.code)
    const appeared = newFaults(deck.before.faults, deck.after.faults).filter((finding) => finding.slide === want.slide)
    return { ok: had && left.length === 0 && appeared.length === 0, had, left: left.length, appeared }
  },
  "no-new-findings": (_, deck) => {
    const appeared = newFaults(deck.before.faults, deck.after.faults)
    return { ok: appeared.length === 0, appeared }
  },
  "text-kept": (want, deck) => {
    const missing = want.slides.flatMap((number) => {
      const after = textOf(deck.after.slides[number - 1])
      return paragraphs(deck.before.slides[number - 1]).filter((text) => !after.includes(text))
    })
    return { ok: missing.length === 0, missing }
  },
  "text-has": (want, deck) => ({ ok: textOf(deck.after.slides[want.slide - 1]).includes(want.text) }),
  "text-changed": (want, deck) => {
    const off = want.slides.flatMap((number) => {
      const before = textOf(deck.before.slides[number - 1])
      const after = textOf(deck.after.slides[number - 1])
      const ratio = before.length === 0 ? 0 : after.length / before.length
      const [low, high] = want.lengthRatio
      return after !== before && ratio >= low && ratio <= high
        ? []
        : [{ slide: number, ratio: Math.round(ratio * 100) / 100 }]
    })
    return { ok: off.length === 0, off }
  },
  script: (want, deck) => {
    const words = want.slides.flatMap((number) =>
      textOf(deck.after.slides[number - 1])
        .split(" ")
        .filter((word) => /\p{L}/u.test(word)),
    )
    const share = words.length === 0 ? 0 : words.filter((word) => scripts[want.script].test(word)).length / words.length
    return { ok: share >= scriptShare, share: Math.round(share * 100) / 100 }
  },
  joined: (want, deck) => {
    const bound = boundShapes(deck.after.xml[want.slide - 1] ?? "")
    return { ok: bound >= want.shapes, bound }
  },
  "theme-colors": (want, deck) => {
    const fixed = want.slides.filter((number) => /<a:srgbClr\b/.test(deck.after.xml[number - 1] ?? ""))
    return { ok: fixed.length === 0, fixed }
  },
}

export const wantKinds = Object.keys(wantChecks)
export const families = [
  "restyle to theme",
  "list to diagram",
  "fix overflow",
  "slides from notes",
  "translate",
  "targeted edit",
]

export function wantsOf(task, deck) {
  return task.want.map((want) => {
    const check = wantChecks[want.kind]
    if (check === undefined) throw new Error(`task ${task.id}: no want kind ${want.kind}`)
    return { kind: want.kind, ...check(want, deck) }
  })
}

export function passed(trial, task) {
  return (
    trial.wants.every((want) => want.ok) &&
    trial.untouched.ok &&
    trial.validator.ok !== false &&
    trial.calls <= task.limit.calls &&
    trial.seconds <= task.limit.seconds &&
    !trial.stopped
  )
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const tokensOf = (trial) => trial.tokens.input + trial.tokens.read + trial.tokens.write + trial.tokens.output

export function summarize({ results, tasks, run }) {
  const perTask = Object.fromEntries(
    tasks.map((task) => {
      const trials = results.filter((trial) => trial.task === task.id)
      return [
        task.id,
        {
          family: task.family,
          hash: tasksHash(JSON.stringify(task)),
          trials: trials.length,
          pass: trials.length === 0 ? 0 : trials.filter((trial) => trial.passed).length / trials.length,
          calls: median(trials.map((trial) => trial.calls)),
          tokens: median(trials.map(tokensOf)),
          seconds: median(trials.map((trial) => trial.seconds)),
        },
      ]
    }),
  )
  return { ...run, perTask }
}

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function interval(values, { resamples = 10_000, seed = 1 } = {}) {
  const next = random(seed)
  const means = []
  for (let round = 0; round < resamples; round += 1) {
    let sum = 0
    for (let pick = 0; pick < values.length; pick += 1) sum += values[Math.floor(next() * values.length)]
    means.push(sum / values.length)
  }
  means.sort((left, right) => left - right)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return { mean, low: means[Math.floor(resamples * 0.025)], high: means[Math.ceil(resamples * 0.975) - 1] }
}

export function shown(found, more, less) {
  if (found.low > 0) return more
  if (found.high < 0) return less
  return "not shown"
}

const label = (summary) => `${summary.model.replace(/^claude-/, "")}/${summary.effort} (${summary.commit.slice(0, 8)})`
const points = (value) => `${value >= 0 ? "+" : ""}${String(Math.round(value * 100))}`
const percent = (value) => `${String(Math.round(value * 100))} %`
const times = (value) => Math.exp(value).toFixed(2)
const amount = (value) => (value >= 1000 ? `${String(Math.round(value / 1000))} k` : String(Math.round(value)))

export function compareRuns(first, second, options = {}) {
  const ids = [...new Set([...Object.keys(first.perTask), ...Object.keys(second.perTask)])]
  const changed = ids.filter((id) => first.perTask[id]?.hash !== second.perTask[id]?.hash)
  if (first.tasks !== second.tasks || changed.length > 0)
    return {
      ok: false,
      refusal: "tasks",
      changed,
      lines: [`agent-bench compare: different tasks; changed: ${changed.join(", ") || "the task file"}`],
    }
  const name = second.effort === first.effort ? second.model.replace(/^claude-/, "") : second.effort
  const pairs = ids.map((id) => [first.perTask[id], second.perTask[id]])
  const mean = (pick) => pairs.reduce((sum, pair) => sum + pick(pair), 0) / pairs.length
  const pass = interval(
    pairs.map(([a, b]) => b.pass - a.pass),
    options,
  )
  const ratio = (field) =>
    interval(
      pairs.map(([a, b]) => Math.log(Math.max(b[field], 1) / Math.max(a[field], 1))),
      options,
    )
  const tokens = ratio("tokens")
  const calls = ratio("calls")
  const seconds = ratio("seconds")
  const verdicts = {
    pass: shown(pass, `${name} passes more`, `${name} passes less`),
    tokens: shown(tokens, `${name} reads more`, `${name} reads less`),
    calls: shown(calls, `${name} calls more`, `${name} calls less`),
    seconds: shown(seconds, `${name} is slower`, `${name} is faster`),
  }
  const families = [...new Set(pairs.map(([a]) => a.family))].map((family) => {
    const inside = pairs.filter(([a]) => a.family === family)
    const share = (side) => inside.reduce((sum, pair) => sum + pair[side].pass, 0) / inside.length
    return `${family} ${percent(share(0))} vs ${percent(share(1))} (${points(share(1) - share(0))})`
  })
  const trials = Math.max(...pairs.map(([a]) => a.trials))
  const lines = [
    `agent-bench compare: ${label(first)} vs ${label(second)}, ${String(ids.length)} tasks x ${String(trials)} trials, same tasks`,
    `pass         ${percent(mean(([a]) => a.pass))}  vs  ${percent(mean(([, b]) => b.pass))}   difference ${points(pass.mean)} points, 95 % interval ${points(pass.low)} to ${points(pass.high)}: ${verdicts.pass}`,
    `tokens/task  ${amount(mean(([a]) => a.tokens))}  vs  ${amount(mean(([, b]) => b.tokens))}   x${times(tokens.mean)}, interval ${times(tokens.low)} to ${times(tokens.high)}: ${verdicts.tokens}`,
    `calls/task   ${amount(mean(([a]) => a.calls))}  vs  ${amount(mean(([, b]) => b.calls))}   x${times(calls.mean)}, interval ${times(calls.low)} to ${times(calls.high)}: ${verdicts.calls}`,
    `seconds      ${amount(mean(([a]) => a.seconds))}  vs  ${amount(mean(([, b]) => b.seconds))}   x${times(seconds.mean)}, interval ${times(seconds.low)} to ${times(seconds.high)}: ${verdicts.seconds}`,
    `by family: ${families.join(", ")}`,
  ]
  return { ok: true, verdicts, intervals: { pass, tokens, calls, seconds }, lines }
}

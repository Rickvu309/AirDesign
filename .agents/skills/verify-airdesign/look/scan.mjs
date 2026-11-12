import { readAllow, pageMatches } from "./allow.mjs"
import { detectors } from "./detectors.mjs"
import { pageKit } from "./page-kit.mjs"

function inPage(options) {
  const page = kit(options)
  const raw = []
  for (const element of page.elements) {
    for (const detector of chosen) {
      const message = detector.inspect(element, page)
      if (message) raw.push({ element, detector, message })
    }
  }
  const used = new Set()
  const groups = new Map()
  for (const { element, detector, message } of raw) {
    const entry = options.allow.find((each) => {
      if (each.detector !== detector.name) return false
      try {
        return element.closest(each.selector) !== null
      } catch {
        throw new Error(`look/allow.json entry ${each.index + 1} has a selector that is not CSS: ${each.selector}`)
      }
    })
    if (entry) {
      used.add(entry.index)
      continue
    }
    const selector = page.selector(element)
    const shape = `${detector.name} ${message.replace(/"[^"]*"/g, '""')}`
    const box = page.box(element)
    const finding = {
      detector: detector.name,
      rank: detector.rank,
      selector,
      box: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
      message,
    }
    const group = groups.get(shape)
    if (group === undefined) groups.set(shape, { ...finding, more: 0 })
    else {
      group.more += 1
      group.also = [...(group.also ?? []), selector].slice(0, 8)
    }
  }
  return { findings: [...groups.values()], used: [...used] }
}

export async function scan(page, options = {}) {
  const scope = options.scope ?? new URL(page.url()).pathname
  const allow = (options.allow ?? readAllow()).filter((entry) => pageMatches(entry.page, scope))
  const chosen = detectors.filter((detector) => !detector.optIn || options.offToken)
  const source = `(options) => {
    const kit = ${pageKit.toString()}
    const chosen = [${chosen.map((detector) => `{ name: ${JSON.stringify(detector.name)}, rank: ${detector.rank}, inspect: ${detector.inspect.toString()} }`).join(",\n")}]
    return (${inPage.toString()})(options)
  }`
  const payload = { allow, identifiers: options.identifiers ?? [], tokens: options.tokens }
  const result = await page.evaluate(`(${source})(${JSON.stringify(payload)})`)
  const findings = result.findings
    .sort((a, b) => a.rank - b.rank || a.box.y - b.box.y || a.box.x - b.box.x || a.detector.localeCompare(b.detector))
    .map((finding, index) => ({ number: index + 1, ...finding }))
  return { scope, findings, used: result.used }
}

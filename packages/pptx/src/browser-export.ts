import type { TextValue } from "@airdesign/document"
import { sameBytes } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { applyRoute, type SlideRoute } from "./slide-route.js"

function packageFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  slide: string,
): string[] {
  const failures: string[] = []
  for (const name of original.keys()) {
    if (!exported.has(name)) failures.push(`missing part ${name}`)
  }
  for (const name of exported.keys()) {
    if (!original.has(name)) failures.push(`extra part ${name}`)
  }
  if (failures.length === 0 && [...original.keys()].join("\n") !== [...exported.keys()].join("\n")) {
    failures.push("part order")
  }
  for (const [name, before] of original) {
    if (name === slide) continue
    const after = exported.get(name)
    if (after === undefined) continue
    if (!sameBytes(before, after)) failures.push(`part ${name}`)
  }
  return failures
}

export type ParagraphExpectation = {
  readonly part: string
  readonly shape: string
  readonly value: TextValue
}

export function paragraphExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  expected: ParagraphExpectation,
): readonly string[] {
  const { part, shape, value } = expected
  const failures = packageFailures(original, exported, part)
  const afterSlide = exported.get(part)
  if (original.get(part) === undefined || afterSlide === undefined) return failures
  const found = readShapes(exported).filter((row) => row.part === part && row.shape === shape)
  const row = found.length === 1 ? found[0] : undefined
  if (row === undefined) failures.push(`shape ${shape}`)
  else {
    const shown = JSON.stringify(row.text.map((paragraph) => paragraph.runs.map((run) => run.text)))
    const wanted = JSON.stringify(value.map((paragraph) => paragraph.runs.map((run) => run.text)))
    if (shown !== wanted) failures.push(`shape ${shape} paragraphs ${shown}`)
  }
  const routed = applyRoute(original, { name: "text", part, shape, value }).get(part)
  if (routed === undefined || !sameBytes(routed, afterSlide)) failures.push(`${part} bytes`)
  return failures
}

export function routeExportFailures(
  original: ReadonlyMap<string, Uint8Array>,
  exported: ReadonlyMap<string, Uint8Array>,
  routes: readonly Exclude<SlideRoute, { readonly name: "add" }>[],
): readonly string[] {
  const part = routes[0]?.part
  if (part === undefined || routes.some((route) => route.part !== part)) throw new Error("route part")
  const failures = packageFailures(original, exported, part)
  const afterSlide = exported.get(part)
  if (original.get(part) === undefined || afterSlide === undefined) return failures
  const routed = routes.reduce<ReadonlyMap<string, Uint8Array>>((parts, route) => applyRoute(parts, route), original)
  const written = routed.get(part)
  if (written === undefined || !sameBytes(written, afterSlide)) failures.push(`${part} bytes`)
  return failures
}

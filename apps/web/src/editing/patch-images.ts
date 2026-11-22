import { currentValue, readTextValue, type ElementPatch, type Register } from "@airdesign/document"

export function textImages(value: string): readonly string[] {
  if (!value.includes('"image"')) return []
  const runs = (readTextValue(value) ?? []).flatMap((paragraph) => paragraph.runs)
  return runs.flatMap((run) => (run.fill !== undefined && "image" in run.fill ? [run.fill.image] : []))
}

export function patchImages(patch: ElementPatch | undefined): readonly string[] {
  const source = patch?.fills?.source
  const text = patch?.text?.value
  return [
    ...(typeof source === "object" ? [source.set] : []),
    ...(typeof text === "object" ? textImages(text.set) : []),
  ]
}

export function imageTexts(register: Register): readonly (readonly [string, string])[] {
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return textImages(value).length > 0 ? [[node, value] as const] : []
  })
}

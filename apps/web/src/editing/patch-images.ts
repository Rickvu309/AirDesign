import { currentValue, readTextValue, type Register } from "@airdesign/document"

export function textImages(value: string): readonly string[] {
  if (!value.includes('"image"')) return []
  const runs = (readTextValue(value) ?? []).flatMap((paragraph) => paragraph.runs)
  return runs.flatMap((run) => (run.fill !== undefined && "image" in run.fill ? [run.fill.image] : []))
}

export function imageTexts(register: Register): readonly (readonly [string, string])[] {
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return textImages(value).length > 0 ? [[node, value] as const] : []
  })
}

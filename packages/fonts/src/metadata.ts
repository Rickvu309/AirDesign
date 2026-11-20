import type { FontFamily } from "./catalog.js"

export type FontFile = {
  readonly file: string
  readonly style: "normal" | "italic"
  readonly weight: string
}

function field(text: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\n)[ \t]*${name}: "([^"\\n]+)"`).exec(text)?.[1]
}

function blocks(metadata: string, name: string): readonly string[] {
  const found: string[] = []
  let current: string[] | null = null
  for (const line of metadata.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === `${name} {`) {
      if (current !== null) throw new Error("font block")
      current = []
    } else if (current !== null && trimmed === "}") {
      found.push(current.join("\n"))
      current = null
    } else if (current !== null) {
      if (trimmed.endsWith("{")) throw new Error("font block")
      current.push(line)
    }
  }
  if (current !== null) throw new Error("font block")
  return found
}

export function fontFaces(family: FontFamily, metadata: string): readonly FontFile[] {
  if (field(metadata, "name") !== family.family || field(metadata, "license") !== family.license)
    throw new Error("font metadata")
  const weightAxis = blocks(metadata, "axes").find((block) => field(block, "tag") === "wght")
  const minimum = weightAxis?.match(/min_value:\s*(\d+)/)?.[1]
  const maximum = weightAxis?.match(/max_value:\s*(\d+)/)?.[1]
  const faces: FontFile[] = []
  for (const text of blocks(metadata, "fonts")) {
    const file = field(text, "filename")
    const style = field(text, "style")
    const weight = text.match(/weight:\s*(\d+)/)?.[1]
    if (
      file === undefined ||
      !/^[\w[\],.-]+\.(ttf|otf)$/.test(file) ||
      (style !== "normal" && style !== "italic") ||
      weight === undefined
    )
      throw new Error("font face")
    faces.push({
      file,
      style,
      weight:
        file.includes("wght") && minimum !== undefined && maximum !== undefined ? `${minimum} ${maximum}` : weight,
    })
  }
  if (faces.length === 0) throw new Error("font faces")
  return faces
}

import type { FontFamily } from "./source.js"

export type FontFile = {
  readonly file: string
  readonly style: "normal" | "italic"
  readonly weight: string
}

function field(text: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\n)\\s*${name}: "([^"\\n]+)"`).exec(text)?.[1]
}

export function fontFaces(family: FontFamily, metadata: string): readonly FontFile[] {
  if (field(metadata, "name") !== family.family || field(metadata, "license") !== family.license)
    throw new Error("font metadata")
  const weightAxis = [...metadata.matchAll(/axes\s*\{([^}]+)\}/g)].find(
    (block) => field(block[1] ?? "", "tag") === "wght",
  )?.[1]
  const minimum = weightAxis?.match(/min_value:\s*(\d+)/)?.[1]
  const maximum = weightAxis?.match(/max_value:\s*(\d+)/)?.[1]
  const faces: FontFile[] = []
  for (const block of metadata.matchAll(/fonts\s*\{([^}]+)\}/g)) {
    const text = block[1] ?? ""
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

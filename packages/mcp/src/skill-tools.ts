import { listStyles, readSkill, readSkillIndex, readStyle } from "@airdesign/skills"

import { answered, refused, type ToolResult } from "./answer.js"

export type ReadOnlyTool = {
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly annotations: {
    readonly readOnlyHint: true
    readonly destructiveHint: false
    readonly idempotentHint: true
    readonly openWorldHint: false
  }
}

const readOnlyAnnotations = {
  readOnlyHint: true as const,
  destructiveHint: false as const,
  idempotentHint: true as const,
  openWorldHint: false as const,
}

export const skillTools: readonly ReadOnlyTool[] = [
  {
    name: "airdesign_get_style",
    description: "Read an AirDesign visual style and its parameters. Omit name to list available styles.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Style name from the list. Omit to list styles.",
        },
      },
    },
    annotations: readOnlyAnnotations,
  },
  {
    name: "airdesign_read_skill",
    description: "Read an AirDesign skill guide. Omit name to list available skills and when to read each.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Skill name from the index. Omit for the index.",
        },
      },
    },
    annotations: readOnlyAnnotations,
  },
]

function readOptionalName(
  raw: unknown,
  form: string,
): { readonly ok: true; readonly name: string | undefined } | { readonly ok: false; readonly result: ToolResult } {
  if (raw === undefined) return { ok: true, name: undefined }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, result: refused("field") }
  }
  const body = raw as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (key !== "name") {
      return { ok: false, result: refused("field", { field: key, fault: "unknown", form: "Optional name." }) }
    }
  }
  if (body.name === undefined) return { ok: true, name: undefined }
  if (typeof body.name !== "string") {
    return { ok: false, result: refused("field", { field: "name", fault: "form", form }) }
  }
  return { ok: true, name: body.name }
}

export function readSkillTool(raw: unknown, dir?: string): ToolResult {
  const parsed = readOptionalName(raw, "A skill name from the index.")
  if (!parsed.ok) return parsed.result
  if (parsed.name === undefined) {
    const index = readSkillIndex(dir)
    return answered("Call airdesign_read_skill with a skill name to read its guide.", {
      ok: true,
      skills: index.skills,
      text: index.markdown,
    })
  }
  const skill = readSkill(parsed.name, dir)
  if (skill === undefined) {
    const available = readSkillIndex(dir).skills.map((entry) => entry.name)
    const note =
      available.length === 0
        ? "No skills are available."
        : `No skill named "${parsed.name}". Available skills: ${available.join(", ")}.`
    return refused("field", { field: "name", available, note })
  }
  return answered(`Skill ${skill.name}.`, { ok: true, name: skill.name, text: skill.markdown })
}

export function getStyleTool(raw: unknown, dir?: string): ToolResult {
  const parsed = readOptionalName(raw, "A style name from the list.")
  if (!parsed.ok) return parsed.result
  if (parsed.name === undefined) {
    const styles = listStyles(dir)
    const note =
      styles.length === 0
        ? "No styles are available yet."
        : "Call airdesign_get_style with a style name to read its guide and parameters."
    return answered(note, { ok: true, styles })
  }
  const style = readStyle(parsed.name, dir)
  if (style === undefined) {
    const available = listStyles(dir).map((entry) => entry.name)
    const note =
      available.length === 0
        ? "No styles are available yet."
        : `No style named "${parsed.name}". Available styles: ${available.join(", ")}.`
    return refused("field", { field: "name", available, note })
  }
  const note =
    style.parameters.length === 0
      ? `Style ${style.name}.`
      : `Style ${style.name}. Set its parameters before applying it to a deck.`
  return answered(note, { ok: true, name: style.name, text: style.markdown, parameters: style.parameters })
}

import { styles, styleText } from "@airdesign/taste"

import { answered, refused, type Answer } from "./answer.js"
import { guide, guides } from "./guides.js"

function readOptionalName(
  raw: unknown,
  form: string,
): { readonly ok: true; readonly name: string | undefined } | { readonly ok: false; readonly result: Answer } {
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

const nameIn = (raw: string): string => {
  const trimmed = raw.trim()
  return trimmed.endsWith(".md") ? trimmed.slice(0, -3) : trimmed
}

function skillIndex() {
  const entries = guides().map(({ name, description }) => ({ name, when: description }))
  const markdown = [
    "# AirDesign skills",
    "",
    "Call `airdesign_read_skill` with a skill name to read its guide.",
    "",
    ...entries.map((entry) => `- \`${entry.name}\`: ${entry.when}`),
  ].join("\n")
  return { markdown, skills: entries }
}

export function readSkillTool(raw: unknown): Answer {
  const parsed = readOptionalName(raw, "A skill name from the index.")
  if (!parsed.ok) return parsed.result
  if (parsed.name === undefined) {
    const index = skillIndex()
    return answered("Call airdesign_read_skill with a skill name to read its guide.", {
      ok: true,
      skills: index.skills,
      text: index.markdown,
    })
  }
  const found = guide(nameIn(parsed.name))
  if (found === undefined) {
    const available = guides().map((entry) => entry.name)
    const note = `No skill named "${parsed.name}". Available skills: ${available.join(", ")}.`
    return refused("field", { field: "name", available, note })
  }
  return answered(`Skill ${found.name}.`, { ok: true, name: found.name, text: found.markdown })
}

export function getStyleTool(raw: unknown): Answer {
  const parsed = readOptionalName(raw, "A style name from the list.")
  if (!parsed.ok) return parsed.result
  if (parsed.name === undefined) {
    const listed = styles.map(({ id }) => ({ name: id, summary: styleText(id)!.summary }))
    return answered("Call airdesign_get_style with a style name to read its guide and parameters.", {
      ok: true,
      styles: listed,
    })
  }
  const name = nameIn(parsed.name)
  const text = styleText(name)
  if (text === undefined) {
    const available = styles.map(({ id }) => id)
    const note = `No style named "${parsed.name}". Available styles: ${available.join(", ")}.`
    return refused("field", { field: "name", available, note })
  }
  const note =
    text.parameters.length === 0 ? `Style ${name}.` : `Style ${name}. Set its parameters before applying it to a deck.`
  return answered(note, { ok: true, name, text: text.markdown, parameters: text.parameters })
}

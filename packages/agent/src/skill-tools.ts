import { listStyles, readSkill, readStyle, skills } from "@airdesign/taste"

import { answered, refused, type Answer } from "./answer.js"

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

function skillIndex(dir: string | undefined) {
  const entries = skills(dir).map(({ name, description }) => ({ name, when: description }))
  const markdown = [
    "# AirDesign skills",
    "",
    "Call `airdesign_read_skill` with a skill name to read its guide.",
    "",
    ...entries.map((entry) => `- \`${entry.name}\`: ${entry.when}`),
  ].join("\n")
  return { markdown, skills: entries }
}

export function readSkillTool(raw: unknown, dir?: string): Answer {
  const parsed = readOptionalName(raw, "A skill name from the index.")
  if (!parsed.ok) return parsed.result
  if (parsed.name === undefined) {
    const index = skillIndex(dir)
    return answered("Call airdesign_read_skill with a skill name to read its guide.", {
      ok: true,
      skills: index.skills,
      text: index.markdown,
    })
  }
  const skill = readSkill(parsed.name, dir)
  if (skill === undefined) {
    const available = skills(dir).map((entry) => entry.name)
    const note =
      available.length === 0
        ? "No skills are available."
        : `No skill named "${parsed.name}". Available skills: ${available.join(", ")}.`
    return refused("field", { field: "name", available, note })
  }
  return answered(`Skill ${skill.name}.`, { ok: true, name: skill.name, text: skill.markdown })
}

export function getStyleTool(raw: unknown, dir?: string): Answer {
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

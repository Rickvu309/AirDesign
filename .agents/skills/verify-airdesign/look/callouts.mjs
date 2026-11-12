export const noteLimit = 90

const blockKeys = new Set(["state", "title", "crop", "click", "callouts"])
const calloutKeys = new Set(["at", "note"])

const filled = (value) => typeof value === "string" && value.trim() !== ""

function isBox(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join() === "height,width,x,y" &&
    Object.values(value).every((number) => Number.isFinite(number)) &&
    value.width > 0 &&
    value.height > 0
  )
}

function readPlace(value, where) {
  if (filled(value)) return value.trim()
  if (isBox(value)) return value
  throw new Error(`${where} must be a CSS selector or a box {"x","y","width","height"} in CSS px`)
}

function unknownKeys(value, allowed, where) {
  const extra = Object.keys(value).filter((key) => !allowed.has(key))
  if (extra.length > 0) throw new Error(`${where} has unknown keys: ${extra.join(", ")}`)
}

export function readCallouts(text, source = "the callouts file") {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${source} is not JSON: ${String(error.message ?? error)}`)
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error(`${source} must be a JSON array with one block per state`)
  const warnings = []
  const blocks = parsed.map((block, index) => {
    const where = `block ${String(index + 1)}`
    if (block === null || typeof block !== "object" || Array.isArray(block))
      throw new Error(`${where} must be an object`)
    unknownKeys(block, blockKeys, where)
    if (!filled(block.state)) throw new Error(`${where} needs "state", a name from verify-airdesign states`)
    if (!filled(block.title)) throw new Error(`${where} needs "title", the screen area it shows`)
    const click = block.click ?? []
    if (!Array.isArray(click) || !click.every(filled))
      throw new Error(`${where} "click" must be a list of CSS selectors`)
    if (!Array.isArray(block.callouts)) throw new Error(`${where} needs "callouts", a list`)
    const callouts = block.callouts.map((callout, at) => {
      const spot = `${where} callout ${String(at + 1)}`
      if (callout === null || typeof callout !== "object" || Array.isArray(callout))
        throw new Error(`${spot} must be an object`)
      unknownKeys(callout, calloutKeys, spot)
      if (!filled(callout.note)) throw new Error(`${spot} has an empty note; say what changed in one sentence`)
      const note = callout.note.trim().replace(/\s+/g, " ")
      if (note.length > noteLimit)
        warnings.push(`${spot} note is ${String(note.length)} characters; keep it under ${String(noteLimit)}`)
      return { at: readPlace(callout.at, `${spot} "at"`), note }
    })
    return {
      state: block.state.trim(),
      title: block.title.trim(),
      crop: block.crop === undefined ? null : readPlace(block.crop, `${where} "crop"`),
      click: click.map((each) => each.trim()),
      callouts,
    }
  })
  return { blocks, warnings }
}

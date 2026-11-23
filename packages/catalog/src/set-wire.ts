import { type JsonSchema } from "./agent-form.js"

const slidePart = "(?:[0-9]{1,10}|n[0-9a-z]{12})"

export const slideSchema: JsonSchema = {
  type: "string",
  pattern: `^${slidePart}$`,
  description: "Slide id from airdesign_read_deck.",
}

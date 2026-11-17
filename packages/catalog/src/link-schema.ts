export const linkSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["url", "slide", "none"] },
    url: { type: "string", maxLength: 2048 },
    slide: { type: "string" },
  },
  required: ["kind"],
  additionalProperties: false,
}

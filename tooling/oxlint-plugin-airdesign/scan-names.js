const vague = new Set(["utils", "helpers", "common"])

export const nameFindings = (relative) =>
  relative
    .split("/")
    .filter((part) => vague.has(part.split(".")[0]))
    .map((part) => `${relative}: Rename ${part} after what it contains.`)

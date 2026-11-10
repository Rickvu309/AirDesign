const vague = new Set(["helpers", "common"])

export const nameFindings = (relative) =>
  relative
    .split("/")
    .filter((part) => vague.has(part.split(".")[0].toLowerCase()))
    .map((part) => `${relative}: Rename ${part} after what it contains.`)

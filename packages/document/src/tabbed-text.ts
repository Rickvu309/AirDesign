export type CellTexts = readonly (readonly string[])[]

function padded(rows: readonly string[][]): CellTexts {
  const width = Math.max(0, ...rows.map((row) => row.length))
  return rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")])
}

export function readTabbed(text: string): CellTexts {
  const rows: string[][] = [[]]
  let field = ""
  let quoted = false
  let fresh = true
  const row = () => rows[rows.length - 1] ?? []
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at]
    if (quoted) {
      if (char !== '"') field += char
      else if (text[at + 1] === '"') {
        field += '"'
        at += 1
      } else quoted = false
      continue
    }
    if (char === '"' && fresh) {
      quoted = true
      fresh = false
      continue
    }
    if (char === "\t" || char === "\n" || char === "\r") {
      if (char === "\r" && text[at + 1] === "\n") at += 1
      row().push(field)
      field = ""
      fresh = true
      if (char !== "\t") rows.push([])
      continue
    }
    field += char
    fresh = false
  }
  row().push(field)
  const last = rows[rows.length - 1]
  if (rows.length > 1 && last?.length === 1 && last[0] === "") rows.pop()
  return padded(rows)
}

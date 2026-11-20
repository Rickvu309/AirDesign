import { readTabbed, type CellTexts } from "@airdesign/document"

export type ClipboardRead = { readonly getData: (type: string) => string }

const blocks = new Set(["P", "DIV", "LI"])

function shownText(node: Node): string {
  let text = ""
  for (const child of node.childNodes) {
    if (child.nodeType === child.TEXT_NODE) text += (child.textContent ?? "").replace(/[\s ]+/g, " ")
    else if (child.nodeName === "BR") text += "\n"
    else if (blocks.has(child.nodeName)) text += (text === "" || text.endsWith("\n") ? "" : "\n") + shownText(child)
    else text += shownText(child)
  }
  return text
}

function cellOf(cell: Element): string {
  return shownText(cell)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

function tableCells(html: string): CellTexts | null {
  if (!/<table[\s>]/i.test(html) || typeof DOMParser === "undefined") return null
  const table = new DOMParser().parseFromString(html, "text/html").querySelector("table")
  if (table === null) return null
  const rows = [...table.querySelectorAll("tr")].map((row) =>
    [...row.children]
      .filter((cell) => cell.nodeName === "TD" || cell.nodeName === "TH")
      .flatMap((cell) => {
        const span = Math.max(1, Number(cell.getAttribute("colspan") ?? "1") || 1)
        return [cellOf(cell), ...Array.from({ length: span - 1 }, () => "")]
      }),
  )
  const width = Math.max(0, ...rows.map((row) => row.length))
  if (rows.length === 0 || width === 0) return null
  return rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")])
}

export function readPastedCells(data: ClipboardRead | null): CellTexts | null {
  if (data === null) return null
  const fromTable = tableCells(data.getData("text/html"))
  if (fromTable !== null) return fromTable
  const text = data.getData("text/plain")
  return text === "" ? null : readTabbed(text)
}

export function manyCells(cells: CellTexts | null): cells is CellTexts {
  return cells !== null && cells.length * (cells[0]?.length ?? 0) > 1
}

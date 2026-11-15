import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { movedSize } from "@/editor/table-size"
import { TableSizeGrid, TableTool } from "@/editor/table-tool"

function tagsOf(markup: string) {
  return [...markup.matchAll(/<button[^>]*>/g)].map((tag) => tag[0])
}

it("offers every size from one cell to eight rows by ten columns, each named by its rows and columns", () => {
  const tags = tagsOf(
    renderToStaticMarkup(
      <TableSizeGrid picked={{ rows: 4, columns: 3 }} onPick={() => undefined} onSize={() => undefined} />,
    ),
  )
  expect(tags).toHaveLength(80)
  const labels = tags.map((tag) => /aria-label="([^"]*)"/.exec(tag)?.[1])
  expect(labels[0]).toBe("1 row, 1 column")
  expect(labels[1]).toBe("1 row, 2 columns")
  expect(labels[32]).toBe("4 rows, 3 columns")
  expect(labels.at(-1)).toBe("8 rows, 10 columns")
  expect(tags.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1)
  expect(tags[32]).toContain('tabindex="0"')
  expect(tags.filter((tag) => tag.includes("data-picked"))).toHaveLength(12)
})

it("moves the picked size with the arrow keys and keeps it inside the grid", () => {
  const at = { rows: 1, columns: 1 }
  expect(movedSize(at, "ArrowDown")).toEqual({ rows: 2, columns: 1 })
  expect(movedSize(at, "ArrowRight")).toEqual({ rows: 1, columns: 2 })
  expect(movedSize(at, "ArrowUp")).toEqual(at)
  expect(movedSize(at, "ArrowLeft")).toEqual(at)
  expect(movedSize({ rows: 8, columns: 10 }, "ArrowDown")).toEqual({ rows: 8, columns: 10 })
  expect(movedSize({ rows: 8, columns: 10 }, "ArrowRight")).toEqual({ rows: 8, columns: 10 })
  expect(movedSize({ rows: 3, columns: 3 }, "Home")).toEqual({ rows: 3, columns: 1 })
  expect(movedSize({ rows: 3, columns: 3 }, "End")).toEqual({ rows: 3, columns: 10 })
  expect(movedSize(at, "a")).toBeNull()
})

it("puts Insert table in the toolbar as one button", () => {
  const tags = tagsOf(renderToStaticMarkup(<TableTool onTable={() => undefined} />))
  expect(tags).toHaveLength(1)
  expect(tags[0]).toContain('aria-label="Insert table"')
})

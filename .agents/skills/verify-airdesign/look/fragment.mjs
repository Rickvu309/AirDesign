export const heading = "## Before / after"

const plain = (text) =>
  String(text)
    .replace(/[[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const picture = (alt, file, link) => `![${plain(alt)}](${link(file)})`

export function fragment({ images, rows, labels, link = (file) => file }) {
  const titles = rows.map((row) => plain(row.title)).join("; ")
  const pictures = images.map((file, index) =>
    picture(
      images.length === 1
        ? `Annotated before and after: ${titles}`
        : `Annotated before and after, part ${String(index + 1)}`,
      file,
      link,
    ),
  )
  const cell = (row, side) => {
    if (row[side] !== null) return picture(`${labels[side]}: ${row.title}`, row[side], link)
    return side === "before" ? "New in this PR" : "Not reached in this PR"
  }
  const table = [
    `| ${plain(labels.before)} | ${plain(labels.after)} |`,
    "| --- | --- |",
    ...rows.map((row) => `| ${cell(row, "before")} | ${cell(row, "after")} |`),
  ]
  return [heading, "", ...pictures.flatMap((each) => [each, ""]), ...table, ""].join("\n")
}

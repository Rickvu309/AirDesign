import { appearanceCopy } from "./appearance-copy"
import type { PaintFill } from "@airdesign/pptx"
import { nameTooLongOf } from "@/copy/product-copy"
import type { PanelKind } from "@/design/panel-order"

type Named = Exclude<PaintFill["type"], "solid" | "none">

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  background: "Background",
  selectOneSlide: "Select one slide to change its design.",
  templateStyle: "Template style",
  currentTheme: "Current theme",
  themeFontsMissing: "Fonts not specified",
  editDeckTheme: "Edit deck theme",
  deckThemeScope: "Changes apply to all themes in this deck.",
  themeFonts: (heading: string, body: string) => `${heading} / ${body}`,
  headingFont: (font: string) => `Heading: ${font}`,
  bodyFont: (font: string) => `Body: ${font}`,
  backgroundColor: (name: string) => `Background color, ${name}`,
  ...appearanceCopy,
  white: "White",
  fills: { gradient: "Gradient", pattern: "Pattern", picture: "Picture" },
  panels: {
    text: "Text box",
    shape: "Shape",
    picture: "Picture",
    connector: "Line",
    group: "Group",
    table: "Table",
    chart: "Chart",
    kept: "Element",
  },
  selected: (count: number) => `${String(count)} selected`,
  selectMatching: "Select matching layers",
  noMatching: "No matching layers found.",
  multiEditText: "Multi-edit text",
  nothing: "Nothing on this element can be changed here yet.",
  refused: "Unable to make that change. Select the element and try again, or reload the deck if it keeps happening.",
  tooLong: (max: number, wide: boolean) =>
    wide ? `${nameTooLongOf(max)} Some letters and emoji count as 2 to 4.` : nameTooLongOf(max),
  textTooLong: (max: number, wide: boolean) =>
    `Use less text. This box holds up to ${new Intl.NumberFormat("en").format(max)} characters, including formatting.${wide ? " Some letters and emoji count as 2 to 4." : ""}`,
  mixed: "Mixed",
  points: "pt",
  percent: "%",
  degrees: "°",
  addStop: "Add stop",
  remove: "Remove",
  removeStop: (number: number) => `Remove stop ${String(number)}`,
  stop: (number: number) => `Stop ${String(number)}`,
  cell: (row: number, column: number) => `Row ${String(row)}, column ${String(column)}`,
} as const satisfies {
  readonly fills: Record<Named, string>
  readonly panels: Record<Exclude<PanelKind, "many">, string>
  readonly [key: string]: unknown
}

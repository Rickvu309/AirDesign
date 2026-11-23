import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-enter-while-composing": "error" }
const message = "Return early on `composing(event)` from apps/web/src/lib/composing.ts"
const guard = 'import { composing } from "@/lib/composing"\n'

expectRejects(
  "687c4737 ran the highlighted action on the Enter that commits a Telex word in Actions",
  "apps/web/src/doom-editor/actions-popover.tsx",
  `export const keys = (event, active, rowsOf) => {
  if (event.key === "Enter" && active !== null) {
    event.preventDefault()
    rowsOf()[active]?.click()
  }
}
`,
  rule,
  message,
)
expectRejects(
  "main saves a deck name on the Enter that commits a Vietnamese word",
  "apps/web/src/editor/deck-title-edit.tsx",
  `export const field = (save) => (
  <input
    onKeyDown={(event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        save(event.currentTarget.value, false)
      }
    }}
  />
)
`,
  rule,
  message,
)
expectRejects(
  "main zooms on the Enter that commits full-width digits",
  "apps/web/src/editor/zoom-menu.tsx",
  `export const keys = (event, zoom) => {
  event.stopPropagation()
  if (event.key !== "Enter") return
  zoom()
}
`,
  rule,
  message,
)
expectRejects(
  "isComposing alone misses Safari, which sends keyCode 229",
  "apps/web/src/design/controls/dash.tsx",
  `export const keys = (event, commit) => {
  if (event.nativeEvent.isComposing) return
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guard after the check is too late",
  "apps/web/src/design/controls/number.tsx",
  `${guard}export const keys = (event, commit) => {
  if (event.key === "Enter") commit()
  if (composing(event)) return
}
`,
  rule,
  message,
)
expectRejects(
  "a guard in another handler does not count",
  "apps/web/src/design/controls/number.tsx",
  `${guard}export const first = (event) => composing(event)
export const second = (event, commit) => {
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a switch on the key fails",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  switch (event.key) {
    case "Enter":
      commit()
  }
}
`,
  rule,
  message,
)
expectRejects(
  "a code read fails",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  if (event.code === "NumpadEnter") commit()
}
`,
  rule,
  message,
)
expectAccepts(
  "a handler that returns early on composing passes",
  "apps/web/src/editor/deck-title-edit.tsx",
  `${guard}export const keys = (event, save) => {
  if (composing(event)) return
  if (event.key === "Enter") save()
}
`,
  rule,
)
expectAccepts(
  "a guard in the same condition passes",
  "apps/web/src/editor/zoom-menu.tsx",
  `${guard}export const keys = (event, zoom) => {
  if (composing(event) || event.key !== "Enter") return
  zoom()
}
`,
  rule,
)
expectAccepts(
  "a key table is not a check",
  "apps/web/src/editor/keys.ts",
  `export const rows = [{ id: "edit-text", keys: [{ key: "Enter" }] }]\n`,
  rule,
)
expectAccepts(
  "a test may press Enter",
  "apps/web/src/doom-editor/actions-popover.test.tsx",
  `export const pressed = (event) => event.key === "Enter"\n`,
  rule,
)
expectAccepts(
  "a package outside apps/web is not checked",
  "packages/render/src/gestures.ts",
  `export const enter = (event) => event.key === "Enter"\n`,
  rule,
)

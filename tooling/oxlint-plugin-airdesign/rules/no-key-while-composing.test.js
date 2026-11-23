import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-key-while-composing": "error" }
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

expectRejects(
  "Escape cancels a composition in every IME, so it needs the same guard",
  "apps/web/src/decks/decks-shell.tsx",
  `export const keys = (event, clear) => {
  if (event.key !== "Escape") return
  clear()
}
`,
  rule,
  message,
)
expectRejects(
  "keyCode 27 is Escape",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, close) => {
  if (event.keyCode === 27) close()
}
`,
  rule,
  message,
)
expectRejects(
  "a destructured key has no event to guard",
  "apps/web/src/editor/rename.tsx",
  `export const keys = ({ key }, commit) => {
  if (key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a destructured key from the event is still a key check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  const { key } = event
  if (key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a key kept in a variable is still a key check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  const k = event.key
  if (k === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "keyCode 13 is Enter",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  if (event.keyCode === 13) commit()
}
`,
  rule,
  message,
)
expectRejects(
  "which 13 is Enter",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  if (event.which === 13) commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a list of keys that includes Enter is a check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  if (["Enter", " "].includes(event.key)) commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guard on a different event guards nothing",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, other, commit) => {
  if (composing(other)) return
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guard in an unrelated branch guards nothing",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, open, commit) => {
  if (open) {
    if (composing(event)) return
  }
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guard in the else branch does not cover the rest",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, open, commit) => {
  if (open) {
    commit()
  } else if (composing(event)) return
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a call whose result is dropped guards nothing",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit) => {
  composing(event)
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guard that does not return guards nothing",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit, note) => {
  if (composing(event)) note()
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a local composing is not the shared guard",
  "apps/web/src/editor/rename.tsx",
  `const composing = () => false
export const keys = (event, commit) => {
  if (composing(event)) return
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a local composing beside the import is not the shared guard",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit) => {
  const composing = () => false
  if (composing(event)) return
  if (event.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "a guarded handler that calls an unguarded helper is rejected at the helper",
  "apps/web/src/editor/rename.tsx",
  `${guard}const enter = (event, commit) => {
  if (event.key === "Enter") commit()
}
export const keys = (event, commit) => {
  if (composing(event)) return
  enter(event, commit)
}
`,
  rule,
  message,
)
expectAccepts(
  "a guard inside a nested block covers the rest of that block",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, open, commit) => {
  if (open) {
    if (composing(event)) return
    if (event.key === "Enter") commit()
  }
}
`,
  rule,
)
expectAccepts(
  "a guard that returns in a block passes",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit, note) => {
  if (composing(event)) {
    note()
    return
  }
  if (event.key === "Escape") commit()
}
`,
  rule,
)
expectAccepts(
  "a guard on the native event of the checked event passes",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit) => {
  if (composing(event.nativeEvent)) return
  const { key } = event
  if (key === "Enter") commit()
}
`,
  rule,
)
expectAccepts(
  "a guarded alias and list check pass",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit) => {
  if (composing(event)) return
  const k = event.key
  if (["Enter", " "].includes(k) || event.keyCode === 13) commit()
}
`,
  rule,
)
expectAccepts(
  "a key that is not Enter or Escape is not checked",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, move) => {
  if (event.key === "ArrowDown" || event.keyCode === 229) move()
}
`,
  rule,
)
expectRejects(
  "an optional chain on the event does not hide an Enter check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  if (event?.key === "Enter") commit()
}
`,
  rule,
  message,
)
expectRejects(
  "an optional chain on the native event does not hide an Escape check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, cancel) => {
  if (event.nativeEvent?.key === "Escape") cancel()
}
`,
  rule,
  message,
)
expectRejects(
  "an optional computed read, alias, list and destructure do not hide a key check",
  "apps/web/src/editor/rename.tsx",
  `export const keys = (event, commit) => {
  const k = event?.key
  const { code } = event?.nativeEvent
  if (event?.["keyCode"] === 13 || ["Enter"].includes(event?.key) || k === "Enter" || code === "Escape") commit()
}
`,
  rule,
  message,
)
expectAccepts(
  "a guard on an optional chain covers an optional chain check",
  "apps/web/src/editor/rename.tsx",
  `${guard}export const keys = (event, commit) => {
  if (composing(event?.nativeEvent)) return
  if (event?.key === "Enter") commit()
}
`,
  rule,
)

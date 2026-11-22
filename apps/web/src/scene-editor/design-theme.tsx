import type { scene } from "@airdesign/document"
import { sceneEditorCopy } from "@/copy/scene-editor-copy"
import type { PanelContext } from "./design-parts"
import { PanelSection } from "./panel-fields"
import { themeColorWrites } from "./panel-writes"

function ThemeColor(props: {
  readonly name: scene.ColorVar
  readonly value: string
  readonly onCommit: (hex: string) => void
}) {
  const label = sceneEditorCopy.colorNames[props.name]
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        event.currentTarget.querySelector("input")?.blur()
      }}
    >
      <span
        aria-hidden="true"
        className="size-5 shrink-0 rounded-md shadow-[inset_0_0_0_1px_var(--black-10)]"
        style={{ background: props.value }}
      />
      <label htmlFor={`theme-${props.name}`} className="min-w-0 flex-1 truncate text-[length:var(--type-dense)]">
        {label}
      </label>
      <input
        key={props.value}
        id={`theme-${props.name}`}
        aria-label={label}
        defaultValue={props.value}
        spellCheck={false}
        className="h-8 w-20 rounded-lg bg-muted px-2.5 text-[length:var(--type-dense)]"
        onBlur={(event) => {
          const next = event.currentTarget.value.trim()
          if (next.toLowerCase() === props.value.toLowerCase()) return
          if (/^#[0-9a-fA-F]{6}$/.test(next)) props.onCommit(next)
          else event.currentTarget.value = props.value
        }}
      />
    </form>
  )
}

export function ThemeSection(props: PanelContext) {
  const names = Object.keys(props.theme.colors) as scene.ColorVar[]
  return (
    <PanelSection title={sceneEditorCopy.themeColors} name="theme">
      {names.map((name) => (
        <ThemeColor
          key={name}
          name={name}
          value={props.theme.colors[name]}
          onCommit={(hex) => props.push(themeColorWrites(props.view, name, hex))}
        />
      ))}
    </PanelSection>
  )
}

import { useId, useState } from "react"
import type { FieldValue } from "@airdesign/document"
import { Input } from "@/components/ui/input"
import { borderCopy } from "@/copy/border-copy"
import type { ControlProps } from "@/design/panel"
import { ChoiceControl } from "./choice"
import { composing } from "@/lib/composing"

type Pattern = Exclude<FieldValue<"border", "dash">, string>

const fullWidth = 100_000
const largest = 2_147_483_647
const defaultPattern: Pattern = { custom: [{ dash: 300_000, gap: 200_000 }] }

function readPattern(text: string, width: number): Pattern | null {
  const chunks = text.split(",").map((part) => part.trim())
  if (chunks.length % 2 !== 0 || chunks.length > 64 || chunks.some((part) => !/^\d*\.?\d+$/.test(part))) return null
  const scaled = chunks.map((part) => Math.round((Number(part) * fullWidth) / width))
  if (scaled.some((part, index) => part > largest || (index % 2 === 0 && part === 0))) return null
  return {
    custom: scaled.flatMap((dash, at) => (at % 2 === 0 ? [{ dash, gap: scaled[at + 1]! }] : [])),
  }
}

function Dashes({
  pattern,
  width,
  onChange,
}: {
  readonly pattern: Pattern
  readonly width: number
  readonly onChange: ControlProps["onChange"]
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const issue = useId()
  const shown = pattern.custom
    .flatMap(({ dash, gap }) => [dash, gap].map((run) => Number(((run * width) / fullWidth).toFixed(6))))
    .join(", ")
  const invalid = draft !== null && readPattern(draft, width) === null

  function commit() {
    if (draft === null || invalid) return
    if (draft !== shown) onChange(readPattern(draft, width))
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-[length:var(--type-caption)] text-quiet">
        {borderCopy.dashes}
        <Input
          data-focus-ring
          className="h-[var(--control-dense)] rounded-[var(--shape-control)] bg-white text-right text-[length:var(--type-caption)] text-foreground md:text-[length:var(--type-caption)]"
          value={draft ?? shown}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? issue : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (composing(event)) return
            if (event.key === "Enter") {
              event.preventDefault()
              commit()
            }
            if (event.key === "Escape") {
              event.stopPropagation()
              setDraft(null)
            }
          }}
        />
      </label>
      {invalid ? (
        <p id={issue} className="text-[length:var(--type-caption)] text-danger-text">
          {borderCopy.patternError}
        </p>
      ) : null}
    </div>
  )
}

export function DashControl(props: ControlProps) {
  const { control, onChange } = props
  if (control.desc.kind !== "choice" || control.desc.custom === undefined) return <ChoiceControl {...props} />
  const pattern =
    !control.mixed && typeof control.value === "object" && control.value !== null ? (control.value as Pattern) : null
  const custom = { value: "custom", label: borderCopy.custom }
  const dropdown = {
    ...control,
    value: pattern === null ? control.value : custom.value,
    choices: [...(control.choices ?? []), custom],
    desc: { ...control.desc, options: [...control.desc.options, custom.value] },
  }
  return (
    <div className="flex flex-col gap-1">
      <ChoiceControl
        {...props}
        control={dropdown}
        onChange={(value) => onChange(value === custom.value ? defaultPattern : value)}
      />
      {pattern === null ? null : <Dashes pattern={pattern} width={control.numberScale ?? 1} onChange={onChange} />}
    </div>
  )
}

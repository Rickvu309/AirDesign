import { bytesOf, nameBytes } from "@airdesign/document"
import { useId, useRef, useState } from "react"
import { designCopy } from "@/copy/design-copy"
import { layersCopy } from "@/copy/layers-copy"

function sizeOf(words: string) {
  let bytes = 0
  for (const letter of words) bytes += bytesOf(letter)
  return { bytes, wide: bytes > [...words].length }
}

export function LayerNameField({
  name,
  onDone,
}: {
  readonly name: string
  readonly onDone: (name: string | null) => void
}) {
  const [draft, setDraft] = useState(name)
  const problemId = useId()
  const finished = useRef(false)
  const size = sizeOf(draft.trim())
  const problem = size.bytes > nameBytes ? designCopy.tooLong(nameBytes, size.wide) : null
  function finish(keep: boolean) {
    if (finished.current) return
    finished.current = true
    const typed = draft.trim()
    onDone(keep && problem === null && typed !== "" && typed !== name ? typed : null)
  }
  return (
    <span className="relative flex min-w-0 flex-1">
      <input
        autoFocus
        data-layer-name-field
        aria-label={layersCopy.rename(name)}
        aria-invalid={problem === null ? undefined : true}
        aria-describedby={problem === null ? undefined : problemId}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => finish(true)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.nativeEvent.isComposing) return
          if (event.key === "Enter" && problem === null) {
            event.preventDefault()
            finish(true)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            finish(false)
          }
        }}
        className="h-6 w-full min-w-0 flex-1 rounded-[var(--shape-control)] bg-background px-1 [--focus-ring-offset:0px] text-[length:var(--type-caption)] text-foreground shadow-[0_0_0_1px_var(--ring)] aria-invalid:shadow-[0_0_0_2px_var(--destructive)]"
      />
      {problem === null ? null : (
        <span
          id={problemId}
          role="alert"
          className="absolute top-7 left-0 z-10 w-max max-w-[200px] rounded-[var(--shape-control)] bg-background px-2 py-1.5 text-[length:var(--type-caption)] leading-[var(--leading-body)] text-danger-text shadow-[0_0_0_1px_var(--field-edge),0_4px_12px_var(--black-6)]"
        >
          {problem}
        </span>
      )}
    </span>
  )
}

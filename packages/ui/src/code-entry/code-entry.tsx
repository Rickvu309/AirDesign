import { useEffect, useRef } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"

type CodeEntryProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  error?: string
}

const length = 6

export function CodeEntry({ label, value, onValueChange, error }: CodeEntryProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  useEffect(() => { refs.current[0]?.focus({ preventScroll: true }) }, [])
  const digits = Array.from({ length }, (_, index) => value[index] ?? "")
  const errorId = "code-entry-error"

  const write = (next: string) => {
    onValueChange(next.replace(/\D/g, "").slice(0, length))
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text")
    if (!/\d/.test(pasted)) {
      return
    }
    event.preventDefault()
    write(pasted)
    const focusAt = Math.min(pasted.replace(/\D/g, "").length, length - 1)
    refs.current[focusAt]?.focus()
  }

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  return (
    <div className="ad-field">
      <span className="ad-field-label" id="code-entry-label">{label}</span>
      <div className="ad-code" role="group" aria-labelledby="code-entry-label" aria-describedby={error ? errorId : undefined}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node
            }}
            className="ad-code-box"
            inputMode="numeric"
            enterKeyHint={index === length - 1 ? "done" : "next"}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label} ${index + 1}`}
            value={digit}
            onPaste={onPaste}
            onKeyDown={(event) => onKeyDown(index, event)}
            onChange={(event) => {
              const nextDigits = [...digits]
              const incoming = event.target.value.replace(/\D/g, "")
              nextDigits[index] = incoming.slice(-1)
              write(nextDigits.join(""))
              if (incoming && index < length - 1) {
                refs.current[index + 1]?.focus()
              }
            }}
          />
        ))}
      </div>
      {error ? <p id={errorId} className="ad-field-error" role="alert">{error}</p> : null}
    </div>
  )
}

import { useId } from "react"
import type { InputHTMLAttributes } from "react"

type TextFieldProps = {
  label: string
  error?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "aria-invalid" | "aria-describedby">

export function TextField({ label, error, ...props }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <label className="ad-field" htmlFor={id}>
      <span className="ad-field-label">{label}</span>
      <input id={id} className="ad-field-input" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...props} />
      {error ? <p id={errorId} className="ad-field-error" role="alert">{error}</p> : null}
    </label>
  )
}

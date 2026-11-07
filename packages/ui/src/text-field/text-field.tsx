import { useId } from "react"
import type { ComponentProps, InputHTMLAttributes } from "react"

import { Icon } from "../icon/icon.tsx"

type TextFieldProps = {
  label: string
  error?: string
  icon?: ComponentProps<typeof Icon>["name"]
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "aria-invalid" | "aria-describedby">

export function TextField({ label, error, icon, ...props }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <label className="ad-field" htmlFor={id}>
      <span className="ad-field-label">{label}</span>
      <span className={icon ? "ad-field-control ad-field-control-icon" : "ad-field-control"}>
        {icon && <Icon name={icon}/>}
        <input id={id} className="ad-field-input" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...props} />
      </span>
      {error ? <p id={errorId} className="ad-field-error" role="alert">{error}</p> : null}
    </label>
  )
}

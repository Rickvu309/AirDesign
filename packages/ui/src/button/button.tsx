import type { ButtonHTMLAttributes } from "react"

export type ButtonVariant = "primary" | "secondary" | "danger" | "link"
export type ButtonSize = "dialog" | "settings" | "compact" | "sign-in"

type ButtonProps = {
  variant: ButtonVariant
  size: ButtonSize
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">

export function Button({ variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`ad-button ad-button-${variant} ad-button-${size}`} {...props} />
}

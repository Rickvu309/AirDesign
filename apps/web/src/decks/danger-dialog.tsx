import type { ComponentProps } from "react"
import { ConfirmationDialog } from "@/components/ui/dialog"

export function DangerDialog(props: Omit<ComponentProps<typeof ConfirmationDialog>, "danger">) {
  return <ConfirmationDialog {...props} danger />
}

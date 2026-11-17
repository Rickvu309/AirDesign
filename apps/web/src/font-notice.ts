import { toast } from "sonner"
import { fontCopy } from "./copy/font"

export function fontNotices(): void {
  document.addEventListener("airdesign-font-issue", (event) => {
    if (!(event instanceof CustomEvent)) return
    const detail: unknown = event.detail
    if (
      typeof detail !== "object" ||
      detail === null ||
      !("family" in detail) ||
      typeof detail.family !== "string" ||
      !("refusal" in detail)
    )
      return
    if (detail.refusal === "unknown" || detail.refusal === "unavailable")
      toast.warning(fontCopy[detail.refusal](detail.family), { id: `font-${detail.family}` })
  })
}

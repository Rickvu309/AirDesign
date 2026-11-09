import type { ReactNode } from "react"
import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function ScrimDialog({ children, className }: { children: ReactNode; className: string }) {
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay className="bg-black/25 duration-0 data-open:animate-none" style={{ backdropFilter: "none" }} />
        <BaseDialog.Popup
          initialFocus={false}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0/8%),0_24px_48px_rgb(0_0_0/16%)] outline-none data-open:animate-none",
            className,
          )}
        >
          {children}
        </BaseDialog.Popup>
      </DialogPortal>
    </Dialog>
  )
}

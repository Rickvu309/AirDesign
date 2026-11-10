import { useEffect, type CSSProperties } from "react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { productCopy } from "@/copy/product-copy"
import { EditorIcon } from "@/editor/editor-icons"

const toastWidth = "288.65px"

function ResetToastBody() {
  return (
    <div className="flex h-10 w-[288.65px] items-center gap-2.5 rounded-[var(--shape-card)] bg-foreground pr-4 pl-3.5 text-[length:var(--type-dense)] leading-[17px] text-white shadow-[0_8px_24px_rgb(0_0_0/20%)]">
      <EditorIcon name="check" size={15} />
      <span>{productCopy.usageResetDone}</span>
    </div>
  )
}

export function ResetToast() {
  useEffect(() => {
    toast.custom(() => <ResetToastBody />, {
      id: "usage-reset",
      duration: Infinity,
      unstyled: true,
      className: "!animate-none",
      style: { left: 0, width: toastWidth, opacity: 1, transform: "translateY(0)", transition: "none" },
    })
  }, [])
  return (
    <Toaster
      position="top-center"
      offset={12}
      visibleToasts={1}
      style={{ "--width": toastWidth } as CSSProperties}
      className="![left:calc(50%-56px)]"
    />
  )
}

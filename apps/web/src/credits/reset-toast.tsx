import { useEffect, type CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/sonner"
import { StatusPill } from "@/components/ui/status-pill"
import { productCopy } from "@/copy/product-copy"
import { EditorIcon } from "@/editor/editor-icons"

const toastWidth = "288.65px"

function ResetToastBody() {
  return (
    <StatusPill className="w-[288.65px] gap-2.5 pr-4 pl-3.5 leading-[17px]">
      <EditorIcon name="check" size={15} />
      <span>{productCopy.usageResetDone}</span>
    </StatusPill>
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

import { useEffect, useId, useRef, type CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { ActionPill } from "@/components/ui/action-pill"
import { StatusPill } from "@/components/ui/status-pill"
import { Toaster } from "@/components/ui/sonner"

const toastRoom = "30rem"

export function EditorToast({ text, action, onAct }: { text: string; action?: string; onAct?: () => void }) {
  const id = useId()
  const act = useRef(onAct)
  useEffect(() => {
    act.current = onAct
  })
  useEffect(() => {
    toast.custom(
      () => (
        <div className="flex justify-center">
          <div className="pointer-events-auto w-max max-w-full shrink-0">
            {action === undefined ? (
              <StatusPill layout="message">{text}</StatusPill>
            ) : (
              <ActionPill text={text} action={action} onAct={() => act.current?.()} />
            )}
          </div>
        </div>
      ),
      {
        id,
        duration: Number.POSITIVE_INFINITY,
        unstyled: true,
        style: {
          left: 0,
          right: 0,
          transition: "transform var(--ease-micro), opacity var(--ease-micro)",
          pointerEvents: "none",
        },
      },
    )
  }, [id, action, text])
  useEffect(
    () => () => {
      toast.dismiss(id)
    },
    [id],
  )
  return null
}

export function EditorToaster() {
  return (
    <Toaster
      position="top-center"
      offset={{ top: 12 }}
      visibleToasts={1}
      style={{ "--width": toastRoom } as CSSProperties}
      className="min-[601px]:-translate-x-14"
    />
  )
}

import { useEffect, useId, type CSSProperties } from "react"
import { toast } from "@/components/ui/toast"
import { StatusPill } from "@/components/ui/status-pill"
import { Toaster } from "@/components/ui/sonner"

const toastRoom = "30rem"

const toastMetrics = {
  screen: { width: "301.11px", shift: "0px" },
  canvas: { width: "289.46px", shift: "-56px" },
} as const

export function EditorToast({
  kind,
  text,
  action,
  place = "screen",
  still = false,
  host = true,
}: {
  kind: "success" | "info" | "error"
  text: string
  action?: string
  place?: "screen" | "canvas"
  still?: boolean
  host?: boolean
}) {
  const { width } = toastMetrics[place]
  const id = useId()
  useEffect(() => {
    toast.custom(
      () => (
        <StatusPill
          error={kind === "error"}
          className="pointer-events-auto mx-auto h-auto min-h-10 w-max max-w-full gap-2.5 py-2 pr-4 pl-3.5"
          style={{ minWidth: width }}
        >
          {kind === "success" ? (
            <span className="relative block size-4 shrink-0">
              <svg
                className="absolute top-[5.19px] left-[3.63px] block"
                viewBox="3.13 4.69 8.75 5.94"
                width="8.75"
                height="5.94"
                aria-hidden="true"
              >
                <path
                  d="M3.13 7.81 5.94 10.63 11.88 4.69"
                  fill="none"
                  stroke="var(--background)"
                  strokeWidth="1.09"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-pretty">{text}</span>
          {action ? <span className="text-[length:var(--type-dense)] font-medium">{action}</span> : null}
        </StatusPill>
      ),
      {
        id,
        toasterId: "editor-status",
        duration: Number.POSITIVE_INFINITY,
        unstyled: true,
        style: {
          left: 0,
          right: 0,
          ...(still
            ? { opacity: 1, transform: "translateY(0)", transition: "none" }
            : { transition: "transform var(--ease-micro), opacity var(--ease-micro)" }),
          pointerEvents: "none",
        },
      },
    )
  }, [id, action, kind, text, width, still])
  useEffect(
    () => () => {
      toast.dismiss(id)
    },
    [id],
  )
  return host ? <EditorToaster place={place} /> : null
}

export function EditorToaster({ place = "canvas" }: { place?: "screen" | "canvas" }) {
  const { shift } = toastMetrics[place]
  return (
    <Toaster
      id="editor-status"
      position="top-center"
      offset={{ top: 12 }}
      visibleToasts={1}
      style={{ "--width": toastRoom } as CSSProperties}
      className={shift === "0px" ? undefined : "min-[601px]:![left:calc(50%-56px)]"}
    />
  )
}

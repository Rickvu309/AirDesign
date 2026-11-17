import { useEffect, useRef } from "react"
import { productCopy } from "@/copy/product-copy"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  const host = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = host.current
    if (element === null) return
    const observer = new window.MutationObserver((changes) => {
      for (const change of changes) {
        const toast = change.target
        if (
          change.attributeName === "data-testid" &&
          toast instanceof HTMLElement &&
          toast.hasAttribute("data-sonner-toast") &&
          toast.dataset.removed !== "true"
        ) {
          toast.inert = false
          toast.removeAttribute("aria-hidden")
        }
      }
      for (const toast of element.querySelectorAll<HTMLElement>('[data-sonner-toast][data-removed="true"]')) {
        toast.inert = true
        toast.setAttribute("aria-hidden", "true")
      }
    })
    observer.observe(element, { subtree: true, attributes: true, attributeFilter: ["data-removed", "data-testid"] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      ref={host}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: productCopy.close,
        classNames: {
          toast: "cn-toast",
          closeButton: "!size-6",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

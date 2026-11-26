import { useEffect, useRef } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
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

  return <Sonner ref={host} {...props} />
}

export { Toaster }

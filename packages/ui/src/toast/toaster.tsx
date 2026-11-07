import { Toaster as SonnerToaster, toast } from "sonner"

export { toast }

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-center"
      offset="calc(12px + env(safe-area-inset-top, 0px))"
      mobileOffset={{top:"calc(12px + env(safe-area-inset-top, 0px))",left:"calc(16px + env(safe-area-inset-left, 0px))",right:"calc(16px + env(safe-area-inset-right, 0px))"}}
      toastOptions={{
        style: {
          background: "var(--foreground)",
          color: "var(--card)",
          borderRadius: "var(--radius-toast)",
          boxShadow: "var(--shadow-toast)",
          fontFamily: "var(--font-sans)",
          minHeight: 40,
          padding: "0 16px",
        },
      }}
    />
  )
}

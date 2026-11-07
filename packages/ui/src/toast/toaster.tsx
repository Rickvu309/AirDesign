import { Toaster as SonnerToaster, toast } from "sonner"

export { toast }

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-center"
      offset={12}
      mobileOffset={{top:"max(12px, env(safe-area-inset-top))",left:"max(12px, env(safe-area-inset-left))",right:"max(12px, env(safe-area-inset-right))",bottom:"max(12px, env(safe-area-inset-bottom))"}}
      toastOptions={{
        style: {
          background: "var(--foreground)",
          color: "var(--card)",
          borderRadius: "var(--radius-toast)",
          boxShadow: "var(--shadow-toast)",
          fontFamily: "var(--font-sans)",
          minHeight: 40,
          padding: "var(--toast-padding, 0 16px)",
        },
      }}
    />
  )
}

import { Toaster as SonnerToaster, toast } from "sonner"

export { toast }

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-center"
      offset={12}
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

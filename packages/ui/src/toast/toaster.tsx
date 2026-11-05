import { Toaster as SonnerToaster, toast } from "sonner"

export { toast }

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--foreground)",
          color: "var(--card)",
          borderRadius: "10px",
        },
      }}
    />
  )
}

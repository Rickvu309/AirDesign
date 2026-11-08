import { Toaster as SonnerToaster, toast } from "sonner"

export { toast }

export function Toaster() {
  return (
    <SonnerToaster
      className="ad-toaster"
      icons={{success:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>,error:<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--destructive)"/><path d="M8 4.5v4.2" stroke="var(--card)" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="11.3" r="1" fill="var(--card)"/></svg>}}
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
          width: "max-content",
          maxWidth: "calc(100vw - 24px)",
          gap: 10,
        },
      }}
    />
  )
}

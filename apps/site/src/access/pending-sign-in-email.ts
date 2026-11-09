const pendingEmailKey = "airdesign.pending-sign-in-email"

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(pendingEmailKey, email)
  } catch {
    return
  }
}

export function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(pendingEmailKey)
  } catch {
    return null
  }
}
